-- Agenda compartida entre tutores + modalidad de cuidado (viven juntos / tutores separados).
-- Ejecutar completo en el SQL Editor. Es idempotente.
--
--  * events: los eventos que tienen mascota los ven TODOS los tutores de esa mascota (antes eran
--    personales). Quien puede editar la mascota (dueño y editores) puede modificarlos y borrarlos;
--    los que no tienen mascota siguen siendo solo de quien los creó.
--  * events.end_date / events.holder: una "Estadía" tiene fecha de inicio y de fin, y dice quién
--    tiene la mascota en ese período ('owner' = el dueño, 'guest' = el otro tutor).
--  * pets.care_mode: 'together' (viven juntos, por defecto) o 'separated' (tutores separados).

alter table public.events add column if not exists end_date date;
alter table public.events add column if not exists holder text;
alter table public.events drop constraint if exists events_holder_check;
alter table public.events add constraint events_holder_check check (holder is null or holder in ('owner', 'guest'));
alter table public.events drop constraint if exists events_end_after_start_check;
alter table public.events add constraint events_end_after_start_check check (end_date is null or end_date >= date);

alter table public.pets add column if not exists care_mode text not null default 'together';
alter table public.pets drop constraint if exists pets_care_mode_check;
alter table public.pets add constraint pets_care_mode_check check (care_mode in ('together', 'separated'));

-- ---------------------------------------------------------------
-- Reglas de events (reemplazan a "Users manage own events")
-- ---------------------------------------------------------------
drop policy if exists "Users manage own events" on public.events;
drop policy if exists "Events visible to pet tutors" on public.events;
drop policy if exists "Editors create events" on public.events;
drop policy if exists "Editors update events" on public.events;
drop policy if exists "Editors delete events" on public.events;

create policy "Events visible to pet tutors" on public.events
  for select to public
  using (user_id = auth.uid() or (pet_id is not null and pet_accessible(pet_id)));

create policy "Editors create events" on public.events
  for insert to public
  with check (user_id = auth.uid() and (pet_id is null or pet_editor(pet_id)));

create policy "Editors update events" on public.events
  for update to public
  using (user_id = auth.uid() or (pet_id is not null and pet_editor(pet_id)))
  with check ((pet_id is null and user_id = auth.uid()) or (pet_id is not null and pet_editor(pet_id)));

create policy "Editors delete events" on public.events
  for delete to public
  using (user_id = auth.uid() or (pet_id is not null and pet_editor(pet_id)));

-- Quien edita un evento ajeno no puede cambiar de quién es (user_id).
create or replace function public.protect_event_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar el autor de un evento' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_owner_trg on public.events;
create trigger protect_event_owner_trg
  before update on public.events
  for each row execute function public.protect_event_owner();
