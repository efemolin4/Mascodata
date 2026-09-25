-- Avisos por correo de "el alimento se está acabando" (función food-restock-reminders).
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente.
--
-- Guarda un registro por alimento y por ciclo de compra (cycle_date = fecha de
-- compra del alimento cuando se avisó): así se envía UN aviso por ciclo, y cuando el
-- tutor repone (la fecha de compra cambia) el siguiente ciclo puede avisar de nuevo.
-- Comparte el interruptor `profiles.reminders_opt_out` con los recordatorios de perfil.

create table if not exists public.food_restock_reminders (
  id           uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  cycle_date   date not null,
  sent_at      timestamptz not null default now(),
  unique (food_item_id, cycle_date)
);

create index if not exists food_restock_reminders_user_idx
  on public.food_restock_reminders (user_id, sent_at desc);

-- Solo la función (service role) lee y escribe: RLS activo y sin políticas.
alter table public.food_restock_reminders enable row level security;

-- Programación diaria a las 13:30 UTC (~10:30 en Chile), 30 min después de los
-- recordatorios de perfil. Reemplazar <PROJECT_REF> y <CRON_SECRET> (el mismo texto
-- guardado en los secretos de Edge Functions) antes de ejecutar; no pegar el
-- secreto en chats ni en archivos del repositorio.
--
-- select cron.schedule(
--   'food-restock-reminders',
--   '30 13 * * *',
--   $$ select net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/food-restock-reminders',
--        headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--      ); $$
-- );
