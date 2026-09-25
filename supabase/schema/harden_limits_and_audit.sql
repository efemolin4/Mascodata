-- Endurecimiento de las áreas que la auditoría dejó pendientes (unidades 3, 4 y 5).
-- Ejecutar completo en el SQL Editor. Es idempotente. La app funciona igual.
--
--   (3) events / expenses / botiquin_items: la regla solo pedía user_id = mi uid, así que
--       se podía apuntar un registro propio al pet_id de OTRA persona. Ahora, si trae
--       mascota, debe ser una a la que el usuario tiene acceso.
--   (4) plan_changes (auditoría de cambios de plan): un administrador podía editar o borrar
--       filas del historial. Ahora solo puede leer y agregar (un registro de auditoría
--       no se reescribe).
--   (5) Tamaño de fotos y adjuntos: el límite de 5 MB solo existía en el navegador; con una
--       llamada directa cualquier usuario podía guardar archivos enormes y llenar la base
--       (500 MB en el plan gratuito). Se agregan topes en la base, con NOT VALID para no
--       rechazar filas antiguas: solo se exigen al crear o modificar una fila.

-- ---------------------------------------------------------------
-- (3) pet_id debe ser una mascota a la que se tiene acceso
-- ---------------------------------------------------------------
drop policy if exists "Users manage own events" on public.events;
create policy "Users manage own events" on public.events
  for all to public
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (pet_id is null or pet_accessible(pet_id)));

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses
  for all to public
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (pet_id is null or pet_accessible(pet_id)));

drop policy if exists "Users manage own botiquin" on public.botiquin_items;
create policy "Users manage own botiquin" on public.botiquin_items
  for all to public
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (pet_id is null or pet_accessible(pet_id)));

-- ---------------------------------------------------------------
-- (4) plan_changes: solo leer y agregar
-- ---------------------------------------------------------------
drop policy if exists "Admins manage plan_changes" on public.plan_changes;
drop policy if exists "Admins read plan_changes" on public.plan_changes;
drop policy if exists "Admins add plan_changes" on public.plan_changes;
create policy "Admins read plan_changes" on public.plan_changes
  for select to public using (is_admin());
create policy "Admins add plan_changes" on public.plan_changes
  for insert to public with check (is_admin());

-- ---------------------------------------------------------------
-- (5) Topes de tamaño (las fotos nuevas pesan ~100 KB tras reducirlas en el navegador)
-- ---------------------------------------------------------------
alter table public.pets drop constraint if exists pets_photo_size_check;
alter table public.pets add constraint pets_photo_size_check
  check (photo is null or length(photo) <= 1000000) not valid;

alter table public.history_records drop constraint if exists history_records_files_size_check;
alter table public.history_records add constraint history_records_files_size_check
  check (files is null or octet_length(files::text) <= 20000000) not valid;
