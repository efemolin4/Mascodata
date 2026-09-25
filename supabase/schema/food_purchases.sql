-- Historial de compras de alimento (precio por kilo a lo largo del tiempo).
-- food_items guarda "el alimento actual" (una sola fila con el último precio y
-- fecha); cada vez que el tutor repone, editar esa fila pisaba el precio
-- anterior. Esta tabla guarda una fila por compra, colgando del alimento.
--
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente. La app
-- funciona igual si aún no se ejecuta (sin historial), no rompe nada.

create table if not exists public.food_purchases (
  id            uuid primary key default gen_random_uuid(),
  food_item_id  uuid not null references public.food_items(id) on delete cascade,
  pet_id        uuid not null references public.pets(id) on delete cascade,
  purchase_date date not null,
  price         numeric not null check (price > 0),
  package_size  numeric not null check (package_size > 0),
  package_unit  text not null,
  created_at    timestamptz not null default now()
);

create index if not exists food_purchases_item_date_idx
  on public.food_purchases (food_item_id, purchase_date desc);
create index if not exists food_purchases_pet_idx
  on public.food_purchases (pet_id);

alter table public.food_purchases enable row level security;

drop policy if exists "Pet access can view food_purchases" on public.food_purchases;
create policy "Pet access can view food_purchases" on public.food_purchases
  for select to public
  using (pet_accessible(pet_id));

drop policy if exists "Pet editors manage food_purchases" on public.food_purchases;
create policy "Pet editors manage food_purchases" on public.food_purchases
  for all to public
  using (pet_editor(pet_id))
  with check (pet_editor(pet_id));

-- Los alimentos que ya tienen precio y fecha pasan a tener su primera compra,
-- para que el historial no parta vacío.
insert into public.food_purchases (food_item_id, pet_id, purchase_date, price, package_size, package_unit)
select f.id, f.pet_id, f.purchase_date, f.price, f.package_size, coalesce(f.package_unit, 'kg')
from public.food_items f
where f.price > 0 and f.package_size > 0 and f.purchase_date is not null
  and not exists (select 1 from public.food_purchases p where p.food_item_id = f.id);
