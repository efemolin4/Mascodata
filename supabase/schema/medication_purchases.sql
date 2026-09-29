-- Compras de un tratamiento de uso continuo (suplementos, gotas, comprimidos diarios). Ejecutar completo en el SQL Editor.
-- Es idempotente y opcional para la app: si la tabla no existe, la ficha sigue funcionando sin "Registrar compra".
--
-- Cada compra guarda cuánto costó y para cuántos días alcanza. Con eso la app calcula cuándo se acaba y avisa DENTRO de la
-- plataforma (panel "Necesita atención"); no envía correos por esto, porque es de todos los días. Cada compra cuenta como gasto
-- de Finanzas (categoría Medicamentos), sin registrarlo aparte.

create table if not exists public.medication_purchases (
  id            uuid primary key default gen_random_uuid(),
  med_id        uuid not null references public.medications(id) on delete cascade,
  pet_id        uuid not null references public.pets(id) on delete cascade,
  purchase_date date not null,
  price         numeric not null check (price > 0),
  quantity      numeric check (quantity is null or quantity > 0),
  days_supply   int check (days_supply is null or (days_supply > 0 and days_supply <= 3650)),
  created_at    timestamptz not null default now(),
  created_by    uuid,
  created_by_name text
);

create index if not exists medication_purchases_med_date_idx on public.medication_purchases (med_id, purchase_date desc);
create index if not exists medication_purchases_pet_idx on public.medication_purchases (pet_id);

alter table public.medication_purchases enable row level security;

drop policy if exists "Pet access can view medication_purchases" on public.medication_purchases;
create policy "Pet access can view medication_purchases" on public.medication_purchases
  for select to public
  using (pet_accessible(pet_id));

drop policy if exists "Pet editors manage medication_purchases" on public.medication_purchases;
create policy "Pet editors manage medication_purchases" on public.medication_purchases
  for all to public
  using (pet_editor(pet_id))
  with check (
    pet_editor(pet_id)
    -- la compra debe ser de un tratamiento de esa misma mascota
    and exists (select 1 from public.medications m where m.id = medication_purchases.med_id and m.pet_id = medication_purchases.pet_id)
  );

-- Quién la registró: lo fija la base (mismo mecanismo que el resto de los registros; requiere activity_attribution.sql).
do $$
begin
  if to_regprocedure('public.set_created_by()') is not null then
    drop trigger if exists set_created_by_ins on public.medication_purchases;
    create trigger set_created_by_ins before insert on public.medication_purchases
      for each row execute function public.set_created_by();
    drop trigger if exists set_created_by_upd on public.medication_purchases;
    create trigger set_created_by_upd before update on public.medication_purchases
      for each row execute function public.set_created_by();
  end if;
end
$$;

-- Para deshacer (solo si algo falla; después avisar):  drop table public.medication_purchases;
