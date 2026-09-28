-- Arreglo: aceptar una invitación fallaba con "new row violates row-level security policy for table pet_access".
-- Ejecutar completo en el SQL Editor. Es idempotente.
--
-- La regla "Accept own invitation grants access" (harden_invitations_pets.sql) comprobaba con un subselect que quien invitó
-- es el dueño de la mascota. Ese subselect lee `pets` con los permisos de quien ACEPTA, que todavía no tiene acceso: ve 0
-- mascotas y la regla siempre rechazaba. Ahora la comprobación va en una función SECURITY DEFINER que solo responde sí o no.

create or replace function public.pet_owned_by(p_pet uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pets where id = p_pet and owner_id = p_owner);
$$;

revoke all on function public.pet_owned_by(uuid, uuid) from public, anon;
grant execute on function public.pet_owned_by(uuid, uuid) to authenticated;

drop policy if exists "Accept own invitation grants access" on public.pet_access;
create policy "Accept own invitation grants access" on public.pet_access
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.invitations i
      where i.pet_id = pet_access.pet_id
        and i.invited_email = auth.email()
        and i.used = false
        and i.expires_at > now()
        and i.role = case pet_access.role when 'editor' then 'edicion' when 'viewer' then 'lectura' else null end
        and public.pet_owned_by(i.pet_id, i.inviter_id)
    )
  );

-- Para deshacer: volver a crear la regla con el subselect a public.pets de harden_invitations_pets.sql (rechaza siempre).
