// Códigos de verificación para acciones destructivas: eliminar una mascota (o dejar de ver una compartida).
// (Eliminar la cuenta la hace `delete-account`, que exige el mismo código.)
//
// Antes el código lo mandaba Supabase Auth (plantilla "Magic Link") y solo lo comprobaba el navegador. Ahora:
//   1. `send`        → genera un código de 6 dígitos, guarda solo su resumen (hash HMAC) y lo envía por Resend con un
//                      correo propio de esa acción ("Código para eliminar a Greta").
//   2. `delete_pet`  → comprueba el código EN EL SERVIDOR y recién ahí borra la mascota (si es la dueña) o quita el
//                      acceso de quien la comparte. Un código sirve una sola vez, vence a los 10 minutos y se bloquea
//                      tras 5 intentos fallidos. Los límites de envío (1 por minuto, 5 por hora) viven en el SQL.
//
// La lógica de códigos está en supabase/schema/verification_codes.sql (create_verification_code / consume_verification_code).
// Solo esta función y delete-account (con la clave de servicio) pueden llamarlas.
//
// Deploy manual (ver supabase/README.md): Dashboard → Edge Functions → New function "verification-codes" → pegar este
// archivo → Deploy. En Settings, "Verify JWT with legacy secret" APAGADO: la función valida la sesión por su cuenta
// (auth.getUser). Usa los mismos secretos que los recordatorios: RESEND_API_KEY, UNSUB_SECRET y (opcional) APP_URL.

import { createClient } from 'npm:@supabase/supabase-js@2';

export type Purpose = 'delete_account' | 'delete_pet';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CODE_MINUTES = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------- Código y resumen ----------
// Código de 6 dígitos, con ceros a la izquierda, sin sesgo (rechazo de valores que romperían la uniformidad).
export function generateCode(random: (a: Uint32Array) => Uint32Array = a => crypto.getRandomValues(a)): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  let n: number;
  do { n = random(new Uint32Array(1))[0]; } while (n >= limit);
  return String(n % 1_000_000).padStart(6, '0');
}

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
// Resumen HMAC del código, atado a la persona, la acción y la mascota: un código no sirve para otra cosa.
export async function hashCode(secret: string, userId: string, purpose: string, subject: string | null, code: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`code:${userId}:${purpose}:${subject ?? ''}:${code}`)));
}

export const normalizeCode = (v: unknown) => String(v ?? '').replace(/\D/g, '');

// ---------- Correo ----------
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// El nombre de la mascota sale de la base, pero se limpia igual para el asunto (una sola línea, sin caracteres de control).
const oneLine = (s: string, max = 40) => s.replace(/[\r\n\t\u0000-\u001f]+/g, ' ').trim().slice(0, max);

export function buildCodeEmail(o: { purpose: Purpose; petName?: string; guest?: boolean; code: string; appUrl: string }): { subject: string; html: string; text: string } {
  const pet = oneLine(o.petName || '') || 'tu mascota';
  let subject: string, title: string, intro: string;
  if (o.purpose === 'delete_account') {
    subject = 'Código para eliminar tu cuenta de Mascodata';
    title = 'Confirma que quieres eliminar tu cuenta';
    intro = 'Ingresa este código en Mascodata para eliminar tu cuenta y todos sus datos. Esta acción es permanente y no se puede deshacer.';
  } else if (o.guest) {
    subject = `Código para dejar de ver a ${pet}`;
    title = `Confirma que quieres dejar de ver a ${pet}`;
    intro = `Ingresa este código en Mascodata para quitar tu acceso a la ficha de ${pet}. Su dueño conserva toda la información.`;
  } else {
    subject = `Código para eliminar a ${pet}`;
    title = `Confirma que quieres eliminar a ${pet}`;
    intro = `Ingresa este código en Mascodata para eliminar a ${pet} de forma permanente, con su historial de salud, agenda y gastos. Esta acción no se puede deshacer.`;
  }
  const foot = 'Si no fuiste tú, ignora este correo y no compartas este código con nadie: no se eliminará nada. Te recomendamos cambiar tu contraseña.';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F8F9FF;font-family:Arial,Helvetica,sans-serif;color:#252A62">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FF"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid #DFE3F4;border-radius:20px">
<tr><td style="padding:26px 28px 6px 28px"><img src="${esc(o.appUrl)}/img/logos/mascodata-app-icon.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px"> <span style="font-size:18px;font-weight:800;color:#252A62;vertical-align:middle;margin-left:6px">Mascodata</span></td></tr>
<tr><td style="padding:14px 28px 4px 28px"><h1 style="margin:0;font-size:22px;line-height:28px;color:#252A62">${esc(title)}</h1>
<p style="margin:10px 0 0 0;font-size:15px;line-height:24px;color:#626A8A">${esc(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px 0"><tr><td style="background:#E7F1FF;border-radius:14px;padding:16px 28px;font-size:30px;line-height:34px;font-weight:800;letter-spacing:8px;color:#252A62">${esc(o.code)}</td></tr></table>
<p style="margin:10px 0 0 0;font-size:13px;line-height:20px;color:#626A8A">El código vence en ${CODE_MINUTES} minutos y se puede usar una sola vez.</p></td></tr>
<tr><td style="padding:22px 28px 26px 28px;font-size:12px;line-height:18px;color:#626A8A">${esc(foot)}<br>Mascodata · <a href="${esc(o.appUrl)}" style="color:#4C5FD7">mascodata.cl</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\nCódigo: ${o.code}\nVence en ${CODE_MINUTES} minutos y se puede usar una sola vez.\n\n${foot}\n`;
  return { subject, html, text };
}

// ---------- Acciones (separadas del HTTP para poder probarlas) ----------
export interface Ctx {
  user: { id: string; email?: string | null };
  body: Record<string, unknown>;
  // deno-lint-ignore no-explicit-any
  admin: any;
  env: (k: string) => string;
  fetchFn: typeof fetch;
}
export interface Result { status: number; body: Record<string, unknown> }
const fail = (status: number, error: string): Result => ({ status, body: { error } });

// deno-lint-ignore no-explicit-any
async function petAccess(admin: any, userId: string, petId: string): Promise<{ role: string; name: string } | null> {
  const { data: acc } = await admin.from('pet_access').select('role').eq('pet_id', petId).eq('user_id', userId).maybeSingle();
  if (!acc) return null;
  const { data: pet } = await admin.from('pets').select('name, owner_id').eq('id', petId).maybeSingle();
  if (!pet) return null;
  return { role: acc.role === 'owner' && pet.owner_id === userId ? 'owner' : 'guest', name: pet.name ?? '' };
}

export async function handleAction(ctx: Ctx): Promise<Result> {
  const { user, body, admin, env } = ctx;
  const secret = env('UNSUB_SECRET');
  if (!secret) return fail(500, 'server_config');
  const action = body.action;

  if (action === 'send') {
    const purpose = body.purpose as Purpose;
    if (purpose !== 'delete_account' && purpose !== 'delete_pet') return fail(400, 'bad_request');
    if (!user.email) return fail(400, 'no_email');
    let subject: string | null = null;
    let petName = '', guest = false;
    if (purpose === 'delete_pet') {
      const petId = String(body.pet_id ?? '');
      if (!UUID.test(petId)) return fail(400, 'bad_request');
      const acc = await petAccess(admin, user.id, petId);
      if (!acc) return fail(404, 'not_found');
      subject = petId; petName = acc.name; guest = acc.role !== 'owner';
    }
    const code = generateCode();
    const hash = await hashCode(secret, user.id, purpose, subject, code);
    const { data: status, error } = await admin.rpc('create_verification_code', { p_user: user.id, p_purpose: purpose, p_subject: subject, p_hash: hash });
    if (error) return fail(500, 'server_error');
    if (status === 'too_soon') return fail(429, 'too_soon');
    if (status === 'too_many') return fail(429, 'too_many');
    const appUrl = (env('APP_URL') || 'https://mascodata.cl').replace(/\/$/, '');
    const mail = buildCodeEmail({ purpose, petName, guest, code, appUrl });
    const res = await ctx.fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Mascodata <noreply@mascodata.cl>', to: [user.email], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) {
      await admin.from('verification_codes').delete().eq('user_id', user.id).eq('code_hash', hash); // libera para reintentar
      return fail(502, 'send_failed');
    }
    return { status: 200, body: { ok: true, expires_minutes: CODE_MINUTES } };
  }

  if (action === 'delete_pet') {
    const petId = String(body.pet_id ?? '');
    const code = normalizeCode(body.code);
    if (!UUID.test(petId) || code.length !== 6) return fail(400, 'bad_request');
    const acc = await petAccess(admin, user.id, petId);
    if (!acc) return fail(404, 'not_found');
    const hash = await hashCode(secret, user.id, 'delete_pet', petId, code);
    const { data: status, error } = await admin.rpc('consume_verification_code', { p_user: user.id, p_purpose: 'delete_pet', p_subject: petId, p_hash: hash });
    if (error) return fail(500, 'server_error');
    if (status !== 'ok') return fail(403, `code_${status}`);

    if (acc.role === 'owner') {
      const { error: e } = await admin.from('pets').delete().eq('id', petId).eq('owner_id', user.id);
      if (e) return fail(500, 'server_error');
      return { status: 200, body: { ok: true, mode: 'deleted' } };
    }
    // Quien la comparte solo deja de verla: se quita su acceso y su invitación; el dueño conserva todo.
    const { error: e1 } = await admin.from('pet_access').delete().eq('pet_id', petId).eq('user_id', user.id);
    if (e1) return fail(500, 'server_error');
    if (user.email) await admin.from('invitations').delete().eq('pet_id', petId).eq('invited_email', user.email.toLowerCase());
    return { status: 200, body: { ok: true, mode: 'left' } };
  }

  return fail(400, 'bad_request');
}

// ---------- Servidor (solo cuando corre en Deno / Supabase; los tests solo importan lo de arriba) ----------
// deno-lint-ignore no-explicit-any
const DenoRef = (globalThis as any).Deno;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const env = (k: string) => DenoRef.env.get(k) ?? '';
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });

  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: 'unauthorized' });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { return json(400, { error: 'bad_request' }); }

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const result = await handleAction({ user: { id: user.id, email: user.email }, body, admin, env, fetchFn: fetch });
  return json(result.status, result.body);
}

if (DenoRef?.serve) {
  DenoRef.serve((req: Request) => handle(req).catch(err => {
    console.error('verification-codes', err);
    return json(500, { error: 'server_error' });
  }));
}
