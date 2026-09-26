// Borra la cuenta del usuario que llama a esta función: sus mascotas (o
// transfiere la propiedad si tienen un segundo tutor), sus gastos/eventos/
// botiquín, su perfil, y finalmente la fila en auth.users.
//
// Existe como Edge Function — y no como una llamada directa desde el
// navegador — porque eliminar de auth.users requiere la clave de servicio
// (SUPABASE_SERVICE_ROLE_KEY), que nunca puede vivir en el cliente. Esta
// función corre server-side dentro del propio proyecto Supabase; Supabase le
// inyecta SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY como
// variables de entorno automáticamente, sin configuración manual.
//
// Deploy manual (igual que el resto del proyecto no usa la CLI de Supabase,
// ver supabase/README.md): Dashboard → Edge Functions → delete-account →
// Code → pegar este archivo → Deploy.
//
// La app la invoca vía sb.functions.invoke('delete-account', { body: { code } }) (ver
// verifyAccountDeleteCode() en js/auth.js), que adjunta automáticamente el
// token de sesión del usuario ya autenticado — nunca confiar en un userId
// que mande el propio request, siempre se toma del token verificado acá.
//
// EXIGE el código de verificación que envía `verification-codes` ("Código para
// eliminar tu cuenta"): se comprueba acá, en el servidor, con
// consume_verification_code (supabase/schema/verification_codes.sql). Sin un
// código válido no se borra nada, aunque alguien tenga la sesión abierta y
// llame a esta función directamente. Usa el secreto UNSUB_SECRET, el mismo de
// los recordatorios.

import { createClient } from 'npm:@supabase/supabase-js@2';

// mascodata.cl (y localhost al probar) llaman a esta función en otro
// dominio (*.supabase.co) — el navegador manda primero un OPTIONS de
// "preflight" antes del POST real. Sin estos headers en TODAS las
// respuestas (incluida la del preflight), el navegador bloquea la llamada
// entera como si fuera un error de CORS — nunca llega a ejecutarse el POST,
// aunque la función esté sana (por eso probar con curl directo sí andaba:
// curl no hace este chequeo, solo los navegadores).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Resumen del código (debe ser idéntico al de verification-codes/index.ts; un test comprueba que coinciden).
const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function hashCode(secret: string, userId: string, purpose: string, subject: string | null, code: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`code:${userId}:${purpose}:${subject ?? ''}:${code}`)));
}
export const normalizeCode = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'No autorizado' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Cliente con el token del usuario: solo sirve para confirmar quién es.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Sesión inválida' }, 401);
  }

  // Cliente con la clave de servicio: el único que puede saltarse RLS y
  // borrar de auth.users.
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = user.id;

  // Código de verificación: sin uno válido y vigente no se borra nada.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { /* sin cuerpo: el código queda vacío y se rechaza abajo */ }
  const code = normalizeCode(body.code);
  const secret = Deno.env.get('UNSUB_SECRET') ?? '';
  if (!secret) return json({ error: 'server_config' }, 500);
  if (code.length !== 6) return json({ error: 'code_invalid' }, 403);
  const { data: codeStatus, error: codeError } = await admin.rpc('consume_verification_code', {
    p_user: userId, p_purpose: 'delete_account', p_subject: null, p_hash: await hashCode(secret, userId, 'delete_account', null, code),
  });
  if (codeError) return json({ error: 'server_error' }, 500);
  if (codeStatus !== 'ok') return json({ error: `code_${codeStatus}` }, 403);

  try {
    // 1. Mascotas que posee: transferir al segundo tutor si tiene uno,
    //    borrar completa si no (la cascada de FK ya se prueba en el borrado
    //    normal de una mascota — ver deletePet() en js/pets.js — así que un
    //    solo delete sobre `pets` alcanza para limpiar vacunas,
    //    desparasitaciones, tratamientos, historial, etc.)
    const { data: ownedAccess, error: ownedError } = await admin
      .from('pet_access').select('pet_id').eq('user_id', userId).eq('role', 'owner');
    if (ownedError) throw ownedError;

    for (const { pet_id: petId } of ownedAccess || []) {
      const { data: otherAccess, error: otherError } = await admin
        .from('pet_access').select('user_id').eq('pet_id', petId).neq('user_id', userId).limit(1);
      if (otherError) throw otherError;
      const newOwner = otherAccess?.[0];

      if (newOwner) {
        const { error: e1 } = await admin.from('pets').update({ owner_id: newOwner.user_id }).eq('id', petId);
        if (e1) throw e1;
        const { error: e2 } = await admin.from('pet_access').update({ role: 'owner' }).eq('pet_id', petId).eq('user_id', newOwner.user_id);
        if (e2) throw e2;
        const { error: e3 } = await admin.from('pet_access').delete().eq('pet_id', petId).eq('user_id', userId);
        if (e3) throw e3;
      } else {
        const { error: e4 } = await admin.from('pets').delete().eq('id', petId);
        if (e4) throw e4;
      }
    }

    // 2. Lo que quede en pet_access a esta altura es acceso como tutor
    //    invitado en mascotas de OTRAS personas (las propias ya se resolvieron
    //    arriba) — se quita solo su acceso, la mascota y su historial quedan
    //    intactos para el dueño.
    const { error: accessError } = await admin.from('pet_access').delete().eq('user_id', userId);
    if (accessError) throw accessError;

    // 3. Datos propios que cuelgan del usuario directamente, no de una
    //    mascota — no cubiertos por la cascada del paso 1.
    const { error: evError } = await admin.from('events').delete().eq('user_id', userId);
    if (evError) throw evError;
    const { error: expError } = await admin.from('expenses').delete().eq('user_id', userId);
    if (expError) throw expError;
    const { error: botError } = await admin.from('botiquin_items').delete().eq('user_id', userId);
    if (botError) throw botError;

    // 4. Perfil — explícito en vez de confiar en un ON DELETE CASCADE que
    //    puede o no estar configurado en profiles.id → auth.users.id.
    const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
    if (profileError) throw profileError;

    // 5. La cuenta en sí.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ ok: true }, 200);
  } catch (e) {
    console.error('Error al eliminar cuenta:', e);
    return json({ error: 'No se pudo eliminar la cuenta' }, 500);
  }
}

// Solo arranca cuando corre en Deno / Supabase (los tests importan únicamente los helpers de arriba).
// deno-lint-ignore no-explicit-any
const DenoRef = (globalThis as any).Deno;
if (DenoRef?.serve) DenoRef.serve(handle);
