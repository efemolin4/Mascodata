-- Recordatorios por correo para completar el perfil de una mascota.
-- Se corre A MANO en el SQL Editor de Supabase (el proyecto no usa migraciones
-- automáticas, ver supabase/README.md). Es idempotente: se puede correr de nuevo.
-- Función que lo usa: supabase/functions/pet-completion-reminders/index.ts

-- 1) Preferencia de la persona: puede dejar de recibir estos avisos (desde el
--    enlace del correo o desde Mi perfil). NO es el interruptor de promociones:
--    estos son avisos de servicio sobre su propia mascota.
alter table public.profiles
  add column if not exists reminders_opt_out boolean not null default false;

-- 2) Registro de avisos enviados: evita duplicar y sostiene la cadencia
--    (día 2, 7 y 21; máximo 1 por persona por semana). unique(pet_id, step)
--    también actúa como candado si dos ejecuciones se pisan.
create table if not exists public.pet_reminders (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  step int not null check (step between 1 and 3),
  percent_at_send int not null check (percent_at_send between 0 and 100),
  sent_at timestamptz not null default now(),
  unique (pet_id, step)
);
create index if not exists pet_reminders_user_sent_idx on public.pet_reminders (user_id, sent_at desc);

-- Solo la función (service role) lee y escribe esta tabla: RLS activo y SIN
-- políticas, así que ningún usuario la ve desde la API.
alter table public.pet_reminders enable row level security;

-- 3) Programación diaria (13:00 UTC ≈ 10:00 en Chile). Requiere las extensiones
--    pg_cron y pg_net (Dashboard → Database → Extensions). Reemplaza
--    <PROJECT_REF> y <CRON_SECRET> (el mismo valor del secreto CRON_SECRET de la
--    función). El texto del comando queda visible para quien administra la base.
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'pet-completion-reminders',
--   '0 13 * * *',
--   $$ select net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/pet-completion-reminders',
--        headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
--        body := '{}'::jsonb
--      ) $$
-- );
--
-- Para pausarlo:  select cron.unschedule('pet-completion-reminders');
