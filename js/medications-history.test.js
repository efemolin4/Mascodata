import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
import '../js/app.js';   // deja state/icon/esc/appShell/paginate/pagerHTML/blockIfReadOnly reales en window
import { tabHistory, tabMedications, markDoseTaken, saveEditMedication, removeHistoryFile, saveHistory, saveEditHistory } from './medications-history.js';

// Regresión: tabHistory y tabMedications ordenaban por .reverse() (orden de
// creación invertido), no por fecha real — un evento clínico cargado más
// tarde pero con fecha más vieja aparecía primero. Ver también el mismo fix
// en js/vaccines-dewormings.test.js para tabVaccines/tabDeworming.
describe('orden cronológico', () => {
  beforeEach(() => {
    window.state = { currentView: 'petProfile', pages: {}, user: null };
  });

  it('tabHistory muestra el evento más reciente primero, sin importar el orden en que se cargó', () => {
    const pet = { id: 'pet-1', clinicalHistory: [
      { id: 'h1', title: 'Control 2025', type: 'Diagnóstico', date: '2025-06-10' },
      { id: 'h2', title: 'Cirugía 2026', type: 'Cirugía', date: '2026-06-10' },
      { id: 'h3', title: 'Vacuna 2024', type: 'Otro', date: '2024-06-10' },
    ] };
    const html = tabHistory(pet);
    const i2026 = html.indexOf('Cirugía 2026');
    const i2025 = html.indexOf('Control 2025');
    const i2024 = html.indexOf('Vacuna 2024');
    expect(i2026).toBeGreaterThan(-1);
    expect(i2026).toBeLessThan(i2025);
    expect(i2025).toBeLessThan(i2024);
  });

  it('tabMedications muestra el tratamiento con inicio más reciente primero', () => {
    const pet = { id: 'pet-1', medications: [
      { id: 'm1', name: 'Tratamiento viejo', startDate: '2024-01-01' },
      { id: 'm2', name: 'Tratamiento nuevo', startDate: '2026-01-01' },
    ], doseLog: [] };
    const html = tabMedications(pet);
    expect(html.indexOf('Tratamiento nuevo')).toBeLessThan(html.indexOf('Tratamiento viejo'));
  });
});

// Regresión: el botón "Marcar dosis de hoy" es único por mascota (no por
// tratamiento) y antes asociaba el dose_log siempre al PRIMER medicamento
// activo del arreglo, sin importar cuál — con 2+ medicamentos activos a la
// vez, la dosis quedaba atribuida al que no correspondía.
describe('markDoseTaken', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.isDemoUser = vi.fn(() => false);
  });

  it('con un solo medicamento activo, la dosis se asocia a él sin ambigüedad', async () => {
    const pet = { id: 'pet-1', myRole: 'owner', doseLog: [],
      medications: [{ id: 'med-1', active: true }, { id: 'med-2', active: false }] };
    window.state = { pets: [pet] };
    window.sb = makeMockSb({ dose_logs: { data: { id: 'dl-1', med_id: 'med-1', date: '2026-06-15', confirmed: true }, error: null } });
    await markDoseTaken('pet-1');
    const insertPayload = window.sb.from.mock.results[0].value.insert.mock.calls[0][0];
    expect(insertPayload.med_id).toBe('med-1');
  });

  it('con dos o más medicamentos activos, NO le adivina el medicamento (queda sin asociar)', async () => {
    const pet = { id: 'pet-1', myRole: 'owner', doseLog: [],
      medications: [{ id: 'med-1', active: true }, { id: 'med-2', active: true }] };
    window.state = { pets: [pet] };
    window.sb = makeMockSb({ dose_logs: { data: { id: 'dl-1', med_id: null, date: '2026-06-15', confirmed: true }, error: null } });
    await markDoseTaken('pet-1');
    const insertPayload = window.sb.from.mock.results[0].value.insert.mock.calls[0][0];
    expect(insertPayload.med_id).toBeNull(); // antes: siempre 'med-1' (el primero), sin importar cuál correspondía
  });

  it('no llama a Supabase si el tutor tiene acceso de solo lectura', async () => {
    const pet = { id: 'pet-1', myRole: 'viewer', doseLog: [], medications: [{ id: 'med-1', active: true }] };
    window.state = { pets: [pet] };
    window.sb = makeMockSb();
    await markDoseTaken('pet-1');
    expect(window.sb.from).not.toHaveBeenCalled();
  });
});

// Regresión: al editar y borrar "Días de tratamiento" (dejarlo abierto/sin
// fecha de fin), la fecha de fin vieja se quedaba tal cual — tanto en el
// estado local como en el payload enviado a Supabase — porque el campo
// vacío se leía como 0 (no null) y el bloque que recalcula endDate nunca
// se ejecutaba para 0.
describe('saveEditMedication', () => {
  let pet, m;

  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    m = { id: 'med-1', name: 'Meloxicam', treatmentDays: 10, startDate: '2026-01-01', endDate: '2026-01-11' };
    pet = { id: 'pet-1', myRole: 'owner', medications: [m] };
    window.state = { pets: [pet] };

    document.body.innerHTML = `
      <input id="em-name" value="Meloxicam" />
      <input id="em-dose-val" value="1" />
      <select id="em-unit"><option value="mg" selected>mg</option></select>
      <input id="em-freq-n" value="24" />
      <select id="em-freq-unit"><option value="horas" selected>horas</option></select>
      <input id="em-start" value="2026-01-01" />
      <select id="em-start-time"><option value="08:00" selected>08:00</option></select>
      <input id="em-days" value="" />
      <input id="em-expiry" value="" />
      <input id="em-cost" value="" />
      <input type="hidden" id="em-reminder" value="exact" />
      <input type="checkbox" id="em-active" checked />
      <input id="em-stock-total" value="" />
      <select id="em-stock-unit"><option value="Comprimidos" selected>Comprimidos</option></select>
    `;
  });

  it('borrar "Días de tratamiento" limpia la fecha de fin en vez de dejar la vieja', async () => {
    window.sb = makeMockSb({ medications: { data: null, error: null } });
    await saveEditMedication({ preventDefault: () => {} }, 'pet-1', 'med-1');
    expect(m.endDate).toBeNull();
    expect(m.treatmentDays).toBeNull();
    const updatePayload = window.sb.from.mock.results[0].value.update.mock.calls[0][0];
    expect(updatePayload.end_date).toBeNull();
    expect(updatePayload.treatment_days).toBeNull();
  });
});

// Regresión: borrar un archivo adjunto del historial solo mutaba el estado
// en memoria (vía saveState(), que ni siquiera persiste mascotas) — si el
// usuario cerraba el modal sin guardar el resto del formulario, Supabase
// nunca se enteraba y el archivo "eliminado" reaparecía en la próxima carga.
describe('removeHistoryFile', () => {
  beforeEach(() => {
    // removeHistoryFile reabre el modal de edición al terminar (para
    // refrescar la lista de archivos), así que openModal necesita el nodo
    // real donde monta el HTML.
    document.body.innerHTML = '<div id="modal-root"></div>';
    window.isDemoUser = vi.fn(() => false);
  });

  it('persiste el archivo restante en Supabase de inmediato, no solo en memoria', async () => {
    window.showToast = vi.fn();
    window.closeModal = vi.fn();
    window.state = {
      pets: [{ id: 'pet-1', myRole: 'owner', clinicalHistory: [
        { id: 'h1', title: 'Control', files: [{ name: 'a.pdf', data: 'x' }, { name: 'b.pdf', data: 'y' }] },
      ] }],
    };
    window.sb = makeMockSb({ history_records: { data: null, error: null } });
    await removeHistoryFile('pet-1', 'h1', 0);
    const updatePayload = window.sb.from.mock.results[0].value.update.mock.calls[0][0];
    expect(JSON.parse(updatePayload.files[0]).name).toBe('b.pdf');
    expect(updatePayload.files).toHaveLength(1);
  });

  it('no llama a Supabase si el tutor tiene acceso de solo lectura', async () => {
    window.state = {
      pets: [{ id: 'pet-1', myRole: 'viewer', clinicalHistory: [
        { id: 'h1', title: 'Control', files: [{ name: 'a.pdf', data: 'x' }] },
      ] }],
    };
    window.showToast = vi.fn();
    window.sb = makeMockSb();
    await removeHistoryFile('pet-1', 'h1', 0);
    expect(window.sb.from).not.toHaveBeenCalled();
  });
});

// Regresión/cobertura del nuevo gating por plan: 1 adjunto por evento en
// Free, ilimitados en Premium — ver comentario en saveHistory()/
// saveEditHistory() en js/medications-history.js.
describe('límite de adjuntos por plan (Free: 1, Premium: ilimitado)', () => {
  function fakeFileInput(id, fileNames) {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = id;
    const files = fileNames.map(name => new File(['contenido'], name, { type: 'application/pdf' }));
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    document.body.appendChild(input);
    return input;
  }

  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    window.isDemoUser = vi.fn(() => false);
    document.body.innerHTML = `
      <input id="h-title" value="Control" />
      <select id="h-type"><option value="Diagnóstico" selected>Diagnóstico</option></select>
      <input id="h-date" value="2026-06-15" />
      <input id="h-doctor" value="" />
      <input id="h-clinic" value="" />
      <input id="h-cost" value="" />
      <textarea id="h-notes"></textarea>
    `;
  });

  it('saveHistory recorta a 1 archivo cuando el usuario es Free', async () => {
    window.isPremium = vi.fn(() => false);
    fakeFileInput('h-files', ['a.pdf', 'b.pdf', 'c.pdf']);
    const pet = { id: 'pet-1', myRole: 'owner', clinicalHistory: [] };
    window.state = { pets: [pet] };
    window.sb = makeMockSb({ history_records: { data: { id: 'h1' }, error: null } });
    await saveHistory({ preventDefault: () => {} }, 'pet-1');
    const insertPayload = window.sb.from.mock.results[0].value.insert.mock.calls[0][0];
    expect(insertPayload.files).toHaveLength(1);
    expect(pet.clinicalHistory[0].files).toHaveLength(1);
  });

  it('saveHistory NO recorta archivos cuando el usuario es Premium', async () => {
    window.isPremium = vi.fn(() => true);
    fakeFileInput('h-files', ['a.pdf', 'b.pdf', 'c.pdf']);
    const pet = { id: 'pet-1', myRole: 'owner', clinicalHistory: [] };
    window.state = { pets: [pet] };
    window.sb = makeMockSb({ history_records: { data: { id: 'h1' }, error: null } });
    await saveHistory({ preventDefault: () => {} }, 'pet-1');
    const insertPayload = window.sb.from.mock.results[0].value.insert.mock.calls[0][0];
    expect(insertPayload.files).toHaveLength(3);
  });

  it('saveEditHistory recorta a 1 archivo TOTAL (existentes + nuevos) cuando el usuario es Free', async () => {
    window.isPremium = vi.fn(() => false);
    fakeFileInput('eh-files', ['nuevo.pdf']);
    const h = { id: 'h1', title: 'Control', files: [{ name: 'viejo.pdf', data: 'x' }] };
    const pet = { id: 'pet-1', myRole: 'owner', clinicalHistory: [h] };
    window.state = { pets: [pet] };
    window.sb = makeMockSb({ history_records: { data: null, error: null } });
    await saveEditHistory({ preventDefault: () => {} }, 'pet-1', 'h1');
    expect(h.files).toHaveLength(1);
    expect(h.files[0].name).toBe('viejo.pdf'); // se prioriza lo ya existente sobre lo nuevo
  });
});

// Regresión de la auditoría de seguridad: los adjuntos del historial llegan de
// la base de datos (los puede escribir otro tutor) y se interpolaban crudos en
// href/src, así que una comilla en f.data rompía el atributo.
describe('tabHistory — adjuntos', () => {
  beforeEach(() => {
    window.state = { currentView: 'petProfile', pages: {}, user: null };
  });
  const pet = (files) => ({ id: 'pet-1', clinicalHistory: [{ id: 'h1', title: 'Control', type: 'Otro', date: '2026-06-10', files }] });

  it('un adjunto con comilla en f.data no rompe el atributo ni queda como HTML', () => {
    const html = tabHistory(pet([{ name: 'foto', type: 'image/png', data: 'data:image/x" onerror="window.__x=1' }]));
    expect(html).not.toContain('onerror');
    expect(html).toContain('archivo no válido');
  });

  it('un adjunto javascript: no llega al href', () => {
    const html = tabHistory(pet([{ name: 'doc', type: 'text/html', data: 'javascript:alert(1)' }]));
    expect(html).not.toContain('javascript:');
  });

  it('un adjunto válido sigue mostrándose como imagen con enlace', () => {
    const html = tabHistory(pet([{ name: 'foto', type: 'image/png', data: 'data:image/png;base64,iVBORw0KGgo=' }]));
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('rel="noopener"');
  });

  it('un f.data que no es string no rompe todo el historial', () => {
    expect(() => tabHistory(pet([{ name: 'x', data: null }]))).not.toThrow();
  });
});
