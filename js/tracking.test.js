import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
import '../js/app.js'; // deja canEditPet/blockIfReadOnly reales en window
import { setBCS, saveWeight, deleteWeight, weightSeries } from './tracking.js';

// Regresión: setBCS() solo mutaba el estado en memoria y llamaba a
// saveState() (que solo persiste user/isLoggedIn, no las mascotas) — el
// puntaje de condición corporal nunca llegaba a Supabase, así que se veía
// guardado en la sesión actual pero desaparecía en la próxima carga.
describe('setBCS', () => {
  let pet;

  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    pet = { id: 'pet-1', myRole: 'owner', bcs: null };
    window.state = { pets: [pet] };
  });

  it('persiste el puntaje en la tabla pets, no solo en memoria', async () => {
    window.sb = makeMockSb({ pets: { data: null, error: null } });
    await setBCS('pet-1', 6);
    expect(pet.bcs).toBe(6);
    const updatePayload = window.sb.from.mock.results[0].value.update.mock.calls[0][0];
    expect(updatePayload).toEqual({ bcs: 6 });
  });

  it('si Supabase falla, muestra el toast y no cambia el estado local', async () => {
    window.sb = makeMockSb({ pets: { data: null, error: { message: 'boom' } } });
    await setBCS('pet-1', 6);
    expect(pet.bcs).toBeNull();
    expect(window.showToast).toHaveBeenCalledWith('Error al guardar', 'error');
  });

  it('no llama a Supabase si el tutor tiene acceso de solo lectura', async () => {
    pet.myRole = 'viewer';
    window.sb = makeMockSb();
    await setBCS('pet-1', 6);
    expect(window.sb.from).not.toHaveBeenCalled();
    expect(pet.bcs).toBeNull();
  });
});

// Regresión: a diferencia de saveMood/saveSymptoms, saveWeight() nunca
// chequeaba isDemoUser() — en modo demo intentaba escribir en Supabase real
// con un pet_id que no existe ahí (ej. "pet-greta"), fallando siempre con
// "Error al guardar peso" en vez de guardar localmente como el resto de
// los registros en modo demo.
describe('saveWeight', () => {
  let pet;

  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    pet = { id: 'pet-greta', myRole: 'owner', weightHistory: [] };
    window.state = { pets: [pet] };
    document.body.innerHTML = `
      <input id="wt-kg" value="12" />
      <input id="wt-gr" value="500" />
      <input id="wt-date" value="2026-06-15" />
    `;
  });

  it('en modo demo, guarda localmente sin llamar a Supabase', async () => {
    window.isDemoUser = vi.fn(() => true);
    window.sb = makeMockSb();
    await saveWeight({ preventDefault: () => {} }, 'pet-greta');
    expect(window.sb.from).not.toHaveBeenCalled();
    expect(pet.weightHistory).toHaveLength(1);
    expect(pet.weightHistory[0]).toMatchObject({ kg: 12, gr: 500 });
    expect(window.showToast).toHaveBeenCalledWith('Peso registrado ✓', 'success');
  });

  it('con usuario real, guarda vía Supabase', async () => {
    window.isDemoUser = vi.fn(() => false);
    window.sb = makeMockSb({
      weight_history: { data: { id: 'w1', date: '2026-06-15', kg: 12, gr: 500, notes: null }, error: null },
    });
    await saveWeight({ preventDefault: () => {} }, 'pet-greta');
    expect(pet.weightHistory).toHaveLength(1);
    expect(pet.weightHistory[0].id).toBe('w1');
  });

  it('no llama a Supabase si el tutor tiene acceso de solo lectura', async () => {
    window.isDemoUser = vi.fn(() => false);
    pet.myRole = 'viewer';
    window.sb = makeMockSb();
    await saveWeight({ preventDefault: () => {} }, 'pet-greta');
    expect(window.sb.from).not.toHaveBeenCalled();
    expect(pet.weightHistory).toHaveLength(0);
  });
});

describe('peso: serie del gráfico y eliminar mediciones', () => {
  const pet = (over = {}) => ({ id: 'pet-1', myRole: 'owner', weightKg: '6', weightGr: '500',
    weightHistory: [{ id: 'w1', date: '2026-09-25', kg: 6, gr: 800 }, { id: 'w0', date: '2026-08-01', kg: 6, gr: 200 }], ...over });

  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.isDemoUser = vi.fn(() => false);
  });

  it('el peso de la ficha entra como primer punto "Ficha" y las mediciones van en orden de fecha', () => {
    const rows = weightSeries(pet());
    expect(rows.map(r => r.label)).toEqual(['Ficha', '01-08-2026', '25-09-2026']);
    expect(rows.map(r => r.kg)).toEqual([6.5, 6.2, 6.8]);
    expect(rows[0].real).toBe(false);
    expect(rows[1].real).toBe(true);
  });

  it('sin mediciones no hay serie (la pestaña muestra solo el peso de la ficha)', () => {
    expect(weightSeries(pet({ weightHistory: [] }))).toEqual([]);
  });

  it('sin peso en la ficha, la serie son solo las mediciones', () => {
    expect(weightSeries(pet({ weightKg: '', weightGr: '' })).every(r => r.real)).toBe(true);
  });

  it('eliminar una medición la borra en Supabase y del estado', async () => {
    const p = pet();
    window.state = { pets: [p] };
    window.sb = makeMockSb({ weight_history: { data: null, error: null } });
    await deleteWeight('pet-1', 'w1');
    expect(p.weightHistory.map(h => h.id)).toEqual(['w0']);
    expect(window.showToast).toHaveBeenCalledWith('Medición eliminada', 'success');
  });

  it('si Supabase falla, no la quita del estado y avisa', async () => {
    const p = pet();
    window.state = { pets: [p] };
    window.sb = makeMockSb({ weight_history: { data: null, error: { message: 'boom' } } });
    await deleteWeight('pet-1', 'w1');
    expect(p.weightHistory).toHaveLength(2);
    expect(window.showToast).toHaveBeenCalledWith('Error al eliminar la medición', 'error');
  });

  it('el peso de la ficha solo aparece como punto "Ficha" si nunca estuvo en el historial', () => {
    const conFicha = weightSeries(pet({ weightKg: '6', weightGr: '500' })); // 6,5 no está en el historial
    expect(conFicha[0].label).toBe('Ficha');
    const sincronizada = weightSeries(pet({ weightKg: 6, weightGr: 800 })); // = última medición
    expect(sincronizada.every(r => r.real)).toBe(true);
  });

  it('al registrar un peso, la ficha pasa a mostrar el peso nuevo y el inicial queda como medición', async () => {
    const p = pet({ weightHistory: [], createdAt: '2026-05-01T10:00:00Z' });
    window.state = { pets: [p] };
    window.closeModal = vi.fn();
    window.track = vi.fn();
    document.body.innerHTML = '<input id="wt-kg" value="7" /><input id="wt-gr" value="100" /><input id="wt-date" value="2026-09-25" />';
    window.sb = { from: vi.fn(table => ({
      insert: vi.fn(row => ({ select: () => ({ single: () => Promise.resolve({ data: { id: `${table}-${row.date}`, ...row }, error: null }) }) })),
      update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
    })) };
    await saveWeight({ preventDefault() {} }, 'pet-1');
    expect(p.weightHistory.map(h => `${h.date}:${h.kg}.${h.gr}`)).toEqual(['2026-05-01:6.500', '2026-09-25:7.100']);
    expect(p.weightKg).toBe(7);
    expect(p.weightGr).toBe(100);
  });

  it('si el peso de la ficha ya está en el historial no se duplica', async () => {
    const p = pet({ weightKg: '6', weightGr: '800' }); // igual a la medición w1
    window.state = { pets: [p] };
    window.closeModal = vi.fn();
    window.track = vi.fn();
    document.body.innerHTML = '<input id="wt-kg" value="7" /><input id="wt-gr" value="0" /><input id="wt-date" value="2026-09-30" />';
    window.sb = { from: vi.fn(table => ({
      insert: vi.fn(row => ({ select: () => ({ single: () => Promise.resolve({ data: { id: `${table}-${row.date}`, ...row }, error: null }) }) })),
      update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
    })) };
    await saveWeight({ preventDefault() {} }, 'pet-1');
    expect(p.weightHistory).toHaveLength(3);
  });

  it('al eliminar la última medición, la ficha vuelve al peso de la anterior', async () => {
    const p = pet({ weightKg: 6, weightGr: 800 });
    window.state = { pets: [p] };
    window.sb = { from: vi.fn(() => ({
      delete: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
      update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
    })) };
    await deleteWeight('pet-1', 'w1');
    expect(p.weightKg).toBe(6);
    expect(p.weightGr).toBe(200);
  });

  it('un tutor de solo lectura no puede eliminar mediciones', async () => {
    const p = pet({ myRole: 'viewer' });
    window.state = { pets: [p] };
    window.sb = makeMockSb({ weight_history: { data: null, error: null } });
    await deleteWeight('pet-1', 'w1');
    expect(p.weightHistory).toHaveLength(2);
    expect(window.sb.from).not.toHaveBeenCalled();
  });
});
