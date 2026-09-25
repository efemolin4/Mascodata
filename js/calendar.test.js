import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../js/utils.js';
import '../js/app.js'; // deja canEditPet/appShell/icon reales en window
import '../js/data.js'; // deja getAgendaEvents real en window
import { viewCalendar, openEventModal, onEventTypeChange, onRepeatChange, saveEvent, deleteEvent, deleteFutureStays } from './calendar.js';

const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const ownerPet = (over = {}) => ({ id: 'p1', name: 'Greta', myRole: 'owner', careMode: 'separated', tutor2: { name: 'Pedro', pending: false }, ...over });
const insertMock = (capture) => ({ from: vi.fn(() => ({
  insert: vi.fn(row => { capture.row = row; return { select: () => Promise.resolve({ data: (Array.isArray(row) ? row : [row]).map((r, i) => ({ id: `new${i}`, ...r })), error: null }) }; }),
  delete: vi.fn(() => { const q = { eq: () => q, gte: () => q, then: (ok, ko) => Promise.resolve({ error: null }).then(ok, ko) }; return q; }),
})) });

beforeEach(() => {
  window.showToast = vi.fn();
  window.render = vi.fn();
  window.closeModal = vi.fn();
  window.isDemoUser = vi.fn(() => false);
  window.state = { user: { id: 'u1' }, pets: [ownerPet()], events: [] };
  document.body.innerHTML = '<div id="modal-root"></div>';
  window.openModal = html => { document.getElementById('modal-root').innerHTML = html; };
  try { localStorage.clear(); } catch (e) {}
});

const fillStay = (over = {}) => {
  document.getElementById('ev-type').value = 'Estadía';
  onEventTypeChange();
  document.getElementById('ev-pet').value = 'p1';
  window.onEventPetChange?.();
  document.getElementById('ev-date').value = over.date ?? '2026-10-10';
  document.getElementById('ev-end').value = over.end ?? '2026-10-14';
  if (over.holder) document.getElementById('ev-holder').value = over.holder;
};

describe('modal de evento — estadías', () => {
  it('"Estadía" solo aparece si hay una mascota con otro tutor en modalidad separados', () => {
    openEventModal();
    expect(document.getElementById('ev-type').innerHTML).toContain('Estadía');
    window.state.pets = [ownerPet({ careMode: 'together' })];
    openEventModal();
    expect(document.getElementById('ev-type').innerHTML).not.toContain('Estadía');
    window.state.pets = [ownerPet({ tutor2: null })];
    openEventModal();
    expect(document.getElementById('ev-type').innerHTML).not.toContain('Estadía');
  });

  it('un tutor de solo lectura no puede crear eventos con la mascota', () => {
    window.state.pets = [ownerPet({ myRole: 'viewer' })];
    openEventModal();
    expect(document.getElementById('ev-pet').innerHTML).not.toContain('Greta');
  });

  it('al elegir Estadía se limita la mascota, se piden fin y responsable y se ocultan título y hora', () => {
    window.state.pets = [ownerPet(), ownerPet({ id: 'p2', name: 'Luna', careMode: 'together' })];
    openEventModal();
    document.getElementById('ev-type').value = 'Estadía';
    onEventTypeChange();
    expect([...document.getElementById('ev-pet').options].map(o => o.textContent)).toEqual(['Greta']);
    expect(document.getElementById('ev-stay').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('ev-title-wrap').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('ev-title').required).toBe(false);
    expect([...document.getElementById('ev-holder').options].map(o => o.textContent)).toEqual(['Conmigo', 'Con Pedro']);
  });
});

describe('saveEvent — estadía', () => {
  it('el dueño guarda una estadía con el otro tutor: holder "guest", fin y sin hora', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ holder: 'other' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row).toMatchObject({ user_id: 'u1', pet_id: 'p1', type: 'Estadía', title: 'Estadía', date: '2026-10-10', end_date: '2026-10-14', holder: 'guest', time: null });
    expect(window.state.events[0]).toMatchObject({ endDate: '2026-10-14', holder: 'guest', userId: 'u1' });
  });

  it('"Conmigo" guarda el rol de quien crea: dueño → owner, invitado → guest', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ holder: 'me' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row.holder).toBe('owner');
    window.state.pets = [ownerPet({ myRole: 'editor' })];
    openEventModal(); fillStay({ holder: 'me' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row.holder).toBe('guest');
  });

  it('rechaza una estadía sin fin o con fin anterior al inicio', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ end: '2026-10-09' });
    await saveEvent({ preventDefault() {} });
    expect(window.showToast).toHaveBeenCalledWith('La fecha de fin debe ser igual o posterior al inicio', 'error');
    expect(cap.row).toBeUndefined();
  });

  it('si la base aún no tiene las columnas nuevas, avisa que falta actualizarla', async () => {
    window.sb = { from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: null, error: { message: "Could not find the 'end_date' column of 'events'" } }) }) }) };
    openEventModal(); fillStay();
    await saveEvent({ preventDefault() {} });
    expect(window.showToast).toHaveBeenCalledWith('Falta actualizar la base de datos para usar estadías', 'error');
    expect(window.state.events).toHaveLength(0);
  });

  it('un evento normal no envía columnas de estadía', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal();
    document.getElementById('ev-title').value = 'Control';
    document.getElementById('ev-date').value = '2026-10-10';
    await saveEvent({ preventDefault() {} });
    expect(cap.row).not.toHaveProperty('end_date');
    expect(cap.row).not.toHaveProperty('holder');
  });
});

describe('estadías recurrentes', () => {
  const setRepeat = (mode, over = {}) => {
    document.getElementById('ev-repeat').value = mode;
    onRepeatChange();
    if (over.every) document.getElementById('ev-every').value = String(over.every);
    if (over.until) document.getElementById('ev-until').value = over.until;
  };

  it('al elegir un patrón se ocultan "Hasta" y aparecen la repetición y su fin', () => {
    openEventModal(); fillStay();
    setRepeat('alternate');
    expect(document.getElementById('ev-end-wrap').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('ev-every-wrap').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('ev-until-wrap').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('ev-holder-label').textContent).toBe('Empieza con');
    setRepeat('weekends');
    expect(document.getElementById('ev-every-wrap').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('ev-holder-label').textContent).toBe('Los fines de semana con');
    setRepeat('none');
    expect(document.getElementById('ev-end-wrap').classList.contains('hidden')).toBe(false);
  });

  it('alternar turnos crea todas las estadías de una vez, con los responsables alternados', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ date: '2026-10-05', holder: 'me' });
    setRepeat('alternate', { every: 7, until: '2026-10-25' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row.map(r => `${r.date}→${r.end_date}:${r.holder}`)).toEqual(['2026-10-05→2026-10-11:owner', '2026-10-12→2026-10-18:guest', '2026-10-19→2026-10-25:owner']);
    expect(window.state.events).toHaveLength(3);
    expect(window.showToast).toHaveBeenCalledWith('Se crearon 3 estadías', 'success');
  });

  it('los fines de semana se crean de viernes a domingo con el responsable elegido', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ date: '2026-10-05', holder: 'other' });
    setRepeat('weekends', { until: '2026-10-18' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row.map(r => `${r.date}→${r.end_date}:${r.holder}`)).toEqual(['2026-10-09→2026-10-11:guest', '2026-10-16→2026-10-18:guest']);
  });

  it('no duplica ni pisa estadías que ya existen en esas fechas', async () => {
    window.state.events = [{ id: 'x', type: 'Estadía', petId: 'p1', date: '2026-10-12', endDate: '2026-10-14', holder: 'guest' }];
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ date: '2026-10-05', holder: 'me' });
    setRepeat('alternate', { every: 7, until: '2026-10-25' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row.map(r => r.date)).toEqual(['2026-10-05', '2026-10-19']);
    expect(window.showToast).toHaveBeenCalledWith('Se crearon 2 estadías (1 ya existían y se omitieron)', 'success');
  });

  it('si todas las fechas ya tienen estadía, no crea nada', async () => {
    window.state.events = [{ id: 'x', type: 'Estadía', petId: 'p1', date: '2026-10-01', endDate: '2026-11-30', holder: 'guest' }];
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ date: '2026-10-05' });
    setRepeat('alternate', { until: '2026-10-25' });
    await saveEvent({ preventDefault() {} });
    expect(cap.row).toBeUndefined();
    expect(window.showToast).toHaveBeenCalledWith('Ya hay estadías registradas en todas esas fechas', 'error');
  });

  it('exige hasta cuándo se repite, y no más de un año', async () => {
    const cap = {}; window.sb = insertMock(cap);
    openEventModal(); fillStay({ date: '2026-10-05' });
    setRepeat('weekends');
    await saveEvent({ preventDefault() {} });
    expect(window.showToast).toHaveBeenCalledWith('Indica hasta cuándo se repite (igual o posterior al inicio)', 'error');
    setRepeat('weekends', { until: '2028-01-01' });
    await saveEvent({ preventDefault() {} });
    expect(window.showToast).toHaveBeenCalledWith('Los turnos pueden repetirse hasta por un año', 'error');
    expect(cap.row).toBeUndefined();
  });
});

describe('deleteFutureStays', () => {
  it('quita las estadías que no terminaron y conserva las cumplidas y las de otras mascotas', async () => {
    window.confirm = vi.fn(() => true);
    window.state.events = [
      { id: 'a', type: 'Estadía', petId: 'p1', date: day(-20), endDate: day(-10) },
      { id: 'b', type: 'Estadía', petId: 'p1', date: day(-1), endDate: day(2) },
      { id: 'c', type: 'Estadía', petId: 'p1', date: day(5), endDate: day(8) },
      { id: 'd', type: 'Estadía', petId: 'p2', date: day(5), endDate: day(8) },
      { id: 'e', type: 'Consulta', petId: 'p1', date: day(5) },
    ];
    window.sb = insertMock({});
    await deleteFutureStays('p1');
    expect(window.state.events.map(e => e.id)).toEqual(['a', 'd', 'e']);
  });

  it('no hace nada si el usuario cancela o no puede editar la mascota', async () => {
    window.state.events = [{ id: 'b', type: 'Estadía', petId: 'p1', date: day(1), endDate: day(2) }];
    window.confirm = vi.fn(() => false);
    window.sb = insertMock({});
    await deleteFutureStays('p1');
    expect(window.state.events).toHaveLength(1);
    window.confirm = vi.fn(() => true);
    window.state.pets = [ownerPet({ myRole: 'viewer' })];
    await deleteFutureStays('p1');
    expect(window.state.events).toHaveLength(1);
  });
});

describe('deleteEvent — permisos', () => {
  const ev = (over = {}) => ({ id: 'e1', title: 'x', date: '2026-10-10', type: 'Consulta', petId: 'p1', userId: 'otro', ...over });

  it('un tutor que puede editar la mascota borra eventos de otro tutor', async () => {
    window.state.events = [ev()];
    window.sb = insertMock({});
    await deleteEvent('e1');
    expect(window.state.events).toHaveLength(0);
  });

  it('un tutor de solo lectura no puede borrar un evento ajeno', async () => {
    window.state.pets = [ownerPet({ myRole: 'viewer' })];
    window.state.events = [ev()];
    window.sb = insertMock({});
    await deleteEvent('e1');
    expect(window.state.events).toHaveLength(1);
    expect(window.showToast).toHaveBeenCalledWith('No tienes permiso para eliminar este evento', 'error');
  });

  it('un evento propio siempre se puede borrar', async () => {
    window.state.pets = [ownerPet({ myRole: 'viewer' })];
    window.state.events = [ev({ userId: 'u1' })];
    window.sb = insertMock({});
    await deleteEvent('e1');
    expect(window.state.events).toHaveLength(0);
  });
});

describe('viewCalendar — estadías y aviso', () => {
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  it('una estadía de varios días aparece en cada día del rango, con quién tiene la mascota', () => {
    window.state.events = [{ id: 's', type: 'Estadía', title: 'Estadía', petId: 'p1', pet: 'Greta', date: `${first}-10`, endDate: `${first}-12`, holder: 'guest', userId: 'u1' }];
    const html = viewCalendar();
    expect((html.match(/>\s*Con Pedro</g) || []).length).toBeGreaterThanOrEqual(3); // una celda por día
  });

  it('la lista de próximos eventos muestra una estadía en curso con la versión completa y su rango', () => {
    window.state.events = [{ id: 's', type: 'Estadía', title: 'Estadía', petId: 'p1', pet: 'Greta', date: day(-1), endDate: day(2), holder: 'guest', userId: 'u1' }];
    window.state.calViewMode = 'lista';
    const html = viewCalendar();
    window.state.calViewMode = 'calendario';
    expect(html).toContain('Estadía con Pedro');
    expect(html).toContain('→');
  });

  it('el aviso de agenda compartida aparece si hay otro tutor y se puede descartar', () => {
    expect(viewCalendar()).toContain('ahora los ven todos sus tutores');
    localStorage.setItem('mascodata-shared-events-notice', '1');
    expect(viewCalendar()).not.toContain('ahora los ven todos sus tutores');
  });

  it('sin otro tutor no hay aviso', () => {
    window.state.pets = [ownerPet({ tutor2: null })];
    expect(viewCalendar()).not.toContain('ahora los ven todos sus tutores');
  });
});
