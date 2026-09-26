-- Copia de seguridad rápida ANTES de un SQL que modifique o borre datos. Ejecutar completo en el SQL Editor.
-- Crea una copia de las tablas de datos en el esquema `backups`, con la fecha de hoy en el nombre
-- (por ejemplo backups.pets_20260925). Si algo sale mal, se pueden recuperar filas desde ahí.
--
--  * `backups` no es visible desde la app (la API solo expone `public`), así que estas copias son privadas.
--  * Ocupan espacio de la base (el plan gratuito tiene 500 MB): borrar las copias viejas cuando ya no hagan falta
--    (`drop table backups.pets_20260925;`). Ver también el final de este archivo.
--  * El plan gratuito de Supabase no tiene respaldos automáticos: esta es la red de seguridad manual.
--  * Es idempotente por día: si se ejecuta dos veces el mismo día, la segunda no pisa la primera.

create schema if not exists backups;

do $$
declare
  t text;
  suffix text := to_char(now() at time zone 'America/Santiago', 'YYYYMMDD');
begin
  foreach t in array array[
    'profiles', 'pets', 'pet_access', 'invitations',
    'vaccines', 'dewormings', 'medications', 'dose_logs', 'history_records', 'weight_history',
    'mood_logs', 'symptoms_logs', 'activities', 'food_items', 'food_purchases',
    'events', 'expenses', 'expense_settlements', 'botiquin_items', 'plan_changes',
    'pet_reminders', 'food_restock_reminders'
  ] loop
    if to_regclass('public.' || t) is not null
       and to_regclass('backups.' || t || '_' || suffix) is null then
      execute format('create table backups.%I as select * from public.%I', t || '_' || suffix, t);
    end if;
  end loop;
end $$;

-- Ver qué copias hay y cuánto pesan:
-- select relname as copia, pg_size_pretty(pg_total_relation_size(c.oid)) as tamano
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'backups' and c.relkind = 'r' order by relname;
--
-- Recuperar filas borradas por error (ejemplo con pets): 
-- insert into public.pets select * from backups.pets_20260925 b where not exists (select 1 from public.pets p where p.id = b.id);
--
-- Borrar TODAS las copias de un día cuando ya no se necesiten:
-- do $$ declare r record; begin for r in select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'backups' and c.relkind = 'r' and relname like '%\_20260925' loop
--   execute format('drop table backups.%I', r.relname); end loop; end $$;
