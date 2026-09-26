// Envía el correo de invitación a un segundo tutor ("Ana te invitó a cuidar a Greta").
//
// Antes la invitación salía de Supabase Auth (magic link, plantilla genérica y distinta según la persona tuviera cuenta o no).
// Ahora la app crea la fila en `invitations` (como siempre, con las reglas RLS: solo el dueño de la mascota) y llama a esta
// función con el token. Ella:
//   1. Comprueba la sesión de quien llama (auth.getUser) — el quién nunca viene del cuerpo de la petición.
//   2. Reserva el envío con claim_invitation_email (supabase/schema/invitation_emails.sql): solo la invitación de esa persona,
//      vigente y sin usar, con límites (1 por minuto y 5 por invitación, 10 invitaciones por hora).
//   3. Arma el correo SOLO con datos de la base (mascota, invitado, rol, vigencia) y el nombre de quien invita (su perfil),
//      escapados; el destinatario también sale de la base, no del cuerpo de la petición.
//   4. Lo envía por Resend con un enlace a la app: https://mascodata.cl/?invite=TOKEN. Quien lo abre entra o crea su cuenta
//      normalmente (correo y contraseña, o Google) y la invitación se acepta sola al iniciar sesión.
//
// Deploy manual (ver supabase/README.md): Dashboard → Edge Functions → New function "send-invitation" → pegar este archivo →
// Deploy. En Settings, "Verify JWT with legacy secret" APAGADO: la función valida la sesión por su cuenta. Usa los mismos
// secretos que las otras: RESEND_API_KEY y (opcional) APP_URL. No necesita secretos nuevos.

import { createClient } from 'npm:@supabase/supabase-js@2';

const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Los nombres los escribe una persona: una sola línea, sin caracteres de control y con largo acotado (no sirven para armar mensajes).
const oneLine = (s: unknown, max = 40) => String(s ?? '').replace(/[\r\n\t\u0000-\u001f]+/g, ' ').trim().slice(0, max);

export function buildInvitationEmail(o: { inviterName?: string; petName?: string; role?: string; expiresAt?: string; token: string; appUrl: string }): { subject: string; html: string; text: string } {
  const inviter = oneLine(o.inviterName) || 'Alguien';
  const pet = oneLine(o.petName) || 'una mascota';
  const canEdit = o.role === 'edicion';
  const days = o.expiresAt ? Math.max(1, Math.ceil((new Date(o.expiresAt).getTime() - Date.now()) / 86400000)) : 7;
  const link = `${o.appUrl}/?invite=${encodeURIComponent(o.token)}`;

  const subject = `${inviter} te invitó a cuidar a ${pet} en Mascodata`;
  const title = `${inviter} te invitó a cuidar a ${pet}`;
  const intro = canEdit
    ? `Con esta invitación podrás ver y editar la ficha de ${pet}: vacunas, tratamientos, agenda y gastos, junto a ${inviter}.`
    : `Con esta invitación podrás ver la ficha de ${pet}: vacunas, tratamientos y agenda, junto a ${inviter}.`;
  const how = 'Pulsa el botón e inicia sesión, o crea tu cuenta gratis, con este mismo correo. La invitación se acepta sola.';
  const foot = `La invitación vence en ${days} ${days === 1 ? 'día' : 'días'}. Si no conoces a ${inviter} o no esperabas este correo, ignóralo: no pasará nada y no se te da acceso a nada.`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F8F9FF;font-family:Arial,Helvetica,sans-serif;color:#252A62">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FF"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid #DFE3F4;border-radius:20px">
<tr><td style="padding:26px 28px 6px 28px"><img src="${esc(o.appUrl)}/img/logos/mascodata-app-icon.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px"> <span style="font-size:18px;font-weight:800;color:#252A62;vertical-align:middle;margin-left:6px">Mascodata</span></td></tr>
<tr><td style="padding:14px 28px 4px 28px"><h1 style="margin:0;font-size:22px;line-height:28px;color:#252A62">${esc(title)}</h1>
<p style="margin:10px 0 0 0;font-size:15px;line-height:24px;color:#626A8A">${esc(intro)}</p>
<p style="margin:10px 0 0 0;font-size:15px;line-height:24px;color:#626A8A">${esc(how)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px 0"><tr><td style="background:#4C5FD7;border-radius:12px"><a href="${esc(link)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none">Ver la invitación</a></td></tr></table></td></tr>
<tr><td style="padding:22px 28px 26px 28px;font-size:12px;line-height:18px;color:#626A8A">${esc(foot)}<br>Mascodata · <a href="${esc(o.appUrl)}" style="color:#4C5FD7">mascodata.cl</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${title}\n\n${intro}\n\n${how}\n\nVer la invitación: ${link}\n\n${foot}\n`;
  return { subject, html, text };
}

// ---------- Acción (separada del HTTP para poder probarla) ----------
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

export async function handleAction(ctx: Ctx): Promise<Result> {
  const { user, body, admin, env } = ctx;
  const token = String(body.token ?? '');
  if (!TOKEN.test(token)) return fail(400, 'bad_request');

  const { data: claim, error } = await admin.rpc('claim_invitation_email', { p_inviter: user.id, p_token: token });
  if (error || !claim) return fail(500, 'server_error');
  if (claim.status === 'not_found') return fail(404, 'not_found');
  if (claim.status === 'too_soon') return fail(429, 'too_soon');
  if (claim.status === 'too_many') return fail(429, 'too_many');
  if (claim.status !== 'ok' || !claim.invited_email) return fail(500, 'server_error');

  const { data: profile } = await admin.from('profiles').select('name').eq('id', user.id).maybeSingle();
  const appUrl = (env('APP_URL') || 'https://mascodata.cl').replace(/\/$/, '');
  const mail = buildInvitationEmail({ inviterName: profile?.name || '', petName: claim.pet_name, role: claim.role, expiresAt: claim.expires_at, token, appUrl });

  const release = () => admin.rpc('release_invitation_email', { p_inviter: user.id, p_token: token });
  let res: Response;
  try {
    res = await ctx.fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Mascodata <noreply@mascodata.cl>', to: [claim.invited_email], subject: mail.subject, html: mail.html, text: mail.text }),
    });
  } catch (_e) {
    await release();
    return fail(502, 'send_failed');
  }
  if (!res.ok) { await release(); return fail(502, 'send_failed'); }
  return { status: 200, body: { ok: true } };
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
    console.error('send-invitation', err);
    return json(500, { error: 'server_error' });
  }));
}
