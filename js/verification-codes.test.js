import { describe, it, expect, vi } from 'vitest';
import {
  generateCode, hashCode, normalizeCode, buildCodeEmail, handleAction, CODE_MINUTES,
} from '../supabase/functions/verification-codes/index.ts';
import { hashCode as hashCodeDeleteAccount, normalizeCode as normalizeCodeDeleteAccount } from '../supabase/functions/delete-account/index.ts';

const PET = '11111111-2222-4333-8444-555555555555';
const USER = { id: 'user-1', email: 'Ana@Correo.cl' };

// Base de datos falsa: registra qué se borra y qué funciones SQL se llaman.
function fakeAdmin({ access = { role: 'owner' }, pet = { name: 'Greta', owner_id: 'user-1' }, rpc = { create_verification_code: 'ok', consume_verification_code: 'ok' } } = {}) {
  const calls = { deletes: [], rpc: [] };
  const admin = {
    calls,
    from: vi.fn(table => {
      const filters = {};
      const q = {
        select: () => q,
        eq: (k, v) => { filters[k] = v; return q; },
        maybeSingle: async () => ({ data: table === 'pet_access' ? access : table === 'pets' ? pet : null, error: null }),
        delete: () => { const d = { table, filters }; calls.deletes.push(d); return q; },
        then: (ok, ko) => Promise.resolve({ error: null }).then(ok, ko),
      };
      return q;
    }),
    rpc: vi.fn(async (name, args) => { calls.rpc.push({ name, args }); return { data: rpc[name], error: null }; }),
  };
  return admin;
}
const env = over => k => ({ UNSUB_SECRET: 'secreto', RESEND_API_KEY: 'rk', ...over }[k] ?? '');
const okFetch = () => vi.fn(async () => ({ ok: true }));
const run = (body, admin = fakeAdmin(), fetchFn = okFetch(), e = env()) => handleAction({ user: USER, body, admin, env: e, fetchFn });
const codeFrom = fetchFn => JSON.parse(fetchFn.mock.calls[0][1].body).text.match(/Código: (\d{6})/)[1];

describe('código y resumen', () => {
  it('genera 6 dígitos, con ceros a la izquierda', () => {
    expect(generateCode(a => { a[0] = 5; return a; })).toBe('000005');
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('descarta los valores que sesgarían la distribución (muestreo por rechazo)', () => {
    const seq = [0xFFFFFFFF, 0xFFFFFFFE, 123456];
    expect(generateCode(a => { a[0] = seq.shift(); return a; })).toBe('123456');
    expect(seq).toEqual([]);
  });

  it('el resumen es determinista, de 64 hex y cambia con la persona, la acción, la mascota, el código y el secreto', async () => {
    const base = await hashCode('s', 'u1', 'delete_pet', PET, '123456');
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashCode('s', 'u1', 'delete_pet', PET, '123456')).toBe(base);
    for (const alt of [hashCode('otro', 'u1', 'delete_pet', PET, '123456'), hashCode('s', 'u2', 'delete_pet', PET, '123456'),
      hashCode('s', 'u1', 'delete_account', PET, '123456'), hashCode('s', 'u1', 'delete_pet', null, '123456'), hashCode('s', 'u1', 'delete_pet', PET, '123457')]) {
      expect(await alt).not.toBe(base);
    }
  });

  it('el resumen de verification-codes y el de delete-account son idénticos (si difieren, el código nunca coincidiría)', async () => {
    for (const [p, s] of [['delete_account', null], ['delete_pet', PET]]) {
      expect(await hashCode('sec', 'u1', p, s, '654321')).toBe(await hashCodeDeleteAccount('sec', 'u1', p, s, '654321'));
    }
    expect(normalizeCode(' 12 34-56 ')).toBe('123456');
    expect(normalizeCodeDeleteAccount(' 12 34-56 ')).toBe('123456');
    expect(normalizeCode(null)).toBe('');
  });
});

describe('correo de cada acción', () => {
  const mail = o => buildCodeEmail({ code: '123456', appUrl: 'https://mascodata.cl', ...o });

  it('eliminar la cuenta, eliminar una mascota y dejar de ver una compartida tienen textos distintos', () => {
    expect(mail({ purpose: 'delete_account' }).subject).toBe('Código para eliminar tu cuenta de Mascodata');
    expect(mail({ purpose: 'delete_pet', petName: 'Greta' }).subject).toBe('Código para eliminar a Greta');
    expect(mail({ purpose: 'delete_pet', petName: 'Greta', guest: true }).subject).toBe('Código para dejar de ver a Greta');
    expect(mail({ purpose: 'delete_pet', petName: 'Greta', guest: true }).html).toContain('Su dueño conserva toda la información');
    expect(mail({ purpose: 'delete_pet', petName: 'Greta' }).html).toContain('de forma permanente');
  });

  it('lleva el código, su vigencia y qué hacer si no fue la persona', () => {
    const m = mail({ purpose: 'delete_account' });
    expect(m.html).toContain('123456');
    expect(m.text).toContain('Código: 123456');
    expect(m.html).toContain(`vence en ${CODE_MINUTES} minutos`);
    expect(m.html).toContain('Si no fuiste tú');
  });

  it('escapa el nombre de la mascota y deja el asunto en una sola línea', () => {
    const m = mail({ purpose: 'delete_pet', petName: '<img src=x onerror=1>\r\nBcc: alguien@x.cl' });
    expect(m.html).not.toContain('<img src=x');
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject.length).toBeLessThanOrEqual(70);
  });

  it('una mascota sin nombre se llama "tu mascota"', () => {
    expect(mail({ purpose: 'delete_pet', petName: '' }).subject).toBe('Código para eliminar a tu mascota');
  });

  it('no usa la plantilla ni el texto de "Magic Link"', () => {
    expect(mail({ purpose: 'delete_account' }).html).not.toMatch(/Entra a Mascodata|enlace de acceso/i);
  });
});

describe('enviar el código', () => {
  it('eliminar la cuenta: crea el código en la base con su resumen y lo envía al correo de la persona', async () => {
    const admin = fakeAdmin(); const fetchFn = okFetch();
    const r = await run({ action: 'send', purpose: 'delete_account' }, admin, fetchFn);
    expect(r).toEqual({ status: 200, body: { ok: true, expires_minutes: CODE_MINUTES } });
    const sent = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(sent.to).toEqual(['Ana@Correo.cl']);
    expect(sent.from).toBe('Mascodata <noreply@mascodata.cl>');
    expect(sent.subject).toBe('Código para eliminar tu cuenta de Mascodata');
    const args = admin.calls.rpc[0].args;
    expect(args).toMatchObject({ p_user: 'user-1', p_purpose: 'delete_account', p_subject: null });
    expect(args.p_hash).toBe(await hashCode('secreto', 'user-1', 'delete_account', null, codeFrom(fetchFn)));
    expect(JSON.stringify(admin.calls.rpc)).not.toContain(codeFrom(fetchFn)); // el código en claro nunca se guarda
  });

  it('eliminar una mascota propia y dejar de ver una compartida usan cada una su texto', async () => {
    const f1 = okFetch();
    await run({ action: 'send', purpose: 'delete_pet', pet_id: PET }, fakeAdmin(), f1);
    expect(JSON.parse(f1.mock.calls[0][1].body).subject).toBe('Código para eliminar a Greta');
    const f2 = okFetch();
    await run({ action: 'send', purpose: 'delete_pet', pet_id: PET }, fakeAdmin({ access: { role: 'editor' }, pet: { name: 'Greta', owner_id: 'otro' } }), f2);
    expect(JSON.parse(f2.mock.calls[0][1].body).subject).toBe('Código para dejar de ver a Greta');
  });

  it('el código de una mascota queda atado a esa mascota', async () => {
    const admin = fakeAdmin(); const fetchFn = okFetch();
    await run({ action: 'send', purpose: 'delete_pet', pet_id: PET }, admin, fetchFn);
    expect(admin.calls.rpc[0].args).toMatchObject({ p_purpose: 'delete_pet', p_subject: PET });
  });

  it('no envía nada si la base dice que es muy pronto o que ya pidió demasiados', async () => {
    for (const status of ['too_soon', 'too_many']) {
      const fetchFn = okFetch();
      const r = await run({ action: 'send', purpose: 'delete_account' }, fakeAdmin({ rpc: { create_verification_code: status } }), fetchFn);
      expect(r).toEqual({ status: 429, body: { error: status } });
      expect(fetchFn).not.toHaveBeenCalled();
    }
  });

  it('si Resend rechaza el envío, borra el código para poder reintentar', async () => {
    const admin = fakeAdmin();
    const r = await run({ action: 'send', purpose: 'delete_account' }, admin, vi.fn(async () => ({ ok: false })));
    expect(r).toEqual({ status: 502, body: { error: 'send_failed' } });
    expect(admin.calls.deletes.some(d => d.table === 'verification_codes')).toBe(true);
  });

  it('no envía si la persona no tiene acceso a esa mascota, ni con datos mal formados', async () => {
    const fetchFn = okFetch();
    expect((await run({ action: 'send', purpose: 'delete_pet', pet_id: PET }, fakeAdmin({ access: null }), fetchFn)).status).toBe(404);
    expect((await run({ action: 'send', purpose: 'delete_pet', pet_id: 'no-es-uuid' }, fakeAdmin(), fetchFn)).status).toBe(400);
    expect((await run({ action: 'send', purpose: 'otra' }, fakeAdmin(), fetchFn)).status).toBe(400);
    expect((await run({ action: 'nada' }, fakeAdmin(), fetchFn)).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sin el secreto configurado falla en claro, sin enviar nada', async () => {
    const fetchFn = okFetch();
    const r = await run({ action: 'send', purpose: 'delete_account' }, fakeAdmin(), fetchFn, env({ UNSUB_SECRET: '' }));
    expect(r.status).toBe(500);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('eliminar la mascota con el código', () => {
  const del = (code, admin) => run({ action: 'delete_pet', pet_id: PET, code }, admin);

  it('con un código válido, la dueña la elimina', async () => {
    const admin = fakeAdmin();
    const r = await del('123456', admin);
    expect(r).toEqual({ status: 200, body: { ok: true, mode: 'deleted' } });
    expect(admin.calls.deletes).toEqual([{ table: 'pets', filters: { id: PET, owner_id: 'user-1' } }]);
    expect(admin.calls.rpc[0].args.p_hash).toBe(await hashCode('secreto', 'user-1', 'delete_pet', PET, '123456'));
  });

  it('quien la comparte solo deja de verla: se quita su acceso y su invitación, y la mascota sigue existiendo', async () => {
    const admin = fakeAdmin({ access: { role: 'editor' }, pet: { name: 'Greta', owner_id: 'otro' } });
    const r = await del('123456', admin);
    expect(r).toEqual({ status: 200, body: { ok: true, mode: 'left' } });
    expect(admin.calls.deletes.map(d => d.table)).toEqual(['pet_access', 'invitations']);
    expect(admin.calls.deletes[0].filters).toEqual({ pet_id: PET, user_id: 'user-1' });
    expect(admin.calls.deletes[1].filters.invited_email).toBe('ana@correo.cl');
    expect(admin.calls.deletes.some(d => d.table === 'pets')).toBe(false);
  });

  it.each([['invalid'], ['expired'], ['locked']])('un código %s no borra nada', async status => {
    const admin = fakeAdmin({ rpc: { consume_verification_code: status } });
    const r = await del('123456', admin);
    expect(r).toEqual({ status: 403, body: { error: `code_${status}` } });
    expect(admin.calls.deletes).toEqual([]);
  });

  it('un código que no tiene 6 dígitos ni siquiera consulta la base', async () => {
    const admin = fakeAdmin();
    expect((await del('12345', admin)).status).toBe(400);
    expect((await del('', admin)).status).toBe(400);
    expect(admin.calls.rpc).toEqual([]);
  });

  it('sin acceso a esa mascota, no hay código que valga', async () => {
    const admin = fakeAdmin({ access: null });
    expect((await del('123456', admin)).status).toBe(404);
    expect(admin.calls.rpc).toEqual([]);
    expect(admin.calls.deletes).toEqual([]);
  });

  it('acepta el código con espacios o guiones', async () => {
    const admin = fakeAdmin();
    expect((await del('123 456', admin)).status).toBe(200);
  });
});
