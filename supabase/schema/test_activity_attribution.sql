-- Prueba automática de "quién hizo qué" (activity_attribution.sql). Simula sesiones reales y termina
-- con un error a propósito para deshacer todo: no se guarda nada.
-- Necesita una mascota con dueño y al menos 1 cuenta más.

do $$
declare
  a uuid; a_name text; b uuid; b_name text; pet uuid; dose uuid; n int; who uuid; nm text; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  select id, name into b, b_name from profiles where id <> a order by created_at limit 1;
  select name into a_name from profiles where id = a;
  if a is null or b is null then raise exception 'Se necesitan al menos 2 cuentas'; end if;

  insert into pet_access(pet_id, user_id, role) values (pet, b, 'editor') on conflict do nothing;

  -- ===== Como B (editor): registra una dosis intentando firmarla como A =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  insert into dose_logs(pet_id, date, confirmed, created_by, created_by_name)
    values (pet, current_date, true, a, 'Nombre falso') returning id into dose;
  select created_by, created_by_name into who, nm from dose_logs where id = dose;
  res := res || case when who = b then E'OK   La dosis queda firmada por quien la registró, aunque mande otro autor\n' else E'MAL  Se pudo firmar una dosis a nombre de otra persona\n' end;
  res := res || case when nm is not distinct from nullif(trim(b_name), '') then E'OK   El nombre del autor sale del perfil, no del navegador\n' else E'MAL  El nombre del autor no coincide con el perfil\n' end;

  select count(*) into n from dose_logs where id = dose and logged_at is not null;
  res := res || case when n = 1 then E'OK   La dosis guarda la hora en que se registró\n' else E'FALLA La dosis no guardó la hora\n' end;

  begin
    update dose_logs set created_by = a, created_by_name = 'Otro nombre' where id = dose;
  exception when others then null; end;
  select created_by into who from dose_logs where id = dose;
  res := res || case when who = b then E'OK   Al modificar un registro no se puede cambiar el autor\n' else E'MAL  Se cambió el autor de un registro\n' end;
  reset role;

  -- ===== Como A (dueño): ve la dosis firmada por B =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select created_by into who from dose_logs where id = dose;
  res := res || case when who = b then E'OK   El dueño ve quién registró la dosis\n' else E'FALLA El dueño no ve quién registró la dosis\n' end;
  reset role;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
