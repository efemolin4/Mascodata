import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
import '../js/app.js';
import '../js/pets.js';
import { medRunOutDate, medDaysFromQuantity, medSupplyStatus, addDays, todayStr } from './utils.js';
import { saveMedPurchase, deleteMedPurchase, openMedPurchaseModal, tabMedications } from './medications-history.js';
import { viewDashboard } from './dashboard.js';
import { getFinanceExpenses } from './data.js';

const d = off => addDays(todayStr(), off);
const med = over => ({ id: 'm1', name: 'Gotas de CBD', active: true, startDate: d(-60), freqN: 24, freqUnit: 'horas', doseVal: '3', doseUnit: 'gotas', stockUnit: 'Frascos', purchases: [], ...over });

describe('cuándo se acaba un tratamiento de uso continuo', () => {
  it('una compra: fecha + días que alcanza', () => {
    expect(medRunOutDate(med({ purchases: [{ id: 'a', date: '2026-06-01', daysSupply: 30 }] }))).toBe('2026-07-01');
  });
  it('comprar antes de que se acabe suma a lo que sobraba', () => {
    const m = med({ purchases: [{ id: 'a', date: '2026-06-01', daysSupply: 30 }, { id: 'b', date: '2026-06-20', daysSupply: 30 }] });
    expect(medRunOutDate(m)).toBe('2026-07-31'); // 1-jul + 30
  });
  it('comprar después de que se acabó parte desde la nueva compra', () => {
    const m = med({ purchases: [{ id: 'a', date: '2026-06-01', daysSupply: 10 }, { id: 'b', date: '2026-07-01', daysSupply: 30 }] });
    expect(medRunOutDate(m)).toBe('2026-07-31');
  });
  it('sin días en las compras no se estima nada', () => {
    expect(medRunOutDate(med({ purchases: [{ id: 'a', date: '2026-06-01', daysSupply: null }] }))).toBeNull();
    expect(medSupplyStatus(med())).toBeNull();
  });
  it('estado: crítico, bajo y ok según los días que quedan', () => {
    const st = n => medSupplyStatus(med({ purchases: [{ id: 'a', date: d(-30 + n), daysSupply: 30 }] }));
    expect(st(2).level).toBe('critico');
    expect(st(6).level).toBe('bajo');
    expect(st(20).level).toBe('ok');
    expect(st(0).label).toBe('Se acaba hoy');
  });
  it('un tratamiento terminado, o que alcanza hasta su fin, no avisa', () => {
    expect(medSupplyStatus(med({ active: false, purchases: [{ id: 'a', date: d(-30), daysSupply: 31 }] }))).toBeNull();
    expect(medSupplyStatus(med({ endDate: d(1), purchases: [{ id: 'a', date: d(-30), daysSupply: 31 }] }))).toBeNull();
  });
  it('los días salen de la cantidad solo si dosis y stock están en la misma unidad', () => {
    expect(medDaysFromQuantity(med({ doseUnit: 'Comprimido(s)', stockUnit: 'Comprimidos', doseVal: '1' }), 30)).toBe(30);
    expect(medDaysFromQuantity(med(), 1)).toBeNull(); // gotas vs frascos: no se adivina
  });
});

describe('Finanzas: cada compra es un gasto y no se cuenta doble', () => {
  beforeEach(() => { window.state.user = { id: 'u1' }; window.state.botiquin = []; });
  const gastos = pet => { window.state.pets = [pet]; return getFinanceExpenses().filter(e => e.source === 'medication'); };
  it('sin compras cuenta el costo del tratamiento', () => {
    const r = gastos({ id: 'p', name: 'Greta', medications: [med({ cost: 18000 })] });
    expect(r.map(e => e.amount)).toEqual([18000]);
  });
  it('con compras cuenta cada compra y ya no el costo del tratamiento', () => {
    const r = gastos({ id: 'p', name: 'Greta', medications: [med({ cost: 18000, purchases: [{ id: 'a', date: d(-30), price: 18000 }, { id: 'b', date: d(-1), price: 19000 }] })] });
    expect(r.map(e => e.amount)).toEqual([18000, 19000]);
    expect(r.every(e => e.category === 'Medicamentos' && e.description.startsWith('Compra:'))).toBe(true);
  });
});

describe('saveMedPurchase', () => {
  let pet;
  beforeEach(() => {
    window.showToast = vi.fn(); window.render = vi.fn(); window.closeModal = vi.fn(); window.isDemoUser = vi.fn(() => false); window.track = vi.fn();
    window.state.user = { id: 'u1', name: 'Ana' };
    pet = { id: 'pet-1', name: 'Greta', myRole: 'owner', medications: [med({ cost: 18000 })] };
    window.state.pets = [pet];
    document.body.innerHTML = `<input id="mp-price" value="19.000"><input id="mp-date" value="${d(0)}"><input id="mp-days" value="30"><input id="mp-qty" value="">`;
  });
  const run = () => saveMedPurchase({ preventDefault: () => {} }, 'pet-1', 'm1');
  const insertedRows = () => window.sb.from.mock.results[0].value.insert.mock.calls[0][0];

  it('guarda la compra y, si el tratamiento tenía costo, lo convierte en la primera compra (sin duplicar)', async () => {
    window.sb = makeMockSb({ medication_purchases: { data: [{ id: 'x1', purchase_date: d(-60), price: 18000 }, { id: 'x2', purchase_date: d(0), price: 19000, days_supply: 30 }], error: null } });
    await run();
    const rows = insertedRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ price: 18000, purchase_date: d(-60), days_supply: null });
    expect(rows[1]).toMatchObject({ price: 19000, days_supply: 30, med_id: 'm1', pet_id: 'pet-1' });
    expect(pet.medications[0].purchases).toHaveLength(2);
    expect(window.showToast).toHaveBeenCalledWith('Compra registrada', 'success');
  });

  it('exige el precio y rechaza una fecha futura', async () => {
    window.sb = makeMockSb({});
    document.getElementById('mp-price').value = '';
    await run();
    expect(window.showToast).toHaveBeenCalledWith('Ingresa el precio pagado', 'error');
    document.getElementById('mp-price').value = '1000'; document.getElementById('mp-date').value = d(3);
    await run();
    expect(window.showToast).toHaveBeenCalledWith('La fecha de compra no puede ser futura', 'error');
    expect(window.sb.from).not.toHaveBeenCalled();
  });

  it('si la base falla no agrega nada a la pantalla', async () => {
    window.sb = makeMockSb({ medication_purchases: { data: null, error: { message: 'boom' } } });
    await run();
    expect(pet.medications[0].purchases).toHaveLength(0);
    expect(window.showToast).toHaveBeenCalledWith('No se pudo guardar la compra', 'error');
  });

  it('un lector no puede registrar compras', () => {
    pet.myRole = 'viewer'; window.sb = makeMockSb({}); window.openModal = vi.fn(); document.body.innerHTML = '';
    openMedPurchaseModal('pet-1', 'm1');
    expect(document.querySelector('.toast')?.textContent).toContain('solo lectura');
    expect(window.openModal).not.toHaveBeenCalled();
  });

  it('eliminar una compra la quita de la lista', async () => {
    pet.medications[0].purchases = [{ id: 'a' }, { id: 'b' }];
    window.sb = makeMockSb({ medication_purchases: { data: null, error: null } });
    await deleteMedPurchase('pet-1', 'm1', 'a');
    expect(pet.medications[0].purchases.map(p => p.id)).toEqual(['b']);
  });
});

describe('panel y ficha', () => {
  beforeEach(() => {
    window.state.user = { id: 'u1', name: 'Ana Pérez' }; window.state.events = []; window.state.dashAttnAll = false;
    window.getFinanceExpenses = () => [];
  });
  const petWith = (m, over = {}) => ({ id: 'pet-1', name: 'Greta', species: 'Perro', myRole: 'owner', dateOfBirth: '2021-01-01', vet: { name: 'Dra' }, vaccines: [], deworming: [], medications: [m], ...over });

  it('cuando queda poco, "Necesita atención" avisa y ofrece "Compré de nuevo"', () => {
    window.state.pets = [petWith(med({ purchases: [{ id: 'a', date: d(-27), daysSupply: 30, price: 18000 }] }))];
    const html = viewDashboard();
    expect(html).toContain('Se acaba · Gotas de CBD');
    expect(html).toContain('Compré de nuevo');
    expect(html).toContain("openMedPurchaseModal('pet-1','m1')");
  });

  it('un lector ve el aviso pero lo lleva al tratamiento, sin comprar', () => {
    window.state.pets = [petWith(med({ purchases: [{ id: 'a', date: d(-27), daysSupply: 30, price: 18000 }] }), { myRole: 'viewer' })];
    const html = viewDashboard();
    expect(html).toContain('Ver tratamiento');
    expect(html).not.toContain('openMedPurchaseModal');
  });

  it('con stock de sobra no aparece en el panel', () => {
    window.state.pets = [petWith(med({ purchases: [{ id: 'a', date: d(-2), daysSupply: 30, price: 18000 }] }))];
    expect(viewDashboard()).not.toContain('Se acaba · Gotas de CBD');
  });

  it('la ficha muestra cuándo se acaba, las compras y el botón solo a quien edita', () => {
    const m = med({ purchases: [{ id: 'a', date: d(-27), daysSupply: 30, price: 18000 }] });
    const owner = tabMedications(petWith(m));
    expect(owner).toContain('Compré de nuevo');
    expect(owner).toContain('alcanza 30 días');
    const viewer = tabMedications(petWith(m, { myRole: 'viewer' }));
    expect(viewer).not.toContain('Compré de nuevo');
    expect(viewer).not.toContain('deleteMedPurchase');
  });
});
