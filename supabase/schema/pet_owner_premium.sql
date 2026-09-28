-- Las funciones de una mascota (exportar su expediente, adjuntos ilimitados) siguen al plan de su DUEÑO: quien la cuida con él
-- las ve igual, con el permiso que se le dio. Un invitado no puede leer el perfil del dueño, así que la base guarda en cada
-- mascota una marca simple "su dueño es Premium" y la mantiene sola. Ejecutar completo en el SQL Editor. Es idempotente.
-- Es seguro ejecutarlo antes de publicar la app nueva: la app anterior no usa esta columna.

alter table public.pets add column if not exists owner_premium boolean not null default false;

-- ¿Es Premium esta persona? (mismo criterio que la app: PAID_PLAN_IDS = ['premium'])
create or replace function public.profile_is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select plan = 'premium' from public.profiles where id = p_user), false);
$$;
revoke all on function public.profile_is_premium(uuid) from public, anon, authenticated;

-- Al crear una mascota, y al cambiar su dueño (delete-account lo transfiere), se calcula desde el plan del dueño.
-- Cualquier otro intento de cambiar la marca desde el navegador se ignora; solo la sincronización de abajo puede.
create or replace function public.pets_owner_premium_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.owner_premium := public.profile_is_premium(new.owner_id);
  elsif new.owner_id is distinct from old.owner_id then
    new.owner_premium := public.profile_is_premium(new.owner_id);
  elsif coalesce(current_setting('mascodata.sync_premium', true), '') <> '1' then
    new.owner_premium := old.owner_premium;
  end if;
  return new;
end;
$$;

drop trigger if exists pets_owner_premium_guard_trg on public.pets;
create trigger pets_owner_premium_guard_trg
  before insert or update on public.pets
  for each row execute function public.pets_owner_premium_guard();

-- Cuando cambia el plan de una persona, sus mascotas siguen ese cambio.
create or replace function public.sync_pets_owner_premium()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('mascodata.sync_premium', '1', true);
  update public.pets set owner_premium = (new.plan = 'premium') where owner_id = new.id;
  perform set_config('mascodata.sync_premium', '', true);
  return new;
end;
$$;

drop trigger if exists sync_pets_owner_premium_trg on public.profiles;
create trigger sync_pets_owner_premium_trg
  after update of plan on public.profiles
  for each row when (old.plan is distinct from new.plan)
  execute function public.sync_pets_owner_premium();

-- Las mascotas que ya existen.
do $$
begin
  perform set_config('mascodata.sync_premium', '1', true);
  update public.pets p set owner_premium = public.profile_is_premium(p.owner_id)
   where p.owner_premium is distinct from public.profile_is_premium(p.owner_id);
  perform set_config('mascodata.sync_premium', '', true);
end
$$;

-- Para deshacer (solo si algo falla; después avisar):
--   drop trigger if exists sync_pets_owner_premium_trg on public.profiles;
--   drop trigger if exists pets_owner_premium_guard_trg on public.pets;
--   (la columna owner_premium puede quedarse: la app anterior la ignora.)
