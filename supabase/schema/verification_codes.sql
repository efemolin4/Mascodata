-- Códigos de verificación para acciones destructivas (eliminar la cuenta, eliminar una mascota o dejar de ver una compartida).
-- Ejecutar completo en el SQL Editor. Es idempotente.
--
-- Antes el código lo enviaba Supabase Auth ("Magic Link") y solo lo comprobaba el navegador: quien tuviera la sesión abierta
-- podía saltarse ese paso hablando directo con la base. Ahora:
--   * Las Edge Functions `verification-codes` y `delete-account` generan y envían el código con un correo propio de cada
--     acción, y EXIGEN el código en el servidor antes de borrar.
--   * La tabla no tiene ninguna regla de acceso: solo el servidor (clave de servicio) la lee o escribe.
--   * Solo se guarda un resumen (hash HMAC) del código, nunca el código.
--   * Toda la lógica de vigencia, intentos y límites vive aquí, en dos funciones SQL, para no duplicarla.
--   * Cerrar el borrado directo de mascotas desde el navegador va aparte, para hacerlo AL FINAL: close_direct_pet_delete.sql.

create table if not exists public.verification_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  purpose    text not null check (purpose in ('delete_account', 'delete_pet')),
  subject_id uuid,                                   -- la mascota, en 'delete_pet'
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verification_codes_lookup_idx
  on public.verification_codes (user_id, purpose, created_at desc);

alter table public.verification_codes enable row level security;  -- sin políticas: solo el servidor

-- Registra un código nuevo. Devuelve 'ok', 'too_soon' (menos de 60 s desde el anterior de esa acción) o
-- 'too_many' (más de 5 códigos en la última hora). Descarta los códigos anteriores sin usar de la misma acción.
create or replace function public.create_verification_code(p_user uuid, p_purpose text, p_subject uuid, p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare last_at timestamptz;
begin
  select max(created_at) into last_at from public.verification_codes
   where user_id = p_user and purpose = p_purpose and subject_id is not distinct from p_subject;
  if last_at is not null and last_at > now() - interval '60 seconds' then
    return 'too_soon';
  end if;
  if (select count(*) from public.verification_codes where user_id = p_user and created_at > now() - interval '1 hour') >= 5 then
    return 'too_many';
  end if;
  delete from public.verification_codes
   where user_id = p_user and purpose = p_purpose and subject_id is not distinct from p_subject and used_at is null;
  insert into public.verification_codes (user_id, purpose, subject_id, code_hash, expires_at)
  values (p_user, p_purpose, p_subject, p_hash, now() + interval '10 minutes');
  return 'ok';
end;
$$;

-- Comprueba y consume el código. Devuelve 'ok', 'invalid', 'expired' o 'locked' (5 intentos fallidos). Un código sirve una sola vez.
create or replace function public.consume_verification_code(p_user uuid, p_purpose text, p_subject uuid, p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare r public.verification_codes%rowtype;
begin
  select * into r from public.verification_codes
   where user_id = p_user and purpose = p_purpose and subject_id is not distinct from p_subject and used_at is null
   order by created_at desc limit 1
   for update;
  if not found then return 'invalid'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.attempts >= 5 then return 'locked'; end if;
  if r.code_hash <> p_hash then
    update public.verification_codes set attempts = attempts + 1 where id = r.id;
    return 'invalid';
  end if;
  update public.verification_codes set used_at = now() where id = r.id;
  return 'ok';
end;
$$;

-- Solo el servidor puede llamarlas.
revoke all on function public.create_verification_code(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_verification_code(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_verification_code(uuid, text, uuid, text) to service_role;
grant execute on function public.consume_verification_code(uuid, text, uuid, text) to service_role;
