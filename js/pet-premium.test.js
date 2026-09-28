import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
import { state, petIsPremium, blockIfPetNotPremium } from '../js/app.js';
import { acceptPendingInvites, acceptPetInvite } from './pets.js';

// Las funciones de una mascota siguen al plan de su DUEÑO; lo propio de cada persona, a su plan.
describe('petIsPremium: el plan de la mascota es el de su dueño', () => {
  beforeEach(() => { window.showToast = vi.fn(); window.track = vi.fn(); state.user = { id: 'u1', plan: 'free' }; });
  const as = plan => { state.user = { id: 'u1', plan }; };

  it('el dueño: rige su propio plan', () => {
    as('premium'); expect(petIsPremium({ myRole: 'owner' })).toBe(true);
    as('free'); expect(petIsPremium({ myRole: 'owner' })).toBe(false);
    as('free'); expect(petIsPremium({})).toBe(false); // sin rol = dueño (datos antiguos)
  });

  it('un invitado con edición o lectura: rige el plan del dueño, aunque él sea Free', () => {
    as('free');
    for (const myRole of ['editor', 'viewer']) {
      expect(petIsPremium({ myRole, ownerPremium: true })).toBe(true);
      expect(petIsPremium({ myRole, ownerPremium: false })).toBe(false);
    }
  });

  it('un invitado que es Premium NO vuelve Premium una mascota cuyo dueño es Free', () => {
    as('premium');
    expect(petIsPremium({ myRole: 'editor', ownerPremium: false })).toBe(false);
  });

  it('si la base aún no trae la marca, el invitado no recibe Premium por defecto', () => {
    as('free'); expect(petIsPremium({ myRole: 'viewer' })).toBe(false);
  });

  it('el lector de una mascota Premium puede exportar (no se bloquea)', () => {
    as('free');
    document.body.innerHTML = '';
    expect(blockIfPetNotPremium({ myRole: 'viewer', ownerPremium: true }, 'Exportar el expediente')).toBe(false);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('en una mascota Free, el invitado ve que el plan de quien la comparte no la incluye', () => {
    as('premium');
    document.body.innerHTML = '';
    expect(blockIfPetNotPremium({ myRole: 'editor', ownerPremium: false }, 'Exportar el expediente')).toBe(true);
    expect(document.querySelector('.toast')?.textContent).toContain('quien comparte');
  });
});

describe('acceptPendingInvites: acepta solas las invitaciones para este correo', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  beforeEach(() => {
    window.showToast = vi.fn(); window.loadDataFromSupabase = vi.fn(async () => {}); window.isDemoUser = vi.fn(() => false);
    state.user = { id: 'u2', email: 'Luis@Correo.cl' }; state.pets = [];
  });
  const sbWith = rows => {
    const sb = makeMockSb({ invitations: { data: rows, error: null }, pet_access: { data: null, error: null } });
    return sb;
  };

  it('sin correo o en modo demo no hace nada', async () => {
    window.sb = sbWith([]); state.user = { id: 'x' };
    expect(await acceptPendingInvites()).toBe(0);
    expect(window.sb.from).not.toHaveBeenCalled();
  });

  it('busca por el correo en minúsculas y no acepta las vencidas ni las de mascotas que ya tiene', async () => {
    const sb = sbWith([{ token: 't1', pet_id: 'p1', expires_at: past }, { token: 't2', pet_id: 'p2', expires_at: future }]);
    window.sb = sb; state.pets = [{ id: 'p2' }];
    expect(await acceptPendingInvites()).toBe(0);
    expect(window.showToast).not.toHaveBeenCalled(); // sin ruido: solo se aceptan las que corresponden
  });

  it('acepta una invitación vigente y recarga los datos una sola vez', async () => {
    const row = { token: 't1', pet_id: 'p1', pet_name: 'Greta', role: 'edicion', invited_email: 'luis@correo.cl', expires_at: future, used: false };
    window.sb = sbWith(row.pet_id ? [row] : []);
    // acceptPetInvite lee la fila completa por token: el mock devuelve la misma para cualquier consulta de invitations
    window.sb.from = vi.fn(table => {
      const q = { select: () => q, eq: () => q, in: () => q, update: () => q, insert: async () => ({ error: null }),
        maybeSingle: async () => ({ data: row, error: null }),
        then: (ok) => Promise.resolve({ data: [row], error: null }).then(ok) };
      return q;
    });
    expect(await acceptPendingInvites()).toBe(1);
    expect(window.loadDataFromSupabase).toHaveBeenCalledTimes(1);
    expect(window.showToast).toHaveBeenCalledWith('Ahora tienes acceso a Greta', 'success');
  });
});

describe('acceptPetInvite: avisos claros', () => {
  beforeEach(() => { window.showToast = vi.fn(); window.loadDataFromSupabase = vi.fn(async () => {}); state.user = { id: 'u2', email: 'otra@correo.cl' }; });
  const invite = over => ({ token: 't', pet_id: 'p1', pet_name: 'Greta', role: 'lectura', invited_email: 'luis@correo.cl', expires_at: new Date(Date.now() + 86400000).toISOString(), ...over });
  const withInvite = inv => { window.sb = { from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: inv, error: null }) }; return q; } }; };

  it('si es para otro correo, dice qué hacer y se queda más tiempo en pantalla', async () => {
    withInvite(invite());
    expect(await acceptPetInvite('t')).toBe(false);
    expect(window.showToast).toHaveBeenCalledWith(expect.stringContaining('Cierra sesión'), 'error', 9000);
  });

  it('en modo silencioso no avisa', async () => {
    withInvite(invite());
    expect(await acceptPetInvite('t', { quiet: true })).toBe(false);
    expect(window.showToast).not.toHaveBeenCalled();
  });
});
