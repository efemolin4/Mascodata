import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';   // deja parseCLP real en window
import { state } from '../js/app.js'; // isPremium() (llamada dentro de viewFinance) lee `state` del scope de app.js — hay que mutar el mismo objeto, no reemplazar window.state
import { saveExpense, deleteExpense, viewFinance } from './finance.js';

describe('saveExpense', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    window.state = { user: { id: 'user-1' }, pets: [{ id: 'pet-1', name: 'Greta' }], expenses: [] };
    document.body.innerHTML = `
      <select id="ex-pet"><option value="pet-1" selected>Greta</option></select>
      <input id="ex-date" value="2026-05-01" />
      <input id="ex-cat" value="Veterinaria" />
      <input id="ex-amount" value="15000" />
      <input id="ex-desc" value="Consulta" />
    `;
  });

  it('agrega el gasto devuelto por Supabase, resolviendo el nombre de la mascota', async () => {
    window.sb = makeMockSb({
      expenses: { data: { id: 'exp-1', pet_id: 'pet-1', date: '2026-05-01', category: 'Veterinaria', amount: '15000', description: 'Consulta' }, error: null },
    });
    await saveExpense({ preventDefault: () => {} });
    expect(window.state.expenses).toHaveLength(1);
    expect(window.state.expenses[0]).toMatchObject({ id: 'exp-1', pet: 'Greta', amount: '15000' });
    expect(window.showToast).toHaveBeenCalledWith('Gasto guardado', 'success');
  });

  it('si Supabase falla, muestra el toast y no agrega nada', async () => {
    window.sb = makeMockSb({ expenses: { data: null, error: { message: 'boom' } } });
    await saveExpense({ preventDefault: () => {} });
    expect(window.state.expenses).toHaveLength(0);
    expect(window.showToast).toHaveBeenCalledWith('Error al guardar gasto', 'error');
  });

  it('convierte "190.000" tipeado en el campo a 190000 antes de mandarlo a Supabase (regresión del bug real)', async () => {
    // Bug real: el campo era type="number", que interpreta "190.000" como
    // el número 190 (punto = decimal), y ese string se mandaba tal cual a
    // una columna integer — Supabase rechazaba el insert completo con
    // "invalid input syntax for type integer". Ahora el campo es texto y
    // se parsea con parseCLP() antes de armar el payload.
    document.getElementById('ex-amount').value = '190.000';
    window.sb = makeMockSb({
      expenses: { data: { id: 'exp-2', pet_id: 'pet-1', date: '2026-05-01', category: 'Veterinaria', amount: 190000, description: 'Consulta' }, error: null },
    });
    await saveExpense({ preventDefault: () => {} });
    const insertedPayload = window.sb.from.mock.results[0].value.insert.mock.calls[0][0];
    expect(insertedPayload.amount).toBe(190000);
  });
});

describe('deleteExpense', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.state = { expenses: [{ id: 'exp-1', description: 'Consulta' }] };
  });

  it('elimina el gasto del estado local cuando Supabase confirma', async () => {
    window.sb = makeMockSb({ expenses: { data: null, error: null } });
    await deleteExpense('exp-1');
    expect(window.state.expenses).toHaveLength(0);
    expect(window.render).toHaveBeenCalled();
  });

  it('si Supabase falla, no toca el estado local', async () => {
    window.sb = makeMockSb({ expenses: { data: null, error: { message: 'boom' } } });
    await deleteExpense('exp-1');
    expect(window.state.expenses).toHaveLength(1);
    expect(window.showToast).toHaveBeenCalledWith('Error al eliminar', 'error');
    expect(window.render).not.toHaveBeenCalled();
  });
});

// Regresión/cobertura del nuevo gating por plan: el gráfico y la
// predicción de gastos quedan detrás de Premium; la lista y las stat
// cards siguen libres para Free.
describe('viewFinance — gating Premium de la vista Gráfico', () => {
  beforeEach(() => {
    // Los describe de arriba (saveExpense/deleteExpense) reasignan
    // window.state a un objeto nuevo, desconectándolo del `state` real de
    // js/app.js — isPremium() (llamada dentro de viewFinance) sigue
    // leyendo ese `state` real, así que hay que resincronizar la
    // referencia antes de mutarla.
    window.state = state;
    window.getFinanceExpenses = () => [];
    state.pets = [{ id: 'pet-1', name: 'Greta', species: 'Perro' }];
    state.finView = 'grafico';
    state.finPet = '';
    state.finPeriod = 'mensual';
  });

  it('un usuario Free ve el upsell de Premium en vez del gráfico', () => {
    state.user = { id: 'user-1', plan: 'free' };
    const html = viewFinance();
    expect(html).toContain('Premium');
    expect(html).toContain('Gráficos y predicción de gastos');
    expect(html).not.toContain('finance-period-chart');
    expect(html).not.toContain('Predicción de gastos');
  });

  it('un usuario Free igual ve el desglose por categoría (con sus montos), sin el gráfico por período', () => {
    window.getFinanceExpenses = () => [
      { id: 1, amount: 60000, date: new Date().toISOString().slice(0, 10), category: 'Veterinaria', pet: 'Greta' },
    ];
    state.user = { id: 'user-1', plan: 'free' };
    const html = viewFinance();
    expect(html).toContain('Por categoría');
    expect(html).toContain('Veterinaria');
    expect(html).toContain('$60.000');
    expect(html).not.toContain('finance-period-chart');
  });

  it('un usuario Premium ve el dashboard de gastos', () => {
    state.user = { id: 'user-1', plan: 'premium' };
    const html = viewFinance();
    expect(html).toContain('finance-period-chart');
    expect(html).toContain('Por categoría');
    expect(html).not.toContain('Gráficos y predicción de gastos');
  });

  it('la vista Lista (listado) sigue disponible en Free, sin upsell', () => {
    state.user = { id: 'user-1', plan: 'free' };
    state.finView = 'listado';
    const html = viewFinance();
    expect(html).toContain('Historial de gastos');
    expect(html).not.toContain('Botiquín del hogar');
  });
});

// Dashboard de la vista Gráfico: barras por período con el monto sobre cada
// una, variación vs. el período anterior y desglose por categoría.
describe('viewFinance — dashboard de gastos por período y categoría', () => {
  const monthsAgo = (n, day = 10) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); d.setDate(day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  beforeEach(() => {
    window.state = state;
    state.user = { id: 'user-1', plan: 'premium' };
    state.pets = [{ id: 'pet-1', name: 'Greta', species: 'Perro' }];
    state.finView = 'grafico';
    state.finPet = '';
    state.finPeriod = 'mensual';
  });

  it('muestra el total de la ventana, el monto compacto sobre cada barra y las categorías de mayor a menor', () => {
    window.getFinanceExpenses = () => [
      { id: 1, amount: 100000, date: monthsAgo(1), category: 'Veterinaria', pet: 'Greta' },
      { id: 2, amount: 50000, date: monthsAgo(0), category: 'Alimentación', pet: 'Greta' },
      { id: 3, amount: 20000, date: monthsAgo(0), category: 'Peluquería', pet: 'Greta' },
    ];
    const html = viewFinance();
    expect(html).toContain('$170.000');           // total de las 6 barras
    expect(html).toContain('3 registros');
    expect(html).toContain('$100k');
    expect(html).toContain('$70k');               // este mes: 50k + 20k
    const cats = html.slice(html.indexOf('Por categoría')); // la tarjeta de alimentación también nombra la categoría
    expect(cats.indexOf('Veterinaria')).toBeLessThan(cats.indexOf('Alimentación'));
    expect(cats.indexOf('Alimentación')).toBeLessThan(cats.indexOf('Peluquería'));
  });

  it('el gasto que sube vs. el período anterior se marca con ↑ y el que baja con ↓', () => {
    window.getFinanceExpenses = () => [
      { id: 1, amount: 100000, date: monthsAgo(1), category: 'Otro', pet: 'Greta' },
      { id: 2, amount: 150000, date: monthsAgo(0), category: 'Otro', pet: 'Greta' },
    ];
    expect(viewFinance()).toContain('↑ 50%');
    window.getFinanceExpenses = () => [
      { id: 1, amount: 200000, date: monthsAgo(1), category: 'Otro', pet: 'Greta' },
      { id: 2, amount: 100000, date: monthsAgo(0), category: 'Otro', pet: 'Greta' },
    ];
    expect(viewFinance()).toContain('↓ 50%');
  });

  it('si el período anterior fue $0 no divide por cero: avisa que no hubo gasto', () => {
    window.getFinanceExpenses = () => [{ id: 1, amount: 80000, date: monthsAgo(0), category: 'Otro', pet: 'Greta' }];
    const html = viewFinance();
    expect(html).toContain('Sin gasto en');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('NaN');
  });

  it('un gasto fuera de la ventana de 6 meses no entra al total ni a las categorías', () => {
    window.getFinanceExpenses = () => [
      { id: 1, amount: 999000, date: monthsAgo(10), category: 'Hotel', pet: 'Greta' },
      { id: 2, amount: 30000, date: monthsAgo(0), category: 'Otro', pet: 'Greta' },
    ];
    const html = viewFinance();
    expect(html).toContain('1 registro ·');
    expect(html).not.toContain('Hotel');
  });

  it('sin gastos en el período muestra el estado vacío, sin barras', () => {
    window.getFinanceExpenses = () => [];
    const html = viewFinance();
    expect(html).toContain('Sin gastos en este período');
    expect(html).not.toContain('NaN');
  });

  it('una categoría que no está en la paleta igual aparece (antes se descartaba en silencio)', () => {
    window.getFinanceExpenses = () => [{ id: 1, amount: 40000, date: monthsAgo(0), category: 'Cuidadora', pet: 'Greta' }];
    expect(viewFinance()).toContain('Cuidadora');
  });
});
