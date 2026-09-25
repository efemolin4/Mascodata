-- Categoría del alimento: 'diario' (la comida de todos los días) o 'snack'
-- (premios y snacks). Permite comparar cuánto de lo que come la mascota son
-- premios (lo recomendado es hasta ~10 %). Ejecutar en el SQL Editor; es
-- idempotente. La app funciona igual si aún no se ejecuta, pero no recuerda la
-- categoría al recargar.

alter table public.food_items
  add column if not exists category text not null default 'diario';

alter table public.food_items
  drop constraint if exists food_items_category_check;
alter table public.food_items
  add constraint food_items_category_check check (category in ('diario', 'snack'));

-- Los alimentos que ya estaban marcados con tipo "Snack" pasan a ser snacks.
update public.food_items set category = 'snack' where type = 'Snack' and category = 'diario';
