-- "Quién hizo qué": cada registro guarda quién lo creó (created_by y created_by_name), para que
-- los tutores de una misma mascota vean quién dio la dosis, quién registró una consulta, etc.
-- Ejecutar completo en el SQL Editor. Es idempotente; si alguna tabla opcional no existe, se omite.
--
-- Los rellena un trigger BEFORE INSERT con el usuario de la sesión y su nombre de perfil, ignorando
-- lo que mande el navegador: nadie puede firmar un registro a nombre de otra persona. Al modificar un
-- registro, el autor no cambia. Los registros anteriores quedan sin autor (la app no muestra nombre).
-- Además dose_logs guarda la hora (logged_at) para mostrar "dada a las 09:04".

do $$
declare t text;
begin
  foreach t in array array['vaccines','dewormings','medications','history_records','weight_history',
                           'dose_logs','events','food_purchases','food_items'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists created_by uuid', t);
      execute format('alter table public.%I add column if not exists created_by_name text', t);
    end if;
  end loop;
end $$;

alter table public.dose_logs add column if not exists logged_at timestamptz not null default now();

create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sin sesión de usuario (SQL Editor, clave de servicio) no se toca nada.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_name := (select nullif(trim(p.name), '') from public.profiles p where p.id = auth.uid());
  else
    new.created_by := old.created_by;
    new.created_by_name := old.created_by_name;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['vaccines','dewormings','medications','history_records','weight_history',
                           'dose_logs','events','food_purchases','food_items'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists set_created_by_ins on public.%I', t);
      execute format('create trigger set_created_by_ins before insert on public.%I for each row execute function public.set_created_by()', t);
      execute format('drop trigger if exists set_created_by_upd on public.%I', t);
      execute format('create trigger set_created_by_upd before update on public.%I for each row execute function public.set_created_by()', t);
    end if;
  end loop;
end $$;

-- Los eventos ya tenían autor (user_id): se completa el nombre de los existentes.
update public.events e
   set created_by = e.user_id,
       created_by_name = (select nullif(trim(p.name), '') from public.profiles p where p.id = e.user_id)
 where e.created_by is null;
