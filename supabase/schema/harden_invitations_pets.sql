-- Endurece invitaciones y dueño de la mascota (hallazgos 2, 3 y 4 de la auditoría de
-- seguridad, confirmados con pg_policies / information_schema.triggers / column_privileges).
-- Ejecutar completo en el SQL Editor. Es idempotente. No cambia lo que hace la app:
-- invitar a un segundo tutor, aceptar la invitación y quitar tutores siguen igual.
--
-- Qué corrige:
--   (2) Cualquier usuario podía crear una invitación para CUALQUIER mascota (la regla solo
--       pedía inviter_id = su uid) y luego darse acceso. Ahora solo el DUEÑO de la mascota
--       puede crear invitaciones, y solo para su mascota.
--   (4) Quien recibe una invitación podía reescribirla (rol, caducidad, pet_id, "usada").
--       Ahora lo único que puede hacer es marcarla como usada.
--   (3) Un editor podía cambiar pets.owner_id y quedarse con la mascota. Ahora el dueño solo
--       cambia desde el servidor (la función delete-account usa la clave de servicio).
--   Además, aceptar una invitación exige que quien la creó sea el dueño de esa mascota.

-- ---------------------------------------------------------------
-- 1) invitations: reglas separadas en vez de "ALL" con USING = inviter_id
-- ---------------------------------------------------------------
drop policy if exists "Inviters manage invitations" on public.invitations;
drop policy if exists "Owners create invitations" on public.invitations;
drop policy if exists "Inviters view own invitations" on public.invitations;
drop policy if exists "Inviters delete own invitations" on public.invitations;

create policy "Owners create invitations" on public.invitations
  for insert to authenticated
  with check (
    inviter_id = auth.uid()
    and exists (select 1 from public.pets p where p.id = invitations.pet_id and p.owner_id = auth.uid())
  );

create policy "Inviters view own invitations" on public.invitations
  for select to authenticated
  using (inviter_id = auth.uid());

create policy "Inviters delete own invitations" on public.invitations
  for delete to authenticated
  using (inviter_id = auth.uid());

-- ---------------------------------------------------------------
-- 2) invitations: quien acepta solo puede marcarla como usada
-- ---------------------------------------------------------------
create or replace function public.protect_invitation_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sin sesión de usuario (SQL Editor, clave de servicio) no se restringe.
  if auth.uid() is null then
    return new;
  end if;
  if (new.token, new.pet_id, new.pet_name, new.inviter_id, new.invited_email, new.invited_name, new.role, new.expires_at)
     is distinct from
     (old.token, old.pet_id, old.pet_name, old.inviter_id, old.invited_email, old.invited_name, old.role, old.expires_at) then
    raise exception 'Una invitación solo se puede marcar como usada' using errcode = '42501';
  end if;
  if old.used and not new.used then
    raise exception 'Una invitación usada no se puede reactivar' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_invitation_columns_trg on public.invitations;
create trigger protect_invitation_columns_trg
  before update on public.invitations
  for each row execute function public.protect_invitation_columns();

-- ---------------------------------------------------------------
-- 3) pets: el dueño no se puede cambiar desde el navegador
-- ---------------------------------------------------------------
create or replace function public.protect_pet_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.owner_id is distinct from old.owner_id then
    raise exception 'El dueño de la mascota no se puede cambiar' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_pet_owner_trg on public.pets;
create trigger protect_pet_owner_trg
  before update on public.pets
  for each row execute function public.protect_pet_owner();

-- ---------------------------------------------------------------
-- 4) pet_access: aceptar una invitación exige que la haya creado el dueño de la mascota
-- ---------------------------------------------------------------
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
        and exists (select 1 from public.pets p where p.id = i.pet_id and p.owner_id = i.inviter_id)
    )
  );

-- Para deshacer todo (solo si algo falla; después avisar):
--   drop trigger if exists protect_invitation_columns_trg on public.invitations;
--   drop trigger if exists protect_pet_owner_trg on public.pets;
--   (y volver a crear "Inviters manage invitations" y "Accept own invitation grants access"
--    con el texto que devolvió pg_policies antes de este cambio.)
