// Aviso por correo de "el alimento de tu mascota se está acabando".
//
// Corre una vez al día (pg_cron → esta función, ver
// supabase/schema/food_restock_reminders.sql). Para cada alimento DIARIO con
// consumo (o duración) indicado calcula cuándo se acaba (fecha de compra + días
// que dura el paquete) y, cuando faltan 3 días o menos, avisa al DUEÑO de la mascota.
// Un solo correo por persona por corrida, aunque tenga varios alimentos por acabarse.
//
// Reglas:
//   - Solo alimento diario (los snacks no avisan) con tamaño de paquete, consumo y
//     fecha de compra. Sin esos datos no se estima nada.
//   - Un aviso por alimento y por ciclo de compra (food_restock_reminders); al reponer
//     (cambia la fecha de compra) el siguiente ciclo puede avisar de nuevo.
//   - Ventana: desde 3 días antes hasta 3 días después de la fecha estimada; pasada
//     la ventana no se insiste (el alimento probablemente ya se repuso sin anotarlo).
//   - Solo a dueños (pet_access rol 'owner'), y respeta profiles.reminders_opt_out
//     (el mismo interruptor de los recordatorios de perfil).
//   - Si esa persona recibió un recordatorio de perfil en las últimas 24 h, espera al
//     día siguiente (entra dentro de la ventana de gracia).
//
// Deploy manual (ver supabase/README.md): Dashboard → Edge Functions → New function
// "food-restock-reminders" → pegar este archivo → Deploy, y DESACTIVAR "Verify JWT".
// Usa los mismos secretos que pet-completion-reminders: RESEND_API_KEY, CRON_SECRET,
// UNSUB_SECRET y (opcional) APP_URL.
//
// Prueba sin enviar nada: ?dry=1 (con el mismo Authorization) lista a quién le escribiría.

import { createClient } from 'npm:@supabase/supabase-js@2';

// ---------- Reglas ----------
export const LEAD_DAYS = 3;          // avisar cuando faltan 3 días o menos
export const GRACE_DAYS = 3;         // y hasta 3 días después de la fecha estimada
export const MAX_ITEMS_PER_EMAIL = 5;
export const MAX_PER_RUN = 40;       // Resend gratis permite 100 correos/día en total
export const PROFILE_MAIL_GAP_MS = 24 * 3_600_000;
const DAY = 86_400_000;

export interface FoodRow {
  id: string; pet_id: string; product: string | null; type: string | null; category?: string | null;
  package_size: number | string | null; package_unit: string | null; daily_amount: number | string | null; purchase_date: string | null;
}
export interface PetLite { id: string; owner_id: string; name: string | null }
export interface Profile { id: string; email: string | null; name: string | null; reminders_opt_out: boolean | null }
export interface SentRow { food_item_id: string; cycle_date: string }
export interface Item { food: FoodRow; pet: PetLite; runOut: string; daysLeft: number }
export interface Pick { profile: Profile; items: Item[] }

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);
const addDaysIso = (iso: string, n: number) => new Date((dayNumber(iso) + n) * DAY).toISOString().slice(0, 10);

// Alimento diario: 'snack' (o el tipo "Snack" de los registros antiguos) no genera aviso.
export function isDaily(f: FoodRow): boolean {
  return f.category !== 'snack' && f.type !== 'Snack';
}

// Cuándo se acaba: fecha de compra + días que dura el paquete (tamaño ÷ consumo diario).
export function runOutDate(f: FoodRow): string | null {
  const size = Number(f.package_size), daily = Number(f.daily_amount);
  if (!(size > 0) || !(daily > 0) || !f.purchase_date) return null;
  return addDaysIso(f.purchase_date, Math.floor(size / daily));
}

export function pickRestocks(input: {
  foods: FoodRow[]; pets: PetLite[]; profiles: Profile[]; sent: SentRow[];
  lastProfileMail: Record<string, number>; now: Date;
}): Pick[] {
  const { foods, pets, profiles, sent, lastProfileMail, now } = input;
  const petById = new Map(pets.map(p => [p.id, p]));
  const profById = new Map(profiles.map(p => [p.id, p]));
  const done = new Set(sent.map(s => `${s.food_item_id}:${s.cycle_date.slice(0, 10)}`));
  const today = dayNumber(now.toISOString());
  const byUser = new Map<string, Item[]>();
  for (const food of foods) {
    if (!isDaily(food)) continue;
    const pet = petById.get(food.pet_id);
    const runOut = runOutDate(food);
    if (!pet || !runOut) continue;
    const daysLeft = dayNumber(runOut) - today;
    if (daysLeft > LEAD_DAYS || daysLeft < -GRACE_DAYS) continue;
    if (done.has(`${food.id}:${food.purchase_date!.slice(0, 10)}`)) continue;
    (byUser.get(pet.owner_id) ?? byUser.set(pet.owner_id, []).get(pet.owner_id)!).push({ food, pet, runOut, daysLeft });
  }
  const picks: Pick[] = [];
  for (const [userId, items] of byUser) {
    const profile = profById.get(userId);
    if (!profile || !profile.email || profile.reminders_opt_out === true) continue;
    const last = lastProfileMail[userId];
    if (last && now.getTime() - last < PROFILE_MAIL_GAP_MS) continue;
    items.sort((a, b) => a.daysLeft - b.daysLeft || a.food.id.localeCompare(b.food.id));
    picks.push({ profile, items: items.slice(0, MAX_ITEMS_PER_EMAIL) });
  }
  return picks.sort((a, b) => a.profile.id.localeCompare(b.profile.id)).slice(0, MAX_PER_RUN);
}

// Solo cuentan las mascotas donde el dueño tiene una fila de acceso con rol 'owner'.
export function withOwnerAccess(pets: PetLite[], access: { pet_id: string; user_id: string; role: string }[]): PetLite[] {
  const owners = new Set(access.filter(a => a.role === 'owner').map(a => `${a.pet_id}:${a.user_id}`));
  return pets.filter(p => owners.has(`${p.id}:${p.owner_id}`));
}

// ---------- Enlace de baja firmado (misma firma que pet-completion-reminders) ----------
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

// Búsqueda en Google Shopping (enlace que abre la persona; no se extrae nada).
export function offerUrl(f: FoodRow): string {
  const size = f.package_unit === 'kg' || f.package_unit === 'g' ? `${Number(f.package_size) || ''} ${f.package_unit}` : '';
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${f.product ?? ''} ${size}`.replace(/\s+/g, ' ').trim())}`;
}

const whenEnds = (d: number) => d > 1 ? `se acaba en ${d} días` : d === 1 ? 'se acaba mañana' : d === 0 ? 'se acaba hoy' : 'ya debería haberse acabado';
const dateEs = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export function buildRestockEmail(p: Pick, o: { appUrl: string; unsubUrl: string }): { subject: string; html: string; text: string } {
  const label = (it: Item) => (it.pet.name || '').trim() || 'tu mascota';
  const first = p.items[0];
  const subject = p.items.length === 1
    ? `El alimento de ${label(first)} ${whenEnds(first.daysLeft)}`
    : `Tienes ${p.items.length} alimentos por acabarse`;
  const rows = p.items.map(it => {
    const link = `${o.appUrl}/pets/${encodeURIComponent(it.pet.id)}`;
    const state = it.daysLeft < 0 ? `Se estimaba que se acababa el ${dateEs(it.runOut)}` : `Se estima que se acaba el ${dateEs(it.runOut)}`;
    return `<tr><td style="padding:14px 0;border-top:1px solid #DFE3F4"><strong style="color:#252A62;font-size:15px">${esc(it.food.product || 'Alimento')}</strong> <span style="color:#626A8A;font-size:13px">· ${esc(label(it))}</span>
<div style="color:#626A8A;font-size:13px;margin:3px 0 10px 0">${esc(state)}</div>
<a href="${esc(offerUrl(it.food))}" style="display:inline-block;background:#4C5FD7;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;padding:9px 14px;border-radius:10px;margin-right:6px">Buscar oferta</a><a href="${esc(link)}" style="display:inline-block;color:#4C5FD7;text-decoration:none;font-weight:700;font-size:13px;padding:8px 13px;border:1px solid #C9D2F5;border-radius:10px">Ya repuse</a></td></tr>`;
  }).join('');
  const names = [...new Set(p.items.map(label))].join(', ');
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F8F9FF;font-family:Arial,Helvetica,sans-serif;color:#252A62">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FF"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFFFF;border:1px solid #DFE3F4;border-radius:20px">
<tr><td style="padding:26px 28px 6px 28px"><img src="${esc(o.appUrl)}/img/logos/mascodata-app-icon.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px"> <span style="font-size:18px;font-weight:800;color:#252A62;vertical-align:middle;margin-left:6px">Mascodata</span></td></tr>
<tr><td style="padding:14px 28px 0 28px"><h1 style="margin:0;font-size:22px;line-height:28px;color:#252A62">${esc(subject)}</h1>
<p style="margin:10px 0 8px 0;font-size:15px;line-height:24px;color:#626A8A">Según lo que registraste, es buen momento para reponerlo. Si ya lo compraste, marca "Ya repuse" en la ficha y el conteo parte de nuevo.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">${rows}</table></td></tr>
<tr><td style="padding:22px 28px 26px 28px;font-size:12px;line-height:18px;color:#626A8A">Recibes este correo porque registraste el alimento de ${esc(names)} en Mascodata. Es una estimación a partir de los datos que ingresaste.<br><a href="${esc(o.unsubUrl)}" style="color:#4C5FD7">Dejar de recibir estos recordatorios</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}\n\nSegún lo que registraste, es buen momento para reponerlo.\n\n${p.items.map(it => `- ${it.food.product || 'Alimento'} (${label(it)}): ${it.daysLeft < 0 ? 'se estimaba que se acababa' : 'se estima que se acaba'} el ${dateEs(it.runOut)}\n  Buscar oferta: ${offerUrl(it.food)}\n  Ya repuse: ${o.appUrl}/pets/${encodeURIComponent(it.pet.id)}`).join('\n')}\n\nRecibes este correo porque registraste el alimento de ${names} en Mascodata.\nDejar de recibir estos recordatorios: ${o.unsubUrl}\n`;
  return { subject, html, text };
}

// ---------- Servidor (solo cuando corre en Deno / Supabase; los tests solo importan lo de arriba) ----------
// deno-lint-ignore no-explicit-any
const DenoRef = (globalThis as any).Deno;

// deno-lint-ignore no-explicit-any
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

  const { data: foodData, error: foodErr } = await admin.from('food_items').select('*')
    .gt('daily_amount', 0).not('purchase_date', 'is', null)
    .gte('purchase_date', new Date(now.getTime() - 400 * DAY).toISOString().slice(0, 10)).limit(5000);
  if (foodErr) return new Response(`food_items: ${foodErr.message}`, { status: 500 });
  const foods = ((foodData ?? []) as FoodRow[]).filter(f => isDaily(f) && runOutDate(f));

  const petIds = [...new Set(foods.map(f => f.pet_id))];
  const allPets = await chunkedIn<PetLite>(admin, 'pets', 'id, owner_id, name', 'id', petIds);
  const access = await chunkedIn<{ pet_id: string; user_id: string; role: string }>(admin, 'pet_access', 'pet_id, user_id, role', 'pet_id', allPets.map(p => p.id));
  const pets = withOwnerAccess(allPets, access);
  const ownerIds = [...new Set(pets.map(p => p.owner_id))];

  const profiles = await chunkedIn<Profile>(admin, 'profiles', 'id, email, name, reminders_opt_out', 'id', ownerIds);
  const sent = await chunkedIn<SentRow>(admin, 'food_restock_reminders', 'food_item_id, cycle_date', 'food_item_id', foods.map(f => f.id));
  const since = new Date(now.getTime() - PROFILE_MAIL_GAP_MS).toISOString();
  const recent = await chunkedIn<{ user_id: string; sent_at: string }>(admin, 'pet_reminders', 'user_id, sent_at', 'user_id', ownerIds, q => q.gte('sent_at', since));
  const lastProfileMail: Record<string, number> = {};
  for (const r of recent) lastProfileMail[r.user_id] = Math.max(lastProfileMail[r.user_id] ?? 0, Date.parse(r.sent_at));

  const picks = pickRestocks({ foods, pets, profiles, sent, lastProfileMail, now });
  const summary = { dry, foods_considered: foods.length, skipped_without_access: allPets.length - pets.length, candidates: picks.length, sent: 0, skipped_duplicate: 0, errors: 0,
    would_send: dry ? picks.map(p => ({ items: p.items.map(i => ({ pet: (i.pet.name || '').trim(), product: i.food.product, days_left: i.daysLeft })) })) : undefined };
  if (dry) return Response.json(summary);

  const fnUrl = `${env('SUPABASE_URL')}/functions/v1/food-restock-reminders`;
  for (const p of picks) {
    // Reserva primero (unique food_item_id + cycle_date): si dos ejecuciones se pisan, solo una envía.
    const reserved: Item[] = [];
    for (const it of p.items) {
      const { error } = await admin.from('food_restock_reminders').insert({ food_item_id: it.food.id, user_id: p.profile.id, cycle_date: it.food.purchase_date!.slice(0, 10) });
      if (!error) reserved.push(it);
      else if (error.code === '23505') summary.skipped_duplicate++;
      else summary.errors++;
    }
    if (!reserved.length) continue;
    const sig = await signUnsub(p.profile.id, env('UNSUB_SECRET'));
    const unsubUrl = `${fnUrl}?unsub=${encodeURIComponent(p.profile.id)}&t=${sig}`;
    const mail = buildRestockEmail({ profile: p.profile, items: reserved }, { appUrl, unsubUrl });
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
      for (const it of reserved) await admin.from('food_restock_reminders').delete().eq('food_item_id', it.food.id).eq('cycle_date', it.food.purchase_date!.slice(0, 10)); // libera la reserva para reintentar mañana
    }
  }
  return Response.json(summary);
}

if (DenoRef?.serve) {
  DenoRef.serve((req: Request) => handle(req).catch(err => {
    console.error('food-restock-reminders', err);
    return new Response('Error interno', { status: 500 });
  }));
}
