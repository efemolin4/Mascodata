// Recordatorios por correo para completar el perfil de una mascota.
//
// Corre una vez al día (pg_cron → esta función, ver
// supabase/schema/pet_reminders.sql). Busca mascotas cuyo perfil no está al
// 100 %, y a sus dueños les envía hasta 3 correos por mascota (día 2, 7 y 21
// desde que se creó), y como máximo 1 correo por persona a la semana entre
// mascotas distintas. Cada correo
// muestra el porcentaje, los próximos pasos de mayor peso y un enlace para
// dejar de recibir estos avisos.
//
// El cálculo del porcentaje es una COPIA de petCompleteness() en js/utils.js
// (misma lista de campos y pesos). Hay un test de paridad
// (js/pet-reminders.test.js) que falla si se desincronizan: si cambias uno,
// cambia el otro.
//
// Deploy manual (el proyecto no usa la CLI de Supabase, ver supabase/README.md):
// Dashboard → Edge Functions → New function "pet-completion-reminders" → pegar
// este archivo → Deploy. En la configuración de la función, DESACTIVAR
// "Verify JWT" (la protege su propio CRON_SECRET y el enlace de baja va firmado).
//
// Secretos (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   clave de la API de Resend con permiso de envío
//   CRON_SECRET      texto largo y aleatorio; lo usa el cron para llamar a la función
//   UNSUB_SECRET     otro texto largo y aleatorio; firma los enlaces de baja
//   APP_URL          (opcional) por defecto https://mascodata.cl
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase solas.
//
// Prueba sin enviar nada: llamar con ?dry=1 (y el mismo Authorization) devuelve
// a quiénes les escribiría, sin enviar ni guardar.

import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------- Puntaje de completitud (copia de js/utils.js) ----------
export interface PetRow {
  id: string; owner_id: string; name: string | null; species: string | null; breed: string | null;
  date_of_birth: string | null; sex: string | null; microchip: string | null; reproductive_status: string | null;
  weight_kg: number | string | null; allergies: string[] | null; chronic_conditions: string[] | string | null;
  vet_name: string | null; vet_phone: string | null; created_at: string;
}
export interface PetCtx { hasPhoto: boolean; hasVaccine: boolean; hasDeworm: boolean }

const list = (v: unknown) => Array.isArray(v) ? v.length > 0 : !!v;
const filled = (v: unknown) => !!(v && String(v).trim());

export const FIELDS: { key: string; points: number; label: string; hint: string; healthOnly?: boolean; has: (p: PetRow, c: PetCtx) => boolean }[] = [
  { key: 'basic',     points: 10, label: 'Nombre y especie',             hint: '',                                   has: p => !!(p.name && p.species) },
  { key: 'dob',       points: 12, label: 'Fecha de nacimiento',          hint: 'Activa las sugerencias por edad',    has: p => !!p.date_of_birth },
  { key: 'photo',     points: 7,  label: 'Foto',                         hint: 'Hace la ficha más tuya',             has: (_p, c) => c.hasPhoto },
  { key: 'breed',     points: 5,  label: 'Raza',                         hint: 'Activa las sugerencias por raza',    has: p => !!p.breed },
  { key: 'sex',       points: 3,  label: 'Sexo',                         hint: 'Dato básico de la ficha',            has: p => !!p.sex },
  { key: 'chip',      points: 3,  label: 'Microchip',                    hint: 'Útil si se pierde',                  has: p => !!p.microchip, healthOnly: true },
  { key: 'vaccine',   points: 16, label: 'Al menos una vacuna',          hint: 'Activa las alertas de vacunas',      has: (_p, c) => c.hasVaccine, healthOnly: true },
  { key: 'deworm',    points: 8,  label: 'Al menos una desparasitación', hint: 'Activa sus alertas',                 has: (_p, c) => c.hasDeworm, healthOnly: true },
  { key: 'allergies', points: 8,  label: 'Alergias y condiciones',       hint: 'Marca "Ninguna" si no tiene',        has: p => list(p.allergies) || list(p.chronic_conditions) },
  { key: 'weight',    points: 8,  label: 'Peso',                         hint: 'Alimenta el seguimiento',            has: p => Number(p.weight_kg) > 0 },
  { key: 'repro',     points: 5,  label: 'Estado reproductivo',          hint: 'Dato de la ficha',                   has: p => !!p.reproductive_status, healthOnly: true },
  { key: 'vetName',   points: 8,  label: 'Nombre del veterinario',       hint: 'Para tenerlo a mano en emergencias', has: p => filled(p.vet_name) },
  { key: 'vetPhone',  points: 7,  label: 'Teléfono del veterinario',     hint: 'Para llamar rápido',                 has: p => filled(p.vet_phone) },
];
const NO_HEALTH_SPECIES = ['Pez', 'Ave', 'Hámster', 'Reptil'];

export interface Missing { key: string; label: string; hint: string; gain: number; points: number }
export function scorePet(p: PetRow, c: PetCtx): { percent: number; missing: Missing[] } {
  const skipHealth = NO_HEALTH_SPECIES.includes(p.species ?? '');
  const fields = FIELDS.filter(f => !(skipHealth && f.healthOnly));
  const total = fields.reduce((a, f) => a + f.points, 0);
  const earned = fields.filter(f => f.has(p, c)).reduce((a, f) => a + f.points, 0);
  const missing = fields.filter(f => !f.has(p, c))
    .map(f => ({ key: f.key, label: f.label, hint: f.hint, gain: Math.round(f.points * 100 / total), points: f.points }))
    .sort((a, b) => b.points - a.points);
  return { percent: Math.round(earned * 100 / total), missing };
}

// ---------- Cadencia ----------
export const STEP_DAYS = [2, 7, 21];      // día desde que se creó la mascota en que toca cada aviso
export const MIN_USER_GAP_DAYS = 7;       // máximo 1 correo por persona a la semana
export const MAX_PER_RUN = 200;
const DAY = 86_400_000;

export interface Reminder { pet_id: string; user_id: string; step: number; sent_at: string }
export interface Profile { id: string; email: string | null; name: string | null; reminders_opt_out: boolean | null }
export interface Pick { pet: PetRow; profile: Profile; step: number; percent: number; missing: Missing[] }

export function pickReminders(input: {
  pets: PetRow[]; ctx: Record<string, PetCtx>; reminders: Reminder[]; profiles: Profile[]; now: Date;
}): Pick[] {
  const { pets, ctx, reminders, profiles, now } = input;
  const profById = new Map(profiles.map(p => [p.id, p]));
  const byPet = new Map<string, Reminder[]>();
  const byUser = new Map<string, Reminder[]>();
  for (const r of reminders) {
    (byPet.get(r.pet_id) ?? byPet.set(r.pet_id, []).get(r.pet_id)!).push(r);
    (byUser.get(r.user_id) ?? byUser.set(r.user_id, []).get(r.user_id)!).push(r);
  }
  const best = new Map<string, Pick>(); // una mascota por persona: la de perfil más incompleto
  for (const pet of pets) {
    const prof = profById.get(pet.owner_id);
    if (!prof || !prof.email || prof.reminders_opt_out === true) continue;
    const c = ctx[pet.id] ?? { hasPhoto: false, hasVaccine: false, hasDeworm: false };
    const { percent, missing } = scorePet(pet, c);
    if (percent >= 100) continue;
    const sent = byPet.get(pet.id) ?? [];
    const step = sent.length + 1;
    if (step > STEP_DAYS.length) continue;
    const ageDays = Math.floor((now.getTime() - Date.parse(pet.created_at)) / DAY);
    if (ageDays < STEP_DAYS[step - 1]) continue;
    // Entre dos avisos de la misma mascota se respeta la separación del calendario (5 días
    // entre el 1.º y el 2.º, 14 entre el 2.º y el 3.º), aunque la mascota ya sea antigua
    // (así una mascota creada hace un mes no recibe sus 3 avisos seguidos).
    const lastPet = Math.max(0, ...sent.map(r => Date.parse(r.sent_at)));
    const minGapDays = step === 1 ? 0 : STEP_DAYS[step - 1] - STEP_DAYS[step - 2];
    if (lastPet && now.getTime() - lastPet < minGapDays * DAY) continue;
    // El tope semanal es entre mascotas distintas: los pasos de UNA misma mascota ya
    // van separados por el calendario (STEP_DAYS).
    const lastOther = Math.max(0, ...(byUser.get(pet.owner_id) ?? []).filter(r => r.pet_id !== pet.id).map(r => Date.parse(r.sent_at)));
    if (lastOther && now.getTime() - lastOther < MIN_USER_GAP_DAYS * DAY) continue;
    const cur = best.get(pet.owner_id);
    if (!cur || percent < cur.percent) best.set(pet.owner_id, { pet, profile: prof, step, percent, missing });
  }
  return [...best.values()].sort((a, b) => a.pet.id.localeCompare(b.pet.id)).slice(0, MAX_PER_RUN);
}

// Solo cuentan las mascotas donde el dueño tiene una fila de acceso (pet_access, rol 'owner'):
// una mascota sin esa fila existe en la tabla pero la persona no la ve ni la puede completar
// (por ejemplo, tras un borrado que falló a medias), y escribirle sobre ella no tendría sentido.
export function withOwnerAccess(pets: PetRow[], access: { pet_id: string; user_id: string; role: string }[]): PetRow[] {
  const owners = new Set(access.filter(a => a.role === 'owner').map(a => `${a.pet_id}:${a.user_id}`));
  return pets.filter(p => owners.has(`${p.id}:${p.owner_id}`));
}

// ---------- Enlace de baja firmado ----------
const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function signUnsub(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`unsub:${userId}`)));
}
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function verifyUnsub(userId: string, sig: string, secret: string): Promise<boolean> {
  if (!secret || !userId || !sig) return false;
  return safeEqual(await signUnsub(userId, secret), sig);
}

// ---------- Correo ----------
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const INTRO = [
  'Registraste a {name} en Mascodata. Con unos datos más, podemos recordarte lo importante a tiempo.',
  'Un recordatorio corto: al perfil de {name} todavía le faltan estos pasos.',
  'Este es el último recordatorio sobre el perfil de {name}. No te enviaremos más avisos sobre esta mascota.',
];
export function buildEmail(p: Pick, o: { appUrl: string; unsubUrl: string }): { subject: string; html: string; text: string } {
  const name = (p.pet.name || '').trim() || 'tu mascota';
  const steps = p.missing.slice(0, 3);
  const link = `${o.appUrl}/pets/${encodeURIComponent(p.pet.id)}`;
  const intro = INTRO[p.step - 1].replace('{name}', name);
  const subject = `El perfil de ${name} está al ${p.percent} %`;
  const pct = Math.min(99, Math.max(1, p.percent));
  const rows = steps.map(m => `<tr><td style="padding:10px 0;border-top:1px solid #DFE3F4"><span style="display:inline-block;background:#E7F1FF;color:#4C5FD7;font-weight:700;font-size:12px;padding:3px 8px;border-radius:8px;margin-right:10px">+${m.gain} %</span><strong style="color:#252A62">${esc(m.label)}</strong>${m.hint ? `<div style="color:#626A8A;font-size:13px;margin:2px 0 0 0">${esc(m.hint)}</div>` : ''}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F8F9FF;font-family:Arial,Helvetica,sans-serif;color:#252A62">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FF"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid #DFE3F4;border-radius:20px">
<tr><td style="padding:26px 28px 6px 28px"><img src="${esc(o.appUrl)}/img/logos/mascodata-app-icon.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px"> <span style="font-size:18px;font-weight:800;color:#252A62;vertical-align:middle;margin-left:6px">Mascodata</span></td></tr>
<tr><td style="padding:14px 28px 0 28px"><h1 style="margin:0;font-size:22px;line-height:28px;color:#252A62">El perfil de ${esc(name)} está al ${p.percent} %</h1>
<p style="margin:10px 0 18px 0;font-size:15px;line-height:24px;color:#626A8A">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="${pct}%" bgcolor="#4C5FD7" style="height:10px;font-size:0;line-height:0;border-radius:6px 0 0 6px">&nbsp;</td><td width="${100 - pct}%" bgcolor="#E7F1FF" style="height:10px;font-size:0;line-height:0;border-radius:0 6px 6px 0">&nbsp;</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">${rows}</table>
<p style="margin:24px 0 8px 0"><a href="${esc(link)}" style="display:inline-block;background:#4C5FD7;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:14px">Completar el perfil de ${esc(name)}</a></p></td></tr>
<tr><td style="padding:22px 28px 26px 28px;font-size:12px;line-height:18px;color:#626A8A">Recibes este correo porque registraste a ${esc(name)} en Mascodata.<br><a href="${esc(o.unsubUrl)}" style="color:#4C5FD7">Dejar de recibir estos recordatorios</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${intro}\n\n${steps.map(m => `- +${m.gain} % ${m.label}${m.hint ? ` (${m.hint})` : ''}`).join('\n')}\n\nCompletar el perfil: ${link}\n\nRecibes este correo porque registraste a ${name} en Mascodata.\nDejar de recibir estos recordatorios: ${o.unsubUrl}\n`;
  return { subject, html, text };
}

// ---------- Servidor (solo cuando corre en Deno / Supabase; los tests solo importan lo de arriba) ----------
// deno-lint-ignore no-explicit-any
const DenoRef = (globalThis as any).Deno;

async function chunkedIn<T>(admin: any, table: string, select: string, column: string, ids: string[], extra?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    let q = admin.from(table).select(select).in(column, ids.slice(i, i + 100));
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

async function handle(req: Request): Promise<Response> {
  const env = (k: string) => DenoRef.env.get(k) ?? '';
  const url = new URL(req.url);
  const appUrl = (env('APP_URL') || 'https://mascodata.cl').replace(/\/$/, '');
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  // Baja: enlace firmado del correo (GET) o "one-click" de los clientes de correo (POST).
  const unsubUser = url.searchParams.get('unsub');
  if (unsubUser) {
    const ok = await verifyUnsub(unsubUser, url.searchParams.get('t') ?? '', env('UNSUB_SECRET'));
    if (ok) await admin.from('profiles').update({ reminders_opt_out: true }).eq('id', unsubUser);
    if (req.method === 'POST') return new Response(ok ? 'ok' : 'firma inválida', { status: ok ? 200 : 400 });
    return new Response(null, { status: 302, headers: { Location: `${appUrl}/recordatorios?estado=${ok ? 'ok' : 'error'}` } });
  }

  // Ejecución del cron.
  const cron = env('CRON_SECRET');
  const auth = req.headers.get('Authorization') ?? '';
  if (!cron || !safeEqual(auth, `Bearer ${cron}`)) return new Response('No autorizado', { status: 401 });
  const dry = url.searchParams.get('dry') === '1';
  const now = new Date();

  const since = new Date(now.getTime() - 60 * DAY).toISOString();
  const { data: petsData, error: petsErr } = await admin.from('pets')
    .select('id, owner_id, name, species, breed, date_of_birth, sex, microchip, reproductive_status, weight_kg, allergies, chronic_conditions, vet_name, vet_phone, created_at')
    .gte('created_at', since).limit(2000);
  if (petsErr) return new Response(`pets: ${petsErr.message}`, { status: 500 });
  const allPets = (petsData ?? []) as PetRow[];
  const access = await chunkedIn<{ pet_id: string; user_id: string; role: string }>(admin, 'pet_access', 'pet_id, user_id, role', 'pet_id', allPets.map(p => p.id));
  const pets = withOwnerAccess(allPets, access);
  const petIds = pets.map(p => p.id);
  const ownerIds = [...new Set(pets.map(p => p.owner_id))];

  const photoIds = new Set((await chunkedIn<{ id: string }>(admin, 'pets', 'id', 'id', petIds, q => q.not('photo', 'is', null))).map(r => r.id));
  const vaccIds = new Set((await chunkedIn<{ pet_id: string }>(admin, 'vaccines', 'pet_id', 'pet_id', petIds)).map(r => r.pet_id));
  const dewIds = new Set((await chunkedIn<{ pet_id: string }>(admin, 'dewormings', 'pet_id', 'pet_id', petIds)).map(r => r.pet_id));
  const profiles = await chunkedIn<Profile>(admin, 'profiles', 'id, email, name, reminders_opt_out', 'id', ownerIds);
  const reminders = await chunkedIn<Reminder>(admin, 'pet_reminders', 'pet_id, user_id, step, sent_at', 'user_id', ownerIds);
  const ctx: Record<string, PetCtx> = {};
  for (const p of pets) ctx[p.id] = { hasPhoto: photoIds.has(p.id), hasVaccine: vaccIds.has(p.id), hasDeworm: dewIds.has(p.id) };

  const picks = pickReminders({ pets, ctx, reminders, profiles, now });
  const summary = { dry, pets_considered: pets.length, skipped_without_access: allPets.length - pets.length, candidates: picks.length, sent: 0, skipped_duplicate: 0, errors: 0,
    would_send: dry ? picks.map(p => ({ pet: (p.pet.name || '').trim(), step: p.step, percent: p.percent, next: p.missing.slice(0, 3).map(m => m.key) })) : undefined };
  if (dry) return Response.json(summary);

  const fnUrl = `${env('SUPABASE_URL')}/functions/v1/pet-completion-reminders`;
  for (const p of picks) {
    // Reserva primero (unique pet_id+step): si dos ejecuciones se pisan, solo una envía.
    const { error: resErr } = await admin.from('pet_reminders').insert({ pet_id: p.pet.id, user_id: p.pet.owner_id, step: p.step, percent_at_send: p.percent });
    if (resErr) { if (resErr.code === '23505') summary.skipped_duplicate++; else summary.errors++; continue; }
    const sig = await signUnsub(p.pet.owner_id, env('UNSUB_SECRET'));
    const unsubUrl = `${fnUrl}?unsub=${encodeURIComponent(p.pet.owner_id)}&t=${sig}`;
    const mail = buildEmail(p, { appUrl, unsubUrl });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mascodata <noreply@mascodata.cl>', to: [p.profile.email], subject: mail.subject, html: mail.html, text: mail.text,
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    });
    if (res.ok) summary.sent++;
    else {
      summary.errors++;
      console.error('Resend rechazó el envío', res.status, await res.text());
      await admin.from('pet_reminders').delete().eq('pet_id', p.pet.id).eq('step', p.step); // libera la reserva para reintentar mañana
    }
  }
  return Response.json(summary);
}

if (DenoRef?.serve) {
  DenoRef.serve((req: Request) => handle(req).catch(err => {
    console.error('pet-completion-reminders', err);
    return new Response('Error interno', { status: 500 });
  }));
}
