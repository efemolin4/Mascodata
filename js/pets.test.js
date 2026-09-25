import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js'; // deja esc/icon/fmtCLP/formatDate reales en window
import '../js/app.js'; // deja canEditPet/blockIfReadOnly reales en window
import '../js/tracking.js'; // deja recordWeight real en window (saveEditPet lo usa)
import { savePet, deletePet, openInviteTutor2Modal, exportPetRecord, printPetRecord, saveEditPet, petActivityCard } from './pets.js';

// savePet() lee/escribe sobre `state`, `sb`, etc. como globales (ver
// js/utils.js para el porqué de esa convención) — acá se los proveemos a
// mano en window, sin cargar toda la app, para poder probar la lógica de
// guardado (límite de plan, inserción, rollback si falla pet_access) de
// forma aislada.
describe('savePet', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.navigate = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    window.createPetInvite = vi.fn(async () => {});
    // PLANS: el real, expuesto por el import de js/app.js de arriba — no se
    // mano-copia acá para no desincronizarse de nuevo si el modelo de planes
    // vuelve a cambiar.
    window.state = {
      user: { id: 'user-1', plan: 'premium' },
      pets: [],
      newPetData: { name: 'Rex', species: 'Perro' },
      addPetStep: 4,
    };
  });

  it('no guarda si falta el nombre, y no llama a Supabase', async () => {
    window.state.newPetData = {};
    window.sb = makeMockSb();
    await savePet();
    expect(window.showToast).toHaveBeenCalledWith('El nombre es requerido', 'error');
    expect(window.state.addPetStep).toBe(1);
    expect(window.sb.from).not.toHaveBeenCalled();
  });

  it('respeta el límite de mascotas del plan Free (1) y no llama a Supabase', async () => {
    window.state.user.plan = 'free';
    window.state.pets = [{ id: 'existing' }]; // ya en el límite de "free" (1)
    window.sb = makeMockSb();
    await savePet();
    expect(window.showToast).toHaveBeenCalledWith(expect.stringContaining('Free'), 'error');
    expect(window.sb.from).not.toHaveBeenCalled();
    expect(window.state.pets).toHaveLength(1);
  });

  it('el plan Premium no tiene tope de mascotas: guarda aunque ya tenga muchas', async () => {
    window.state.user.plan = 'premium';
    window.state.pets = Array.from({ length: 25 }, (_, i) => ({ id: `pet-${i}` }));
    window.sb = makeMockSb({
      pets: { data: { id: 'new-pet' }, error: null },
      pet_access: { data: null, error: null },
    });
    await savePet();
    expect(window.showToast).not.toHaveBeenCalledWith(expect.stringContaining('permite'), 'error');
    expect(window.sb.from).toHaveBeenCalled();
  });

  it('inserta la mascota y su fila de pet_access, y navega a la ficha', async () => {
    window.sb = makeMockSb({
      pets: { data: { id: 'pet-99' }, error: null },
      pet_access: { data: null, error: null },
    });
    await savePet();
    expect(window.state.pets).toHaveLength(1);
    expect(window.state.pets[0]).toMatchObject({ id: 'pet-99', name: 'Rex', myRole: 'owner' });
    expect(window.navigate).toHaveBeenCalledWith('petProfile', { currentPetId: 'pet-99', currentTab: 'general' });
    expect(window.sb.from.mock.calls.map(c => c[0])).toEqual(['pets', 'pet_access']);
  });

  it('si falla el insert de la mascota, muestra error y no agrega nada al estado', async () => {
    window.sb = makeMockSb({ pets: { data: null, error: { message: 'boom' } } });
    await savePet();
    expect(window.showToast).toHaveBeenCalledWith('Error al guardar mascota', 'error');
    expect(window.state.pets).toHaveLength(0);
    expect(window.navigate).not.toHaveBeenCalled();
  });

  it('si falla el insert de pet_access, deshace (rollback) el insert de la mascota', async () => {
    window.sb = makeMockSb({
      pets: { data: { id: 'pet-99' }, error: null },
      pet_access: { data: null, error: { message: 'boom' } },
    });
    await savePet();
    expect(window.showToast).toHaveBeenCalledWith('Error al guardar mascota', 'error');
    expect(window.state.pets).toHaveLength(0);
    // 'pets' se llama dos veces: el insert original y el delete de rollback.
    expect(window.sb.from.mock.calls.map(c => c[0])).toEqual(['pets', 'pet_access', 'pets']);
  });
});

// Regresión: la rama se decidía por "¿existe un tutor2?" en vez de "¿soy el
// dueño?" — el dueño de una mascota con un tutor2 (aceptado O pendiente)
// entraba por error a la rama de "salir de mascota compartida", que nunca
// borra la fila `pets`, dejándola huérfana en Supabase para siempre.
describe('deletePet', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.navigate = vi.fn();
    window.closeModal = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    window.state = { user: { id: 'owner-1' }, pets: [], deleteCode: null, deletePetId: null };
  });

  it('el dueño con un tutor2 pendiente (invitación no aceptada) SÍ borra la fila de la mascota', async () => {
    const pet = { id: 'pet-1', name: 'Greta', myRole: 'owner', tutor2: { name: 'María', pending: true } };
    window.state.pets = [pet];
    window.sb = makeMockSb({ pets: { data: null, error: null } });
    await deletePet('pet-1');
    expect(window.sb.from.mock.calls.map(c => c[0])).toContain('pets');
    // Nunca debe entrar a la rama de "salir" (que solo toca invitations/pet_access).
    expect(window.sb.from.mock.calls.map(c => c[0])).not.toContain('invitations');
    expect(window.state.pets).toHaveLength(0);
  });

  it('el dueño con un tutor2 ya aceptado también borra la fila de la mascota', async () => {
    const pet = { id: 'pet-1', name: 'Greta', myRole: 'owner', tutor2: { name: 'María', pending: false } };
    window.state.pets = [pet];
    window.sb = makeMockSb({ pets: { data: null, error: null } });
    await deletePet('pet-1');
    expect(window.sb.from.mock.calls.map(c => c[0])).toEqual(['pets']);
  });

  it('un tutor invitado (no dueño) solo quita su propio acceso, no borra la mascota', async () => {
    const pet = { id: 'pet-1', name: 'Greta', myRole: 'editor', tutor2: null };
    window.state.pets = [pet];
    window.sb = makeMockSb({ invitations: { data: null, error: null }, pet_access: { data: null, error: null } });
    await deletePet('pet-1');
    expect(window.sb.from.mock.calls.map(c => c[0])).toEqual(['invitations', 'pet_access']);
    expect(window.showToast).toHaveBeenCalledWith('Greta eliminada de tu perfil', 'success');
  });

  it('un tutor de solo lectura (viewer) también puede salir de la mascota compartida', async () => {
    const pet = { id: 'pet-1', name: 'Greta', myRole: 'viewer', tutor2: null };
    window.state.pets = [pet];
    window.sb = makeMockSb({ invitations: { data: null, error: null }, pet_access: { data: null, error: null } });
    await deletePet('pet-1');
    expect(window.state.pets).toHaveLength(0);
  });
});

// Regresión/cobertura del nuevo gating por plan: segundo tutor y exportar
// expediente quedan detrás de Premium (ver js/app.js: blockIfNotPremium).
describe('gating Premium: segundo tutor y exportar expediente', () => {
  let pet;

  beforeEach(() => {
    window.openModal = vi.fn();
    pet = { id: 'pet-1', name: 'Greta', myRole: 'owner', vaccines: [], medications: [], clinicalHistory: [], vet: {} };
    window.state = { pets: [pet] };
  });

  it('openInviteTutor2Modal no abre el modal si blockIfNotPremium bloquea', () => {
    window.blockIfNotPremium = vi.fn(() => true);
    openInviteTutor2Modal('pet-1');
    expect(window.blockIfNotPremium).toHaveBeenCalledWith('Compartir con un segundo tutor');
    expect(window.openModal).not.toHaveBeenCalled();
  });

  it('openInviteTutor2Modal abre el modal cuando blockIfNotPremium no bloquea', () => {
    window.blockIfNotPremium = vi.fn(() => false);
    openInviteTutor2Modal('pet-1');
    expect(window.openModal).toHaveBeenCalled();
  });

  it('exportPetRecord no abre el modal si blockIfNotPremium bloquea', () => {
    window.blockIfNotPremium = vi.fn(() => true);
    exportPetRecord('pet-1');
    expect(window.blockIfNotPremium).toHaveBeenCalledWith('Exportar el expediente');
    expect(window.openModal).not.toHaveBeenCalled();
  });

  it('exportPetRecord abre el modal cuando blockIfNotPremium no bloquea', () => {
    window.blockIfNotPremium = vi.fn(() => false);
    window.todayStr = vi.fn(() => '2026-06-15');
    exportPetRecord('pet-1');
    expect(window.openModal).toHaveBeenCalled();
  });
});

// Regresión de la auditoría de seguridad: el nombre de la mascota (que puede
// editar otro tutor) iba dentro de un literal de JS en el onclick de "Imprimir".
// esc() no protege ahí porque el navegador decodifica las entidades antes de
// compilar el handler; ahora el onclick lleva solo el id.
describe('exportPetRecord/printPetRecord — nombre de mascota hostil', () => {
  const hostile = "');window.__x=1;//";
  let pet;
  beforeEach(() => {
    window.openModal = vi.fn();
    window.blockIfNotPremium = vi.fn(() => false);
    window.todayStr = vi.fn(() => '2026-06-15');
    pet = { id: 'pet-1', name: hostile, myRole: 'owner', vaccines: [], medications: [], clinicalHistory: [], vet: {} };
    window.state = { pets: [pet] };
  });

  it('el onclick de imprimir lleva solo el id de la mascota, nunca su nombre', () => {
    exportPetRecord('pet-1');
    const html = window.openModal.mock.calls[0][0];
    const onclick = html.match(/onclick="printPetRecord\(([^"]*)\)"/);
    expect(onclick[1]).toBe("'pet-1'");
  });

  it('un id con caracteres de JS queda reducido a un id inofensivo', () => {
    pet.id = "p');alert(1);//";
    exportPetRecord(pet.id);
    const html = window.openModal.mock.calls[0][0];
    expect(html.match(/onclick="printPetRecord\(([^"]*)\)"/)[1]).toBe("'palert1'");
  });

  it('printPetRecord busca el nombre en el estado y lo usa como título del documento', () => {
    let titleWhilePrinting;
    window.print = () => { titleWhilePrinting = document.title; };
    window.track = vi.fn();
    const before = document.title;
    printPetRecord('pet-1');
    expect(titleWhilePrinting).toBe(`Expediente médico - ${hostile}`);
    expect(document.title).toBe(before);
  });
});

describe('saveEditPet — el peso de la ficha también queda como medición', () => {
  const makeSb = () => {
    const inserted = [];
    const sb = { from: vi.fn(table => ({
      update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
      insert: vi.fn(row => { inserted.push({ table, row }); return { select: () => ({ single: () => Promise.resolve({ data: { id: `n${inserted.length}`, ...row }, error: null }) }) }; }),
    })) };
    return { sb, inserted };
  };
  const setup = (over = {}, wkg = '7', wgr = '200') => {
    const pet = { id: 'pet-1', myRole: 'owner', name: 'Greta', species: 'Perro', weightKg: '6', weightGr: '500', weightHistory: [], createdAt: '2026-05-01T10:00:00Z', ...over };
    window.state = { pets: [pet], editPetData: null };
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    window.track = vi.fn();
    const made = makeSb();
    window.sb = made.sb;
    document.body.innerHTML = `<input id="ep-wkg" value="${wkg}" /><input id="ep-wgr" value="${wgr}" />`;
    return { pet, ...made };
  };

  it('si cambia el peso, registra una medición de hoy y conserva el peso anterior como inicial', async () => {
    const { pet, inserted } = setup();
    await saveEditPet('pet-1');
    const rows = inserted.filter(i => i.table === 'weight_history').map(i => i.row);
    expect(rows.map(r => `${r.date === '2026-05-01' ? 'inicial' : 'hoy'}:${r.kg}.${r.gr}`)).toEqual(['inicial:6.500', 'hoy:7.200']);
    expect(pet.weightKg).toBe('7');
    expect(pet.weightGr).toBe('200');
  });

  it('si el peso no cambió, no registra ninguna medición', async () => {
    const { inserted } = setup({}, '6', '500');
    await saveEditPet('pet-1');
    expect(inserted.filter(i => i.table === 'weight_history')).toHaveLength(0);
  });

  it('si no se puede registrar la medición, guarda los cambios igual y avisa', async () => {
    const { pet } = setup();
    window.sb = { from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
      insert: vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }) })),
    })) };
    await saveEditPet('pet-1');
    expect(pet.weightKg).toBe('7');
    expect(window.showToast).toHaveBeenCalledWith('Cambios guardados, pero no se pudo registrar la medición de peso', 'error');
  });
});

describe('petActivityCard — actividad reciente de los tutores', () => {
  const pet = (over = {}) => ({ id: 'p1', name: 'Greta', tutor2: { name: 'Pedro' }, weightHistory: [{ date: '2026-09-20', kg: 12, gr: 500, createdBy: 'yo', createdByName: 'Ana' }],
    vaccines: [{ date: '2026-09-25', name: 'Antirrábica', createdBy: 'otro', createdByName: 'Pedro' }], ...over });
  beforeEach(() => { window.state = { user: { id: 'yo' }, events: [] }; });

  it('muestra quién hizo cada cosa, marcando "Tú" en lo propio', () => {
    const html = petActivityCard(pet());
    expect(html).toContain('Actividad reciente');
    expect(html).toContain('Pedro');
    expect(html).toContain('Vacuna: Antirrábica');
    expect(html).toContain('Tú');
    expect(html).toContain('Peso: 12,5 kg');
  });

  it('no aparece si la mascota no tiene otro tutor ni si no hay actividad', () => {
    expect(petActivityCard(pet({ tutor2: null }))).toBe('');
    expect(petActivityCard(pet({ weightHistory: [], vaccines: [] }))).toBe('');
  });

  it('escapa el nombre de quien registró y el texto del registro', () => {
    const html = petActivityCard(pet({ vaccines: [{ date: '2026-09-25', name: '<b>x</b>', createdBy: 'otro', createdByName: '<img src=x onerror=1>' }] }));
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>x</b>');
  });
});
