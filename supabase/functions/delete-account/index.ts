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
// ver supabase/README.md): Dashboard → Edge Functions → New Function →
// nombre "delete-account" → pegar este archivo → Deploy.
//
// La app la invoca vía sb.functions.invoke('delete-account') (ver
// verifyAccountDeleteCode() en js/auth.js), que adjunta automáticamente el
// token de sesión del usuario ya autenticado — nunca confiar en un userId
// que mande el propio request, siempre se toma del token verificado acá.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
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
    return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401 });
  }

  // Cliente con la clave de servicio: el único que puede saltarse RLS y
  // borrar de auth.users.
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = user.id;

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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error al eliminar cuenta:', e);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la cuenta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
