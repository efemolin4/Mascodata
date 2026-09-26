import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';   // deja parseCLP real en window
import { state } from '../js/app.js'; // isPremium() (llamada dentro de viewFinance) lee `state` del scope de app.js — hay que mutar el mismo objeto, no reemplazar window.state
import { saveExpense, deleteExpense, viewFinance, openExpenseModal, onExpenseCategoryChange, onExpenseFoodPetChange, showManualExpense, continueFoodExpense, openSettlementModal, saveSettlement, deleteSettlement, onExpensePetChange } from './finance.js';

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

  it('el selector de mascota conserva el nombre exacto (un espacio al final no deja Finanzas en cero)', () => {
    // Un <option> sin value entrega su texto ya recortado: elegir "Greta " dejaba el filtro en "Greta" y no calzaba con ningún gasto.
    state.pets = [{ id: 'pet-1', name: 'Greta ', foodItems: [] }];
    window.getFinanceExpenses = () => [{ id: 1, amount: 60000, date: new Date().toISOString().slice(0, 10), category: 'Veterinaria', pet: 'Greta ' }];
    state.user = { id: 'user-1', plan: 'free' };
    state.finPet = 'Greta ';
    const html = viewFinance();
    expect(html).toContain('<option value="Greta " selected>');
    expect(html).toContain('$60.000');
    state.finPet = '';
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

describe('registrar gasto — categoría Alimentación', () => {
  const setup = (pets) => {
    window.showToast = vi.fn();
    window.track = vi.fn();
    window.openFoodPurchaseModal = vi.fn();
    window.openFoodItemModal = vi.fn();
    window.state = { user: { id: 'u1' }, pets, expenses: [], finPet: '' };
    document.body.innerHTML = '<div id="modal-root"></div>';
    window.openModal = html => { document.getElementById('modal-root').innerHTML = html; };
    openExpenseModal();
  };
  const choose = (cat) => { document.getElementById('ex-cat').value = cat; onExpenseCategoryChange(); };
  const hidden = id => document.getElementById(id).classList.contains('hidden');
  const greta = { id: 'p1', name: 'Greta', foodItems: [{ id: 'f1', product: 'Barfood' }, { id: 'f2', product: 'Snack' }] };

  it('con otra categoría muestra el formulario manual de siempre', () => {
    setup([greta]);
    choose('Veterinaria');
    expect(hidden('ex-food-panel')).toBe(true);
    expect(hidden('ex-manual')).toBe(false);
  });

  it('al elegir Alimentación esconde el monto suelto y ofrece los alimentos de la mascota', () => {
    setup([greta]);
    choose('Alimentación');
    expect(hidden('ex-food-panel')).toBe(false);
    expect(hidden('ex-manual')).toBe(true);
    expect(hidden('ex-actions')).toBe(true);
    document.getElementById('ex-food-pet').value = 'p1';
    onExpenseFoodPetChange();
    expect([...document.getElementById('ex-food-item').options].map(o => o.textContent)).toEqual(['Otro alimento nuevo', 'Barfood', 'Snack']);
    expect(document.getElementById('ex-food-item').value).toBe('f1');
  });

  it('continuar con un alimento existente abre la nueva compra de ese alimento', () => {
    setup([greta]);
    choose('Alimentación');
    document.getElementById('ex-food-pet').value = 'p1';
    onExpenseFoodPetChange();
    continueFoodExpense();
    expect(window.openFoodPurchaseModal).toHaveBeenCalledWith('p1', 'f1');
    expect(window.openFoodItemModal).not.toHaveBeenCalled();
  });

  it('continuar con "otro alimento nuevo" abre el formulario de agregar alimento', () => {
    setup([greta]);
    choose('Alimentación');
    document.getElementById('ex-food-pet').value = 'p1';
    document.getElementById('ex-food-item').value = '';
    continueFoodExpense();
    expect(window.openFoodItemModal).toHaveBeenCalledWith('p1');
  });

  it('sin elegir mascota no avanza y avisa', () => {
    setup([greta]);
    choose('Alimentación');
    document.getElementById('ex-food-pet').value = '';
    continueFoodExpense();
    expect(window.showToast).toHaveBeenCalledWith('Elige la mascota', 'error');
    expect(window.openFoodPurchaseModal).not.toHaveBeenCalled();
  });

  it('"Registrar solo como gasto" vuelve al formulario manual y se mantiene mientras siga en Alimentación', () => {
    setup([greta]);
    choose('Alimentación');
    showManualExpense();
    expect(hidden('ex-manual')).toBe(false);
    expect(hidden('ex-food-panel')).toBe(true);
    onExpenseCategoryChange();
    expect(hidden('ex-manual')).toBe(false);
    choose('Otro');
    choose('Alimentación'); // al volver a elegirla, de nuevo se ofrece el flujo de la ficha
    expect(hidden('ex-food-panel')).toBe(false);
  });

  it('sin mascotas registradas, Alimentación sigue siendo un gasto manual', () => {
    setup([]);
    choose('Alimentación');
    expect(hidden('ex-manual')).toBe(false);
    expect(hidden('ex-food-panel')).toBe(true);
  });

  it('preselecciona la mascota filtrada en Finanzas', () => {
    window.state = { pets: [greta, { id: 'p2', name: 'Luna' }], finPet: 'Luna' };
    document.body.innerHTML = '<div id="modal-root"></div>';
    window.openModal = html => { document.getElementById('modal-root').innerHTML = html; };
    openExpenseModal();
    expect(document.getElementById('ex-food-pet').value).toBe('p2');
  });
});

describe('gastos compartidos — saldo entre tutores', () => {
  const today = new Date().toISOString().slice(0, 10);
  const pet = (over = {}) => ({ id: 'pet-1', name: 'Greta', species: 'Perro', myRole: 'owner', tutor2: { name: 'Pedro' }, expenseSplit: 'equal', ...over });
  const gasto = (over = {}) => ({ id: 'g1', petId: 'pet-1', pet: 'Greta', amount: 30000, date: today, category: 'Veterinaria', description: 'Control', source: 'manual', payerId: 'yo', payerName: 'Ana', paidByOther: false, ...over });

  beforeEach(() => {
    window.state = state;
    state.user = { id: 'yo', name: 'Ana', plan: 'free' };
    state.pets = [pet()];
    state.settlements = [];
    state.finView = 'listado'; state.finPet = ''; state.finPeriod = 'mensual';
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    window.track = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    document.body.innerHTML = '<div id="modal-root"></div>';
    window.openModal = html => { document.getElementById('modal-root').innerHTML = html; };
  });

  it('muestra quién le debe a quién, con lo que pagó cada uno', () => {
    window.getFinanceExpenses = () => [gasto(), gasto({ id: 'g2', amount: 10000, payerId: 'otro', payerName: 'Pedro', paidByOther: true })];
    const html = viewFinance();
    expect(html).toContain('Gastos compartidos · Greta');
    expect(html).toContain('Pedro te debe $10.000'); // 15.000 a favor - 5.000 en contra
    expect(html).toContain('Tú pagaste $30.000');
    expect(html).toContain('Registrar un pago');
  });

  it('lo que pagó el otro tutor no entra a mis totales', () => {
    window.getFinanceExpenses = () => [gasto(), gasto({ id: 'g2', amount: 10000, payerId: 'otro', payerName: 'Pedro', paidByOther: true })];
    const html = viewFinance();
    expect(html).toContain('$30.000'); // Total: solo lo que pagué yo
    expect(html).not.toMatch(/Total todas<[^]*?\$40\.000/);
  });

  it('dice "Están al día" cuando los pagos cubren la deuda y "Le debes" cuando debo yo', () => {
    window.getFinanceExpenses = () => [gasto({ payerId: 'otro', payerName: 'Pedro', paidByOther: true })];
    expect(viewFinance()).toContain('Le debes $15.000 a Pedro');
    state.settlements = [{ id: 's1', petId: 'pet-1', amount: 15000, direction: 'paid', createdBy: 'yo', createdByName: 'Ana', date: today, note: '' }];
    expect(viewFinance()).toContain('Están al día');
  });

  it('no aparece si la mascota no reparte gastos, no tiene otro tutor o el filtro es otra mascota', () => {
    window.getFinanceExpenses = () => [gasto()];
    state.pets = [pet({ expenseSplit: 'none' })];
    expect(viewFinance()).not.toContain('Gastos compartidos');
    state.pets = [pet({ tutor2: null })];
    expect(viewFinance()).not.toContain('Gastos compartidos');
    state.pets = [pet(), { id: 'pet-2', name: 'Luna' }];
    state.finPet = 'Luna';
    expect(viewFinance()).not.toContain('Gastos compartidos');
  });

  it('el tutor de solo lectura ve el saldo pero no puede registrar pagos', () => {
    window.getFinanceExpenses = () => [gasto()];
    state.pets = [pet({ myRole: 'viewer' })];
    expect(viewFinance()).not.toContain('Registrar un pago');
  });

  it('el modal de pago propone la dirección y el monto según el saldo', () => {
    window.getFinanceExpenses = () => [gasto()]; // me deben 15.000
    openSettlementModal('pet-1');
    expect(document.getElementById('st-dir').value).toBe('received');
    expect(document.getElementById('st-amount').value).toBe('15000');
    window.getFinanceExpenses = () => [gasto({ payerId: 'otro', payerName: 'Pedro', paidByOther: true })]; // debo 15.000
    openSettlementModal('pet-1');
    expect(document.getElementById('st-dir').value).toBe('paid');
  });

  it('guardar un pago lo registra con su dirección y lo suma al estado', async () => {
    window.getFinanceExpenses = () => [gasto()];
    openSettlementModal('pet-1');
    document.getElementById('st-amount').value = '15.000';
    let payload;
    window.sb = { from: vi.fn(() => ({ insert: vi.fn(row => { payload = row; return { select: () => ({ single: () => Promise.resolve({ data: { id: 's9', ...row, created_by: 'yo', created_by_name: 'Ana' }, error: null }) }) }; }) })) };
    await saveSettlement({ preventDefault() {} }, 'pet-1');
    expect(payload).toMatchObject({ pet_id: 'pet-1', amount: 15000, direction: 'received' });
    expect(state.settlements).toHaveLength(1);
    expect(state.settlements[0]).toMatchObject({ amount: 15000, createdBy: 'yo' });
  });

  it('rechaza un monto vacío o cero y avisa si la base aún no tiene la tabla', async () => {
    window.getFinanceExpenses = () => [];
    openSettlementModal('pet-1');
    document.getElementById('st-amount').value = '0';
    window.sb = { from: vi.fn() };
    await saveSettlement({ preventDefault() {} }, 'pet-1');
    expect(window.showToast).toHaveBeenCalledWith('Ingresa un monto mayor que cero', 'error');
    document.getElementById('st-amount').value = '5000';
    window.sb = { from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'relation "expense_settlements" does not exist' } }) }) }) }) };
    await saveSettlement({ preventDefault() {} }, 'pet-1');
    expect(window.showToast).toHaveBeenCalledWith('Falta actualizar la base de datos para registrar pagos', 'error');
    expect(state.settlements).toHaveLength(0);
  });

  it('solo quien registró un pago puede eliminarlo', async () => {
    state.settlements = [{ id: 's1', petId: 'pet-1', amount: 1000, createdBy: 'otro' }, { id: 's2', petId: 'pet-1', amount: 1000, createdBy: 'yo' }];
    window.sb = { from: () => ({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }) };
    await deleteSettlement('s1');
    expect(state.settlements).toHaveLength(2);
    expect(window.showToast).toHaveBeenCalledWith('Solo quien registró un pago puede eliminarlo', 'error');
    await deleteSettlement('s2');
    expect(state.settlements.map(s => s.id)).toEqual(['s1']);
  });

  it('al elegir una mascota que reparte gastos, el modal avisa que el otro tutor lo verá', () => {
    openExpenseModal();
    document.getElementById('ex-pet').value = 'pet-1';
    onExpensePetChange();
    const note = document.getElementById('ex-split-note');
    expect(note.classList.contains('hidden')).toBe(false);
    expect(note.textContent).toContain('Pedro');
    document.getElementById('ex-pet').value = '';
    onExpensePetChange();
    expect(note.classList.contains('hidden')).toBe(true);
  });
});
