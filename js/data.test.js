import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js'; // deja todayStr real en window
import { getFinanceExpenses, refreshSharedData } from './data.js';

// Regresión: food_items (pestaña Nutrición, agregada 2026-09-07) nunca se
// sumó a esta función — un costo de alimento cargado ahí simplemente no
// aparecía en Finanzas, sin ningún error. Este test cubre TODAS las fuentes
// a la vez para que si se agrega una nueva (o se borra una por accidente) y
// se olvida acá, quede detectado en vez de descubrirse en producción.
describe('getFinanceExpenses', () => {
  beforeEach(() => {
    window.state = {
      expenses: [{ id: 'exp-1', date: '2026-01-01', category: 'Otro', amount: 5000, description: 'Manual' }],
      pets: [{
        id: 'pet-1', name: 'Greta',
        vaccines: [{ id: 'v1', date: '2026-01-01', name: 'Antirrábica', cost: 10000 }],
        deworming: [{ id: 'd1', date: '2026-01-01', product: 'Drontal', cost: 8000 }],
        medications: [{ id: 'm1', startDate: '2026-01-01', name: 'Meloxicam', cost: 7000 }],
        clinicalHistory: [{ id: 'h1', date: '2026-01-01', title: 'Control', cost: 20000 }],
        foodItems: [{ id: 'f1', purchaseDate: '2026-01-01', product: 'Barfood', price: 70000 }],
      }],
      botiquin: [{ id: 'b1', petId: 'pet-1', purchaseDate: '2026-01-01', name: 'Pregalex', cost: 14500 }],
    };
  });

  it('incluye el gasto manual y las 6 fuentes automáticas (vacunas, desparasitaciones, tratamientos, historial, botiquín, alimento)', () => {
    const expenses = getFinanceExpenses();
    const sources = expenses.map(e => e.source).sort();
    expect(sources).toEqual(['botiquin', 'deworming', 'food', 'history', 'manual', 'medication', 'vaccine']);
  });

  it('el gasto de alimento usa el precio, la fecha de compra y la categoría Alimentación', () => {
    const expenses = getFinanceExpenses();
    expect(expenses.find(e => e.source === 'food')).toMatchObject({
      amount: 70000, description: 'Alimento: Barfood', category: 'Alimentación',
      date: '2026-01-01', pet: 'Greta',
    });
  });

  it('ignora items de alimento sin precio cargado', () => {
    window.state.pets[0].foodItems.push({ id: 'f2', purchaseDate: '2026-01-01', product: 'Sin precio', price: null });
    const expenses = getFinanceExpenses();
    expect(expenses.some(e => e.description === 'Alimento: Sin precio')).toBe(false);
  });
});

// Con dos tutores, lo que uno registra no llega solo al otro: al volver a la pestaña se recargan
// los datos, pero sin pisar lo que la persona estaba haciendo.
describe('refreshSharedData', () => {
  beforeEach(() => {
    window.render = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    window.sb = makeMockSb({ pet_access: { data: [], error: null } });
    window.state = { isLoggedIn: true, user: { id: 'u1' }, currentView: 'dashboard', pets: [{ id: 'p1', tutor2: { name: 'Pedro' } }], lastDataLoadAt: 0 };
    document.body.innerHTML = '<div id="modal-root"></div>';
  });
  const called = () => window.sb.from.mock.calls.length > 0;

  it('recarga cuando la mascota es compartida y pasó más de un minuto', async () => {
    await refreshSharedData();
    expect(called()).toBe(true);
    expect(window.render).toHaveBeenCalled();
  });

  it('no recarga si no comparte ninguna mascota, si está en el modo demo o sin sesión', async () => {
    window.state.pets = [{ id: 'p1', tutor2: null }];
    await refreshSharedData();
    window.state.pets = [{ id: 'p1', tutor2: { name: 'Pedro' } }];
    window.isDemoUser = vi.fn(() => true);
    await refreshSharedData();
    window.isDemoUser = vi.fn(() => false);
    window.state.isLoggedIn = false;
    await refreshSharedData();
    expect(called()).toBe(false);
  });

  it('no recarga si hubo una carga hace menos de un minuto', async () => {
    window.state.lastDataLoadAt = Date.now() - 10_000;
    await refreshSharedData();
    expect(called()).toBe(false);
  });

  it('no recarga con un modal abierto ni mientras se crea una mascota', async () => {
    document.getElementById('modal-root').innerHTML = '<div class="modal-overlay"></div>';
    await refreshSharedData();
    document.getElementById('modal-root').innerHTML = '';
    window.state.currentView = 'addPet';
    await refreshSharedData();
    expect(called()).toBe(false);
  });
});

describe('getFinanceExpenses — quién pagó', () => {
  beforeEach(() => {
    window.state = {
      user: { id: 'yo', name: 'Ana' },
      expenses: [{ id: 'm1', petId: 'p1', amount: 5000, date: '2026-10-01', category: 'Otro', description: 'a', userId: 'otro', createdByName: 'Pedro' }],
      botiquin: [{ id: 'b1', petId: 'p1', cost: 800, name: 'Gasas', purchaseDate: '2026-10-01' }],
      pets: [{ id: 'p1', name: 'Greta', expenseSplit: 'equal', vaccines: [{ id: 'v1', name: 'X', date: '2026-10-02', cost: 12000, createdBy: 'yo', createdByName: 'Ana' }, { id: 'v2', name: 'Y', date: '2026-10-03', cost: 9000 }], deworming: [], medications: [], clinicalHistory: [], foodItems: [] }],
    };
  });
  const byId = id => getFinanceExpenses().find(e => e.id === id);

  it('cada gasto lleva quién lo pagó: el autor del registro o del gasto', () => {
    expect(byId('m1')).toMatchObject({ payerId: 'otro', payerName: 'Pedro' });
    expect(byId('vac-v1')).toMatchObject({ payerId: 'yo', payerName: 'Ana' });
    expect(byId('vac-v2').payerId).toBeNull(); // registro anterior a que se guardara el autor
  });

  it('el botiquín siempre es mío', () => {
    expect(byId('bot-b1')).toMatchObject({ payerId: 'yo' });
  });

  it('en una mascota que reparte gastos, lo que pagó el otro se marca aparte de mis totales', () => {
    expect(byId('m1').paidByOther).toBe(true);
    expect(byId('vac-v1').paidByOther).toBe(false);
    expect(byId('vac-v2').paidByOther).toBe(false); // sin pagador conocido: no se atribuye al otro
  });

  it('sin reparto, nada se marca como pagado por el otro', () => {
    window.state.pets[0].expenseSplit = 'none';
    expect(byId('m1').paidByOther).toBe(false);
  });
});
