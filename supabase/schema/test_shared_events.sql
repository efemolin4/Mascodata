-- Prueba automática de la agenda compartida (shared_events_care_mode.sql). Simula sesiones
-- reales de tu base y termina con un error a propósito para deshacer todo: no se guarda nada.
-- Necesita una mascota con dueño y al menos 2 cuentas más (o 1 más: se omite la de "ajeno").

do $$
declare
  a uuid; pet uuid; b uuid; c uuid; ev uuid; ev_priv uuid; n int; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  select id into b from profiles where id <> a order by created_at limit 1;
  select id into c from profiles where id <> a and id <> b order by created_at limit 1;
  if a is null or b is null then raise exception 'Se necesitan al menos 2 cuentas'; end if;

  -- Preparación (como administrador): B es editor de la mascota; A crea un evento con mascota y otro personal.
  insert into pet_access(pet_id, user_id, role) values (pet, b, 'editor') on conflict do nothing;
  insert into events(user_id, pet_id, title, date, type) values (a, pet, 'zz-compartido', current_date, 'Consulta') returning id into ev;
  insert into events(user_id, pet_id, title, date, type) values (a, null, 'zz-personal', current_date, 'Otro') returning id into ev_priv;

  -- ===== Como B (editor) =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  select count(*) into n from events where id = ev;
  res := res || case when n = 1 then E'OK   El otro tutor ve el evento de la mascota\n' else E'FALLA El otro tutor no ve el evento de la mascota\n' end;
  select count(*) into n from events where id = ev_priv;
  res := res || case when n = 0 then E'OK   Un evento sin mascota sigue siendo personal\n' else E'MAL  El otro tutor ve un evento personal\n' end;

  begin
    insert into events(user_id, pet_id, title, date, type, end_date, holder) values (b, pet, 'zz-estadia', current_date, 'Estadía', current_date + 3, 'guest');
    res := res || E'OK   El otro tutor puede crear una estadía con inicio, fin y responsable\n';
  exception when others then res := res || E'FALLA El otro tutor no pudo crear una estadía: ' || sqlerrm || E'\n'; end;

  begin
    update events set title = 'zz-editado' where id = ev; get diagnostics n = row_count;
    res := res || case when n = 1 then E'OK   Un editor puede modificar un evento de la mascota\n' else E'FALLA Un editor no pudo modificar el evento\n' end;
  exception when others then res := res || E'FALLA Un editor no pudo modificar el evento: ' || sqlerrm || E'\n'; end;

  begin
    update events set user_id = b where id = ev; get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  Un editor cambió el autor de un evento\n' else E'OK   No se puede cambiar el autor de un evento\n' end;
  exception when others then res := res || E'OK   No se puede cambiar el autor de un evento\n'; end;

  begin
    delete from events where id = ev_priv; get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  Un tutor borró un evento personal ajeno\n' else E'OK   Un tutor no puede borrar un evento personal ajeno\n' end;
  exception when others then res := res || E'OK   Un tutor no puede borrar un evento personal ajeno\n'; end;

  begin
    delete from events where id = ev; get diagnostics n = row_count;
    res := res || case when n = 1 then E'OK   Un editor puede borrar un evento de la mascota\n' else E'FALLA Un editor no pudo borrar el evento\n' end;
  exception when others then res := res || E'FALLA Un editor no pudo borrar el evento: ' || sqlerrm || E'\n'; end;
  reset role;

  -- ===== Como una persona ajena a la mascota =====
  if c is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', c::text, true);
    set local role authenticated;
    select count(*) into n from events where title = 'zz-estadia';
    res := res || case when n = 0 then E'OK   Una persona sin acceso no ve los eventos de la mascota\n' else E'MAL  Una persona sin acceso ve eventos de la mascota\n' end;
    begin
      insert into events(user_id, pet_id, title, date, type) values (c, pet, 'zz-intruso', current_date, 'Otro');
      res := res || E'MAL  Una persona sin acceso creó un evento en la mascota\n';
    exception when others then res := res || E'OK   Una persona sin acceso no puede crear eventos en la mascota\n'; end;
    reset role;
  else
    res := res || E'--   Solo hay 2 cuentas: no se probó a una persona ajena\n';
  end if;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
