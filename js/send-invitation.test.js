import { describe, it, expect, vi } from 'vitest';
import { buildInvitationEmail, handleAction } from '../supabase/functions/send-invitation/index.ts';

const USER = { id: 'user-1', email: 'ana@correo.cl' };
const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CLAIM = { status: 'ok', pet_name: 'Greta', invited_email: 'luis@correo.cl', role: 'edicion', expires_at: new Date(Date.now() + 5 * 86400000).toISOString() };

// Base de datos falsa: la función SQL reserva el envío y el perfil trae el nombre de quien invita.
function fakeAdmin({ claim = CLAIM, name = 'Ana Pérez' } = {}) {
  const calls = { rpc: [] };
  return {
    calls,
    from: vi.fn(() => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { name }, error: null }) };
      return q;
    }),
    rpc: vi.fn(async (fn, args) => { calls.rpc.push({ fn, args }); return { data: fn === 'claim_invitation_email' ? claim : null, error: null }; }),
  };
}
const env = k => ({ RESEND_API_KEY: 'rk' }[k] ?? '');
const okFetch = () => vi.fn(async () => ({ ok: true }));
const run = (body, admin = fakeAdmin(), fetchFn = okFetch()) => handleAction({ user: USER, body, admin, env, fetchFn });
const sent = fetchFn => JSON.parse(fetchFn.mock.calls[0][1].body);

describe('correo de invitación', () => {
  const mail = o => buildInvitationEmail({ inviterName: 'Ana Pérez', petName: 'Greta', role: 'edicion', token: TOKEN, appUrl: 'https://mascodata.cl', ...o });

  it('dice quién invita y a quién cuidar, y enlaza a la app con el token', () => {
    const m = mail();
    expect(m.subject).toBe('Ana Pérez te invitó a cuidar a Greta en Mascodata');
    expect(m.html).toContain(`href="https://mascodata.cl/?invite=${TOKEN}"`);
    expect(m.text).toContain(`https://mascodata.cl/?invite=${TOKEN}`);
  });

  it('el texto cambia según el permiso: editar o solo ver', () => {
    expect(mail({ role: 'edicion' }).text).toContain('ver y editar');
    const soloVer = mail({ role: 'lectura' }).text;
    expect(soloVer).toContain('podrás ver la ficha');
    expect(soloVer).not.toContain('editar');
  });

  it('indica cuántos días le quedan a la invitación', () => {
    expect(mail({ expiresAt: new Date(Date.now() + 5 * 86400000 - 60000).toISOString() }).text).toContain('vence en 5 días');
    expect(mail({ expiresAt: new Date(Date.now() + 3600000).toISOString() }).text).toContain('vence en 1 día');
  });

  it('escapa y acota los nombres: no se puede inyectar HTML ni armar mensajes largos', () => {
    const m = mail({ petName: '<script>alert(1)</script>Greta', inviterName: 'A\nB"><img src=x>' + 'x'.repeat(200) });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<img src=x>');
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject.length).toBeLessThan(140);
  });

  it('con nombres vacíos usa textos neutros', () => {
    const m = mail({ inviterName: '', petName: '' });
    expect(m.subject).toBe('Alguien te invitó a cuidar a una mascota en Mascodata');
  });
});

describe('send-invitation', () => {
  it('reserva el envío con la persona de la sesión (no la del cuerpo) y envía a la dirección de la base', async () => {
    const admin = fakeAdmin(), fetchFn = okFetch();
    const r = await run({ token: TOKEN, inviter_id: 'otro', to: 'ataque@mal.cl' }, admin, fetchFn);
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(admin.calls.rpc[0]).toEqual({ fn: 'claim_invitation_email', args: { p_inviter: 'user-1', p_token: TOKEN } });
    const body = sent(fetchFn);
    expect(body.to).toEqual(['luis@correo.cl']);
    expect(body.from).toBe('Mascodata <noreply@mascodata.cl>');
    expect(body.subject).toContain('Ana Pérez');
    expect(body.subject).toContain('Greta');
  });

  it.each([[undefined], [''], ['corto'], ['con espacios y símbolos <>'], [123]])('rechaza un token inválido (%s) sin tocar la base', async token => {
    const admin = fakeAdmin(), fetchFn = okFetch();
    const r = await run({ token }, admin, fetchFn);
    expect(r.status).toBe(400);
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([['not_found', 404], ['too_soon', 429], ['too_many', 429]])('si la base responde %s no envía correo', async (status, http) => {
    const fetchFn = okFetch();
    const r = await run({ token: TOKEN }, fakeAdmin({ claim: { status } }), fetchFn);
    expect(r).toEqual({ status: http, body: { error: status } });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('si Resend falla, libera el envío para reintentar y responde send_failed', async () => {
    const admin = fakeAdmin();
    const r = await run({ token: TOKEN }, admin, vi.fn(async () => ({ ok: false })));
    expect(r).toEqual({ status: 502, body: { error: 'send_failed' } });
    expect(admin.calls.rpc.map(c => c.fn)).toEqual(['claim_invitation_email', 'release_invitation_email']);
  });

  it('si la red falla, también libera el envío', async () => {
    const admin = fakeAdmin();
    const r = await run({ token: TOKEN }, admin, vi.fn(async () => { throw new Error('red'); }));
    expect(r.status).toBe(502);
    expect(admin.calls.rpc.map(c => c.fn)).toContain('release_invitation_email');
  });
});
