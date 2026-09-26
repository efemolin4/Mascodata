-- Prueba automática de los códigos de verificación (verification_codes.sql). Termina con un error a propósito para
-- deshacer todo: no se guarda nada. Necesita al menos 1 cuenta y 1 mascota con dueño.

do $$
declare
  a uuid; pet uuid; b uuid; s text; n int; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  select id into b from profiles where id <> a order by created_at limit 1;
  if a is null then raise exception 'Se necesita una mascota con dueño'; end if;

  -- ===== Como el servidor: crear y consumir =====
  s := create_verification_code(a, 'delete_account', null, 'hash-1');
  res := res || case when s = 'ok' then E'OK   Se crea un código\n' else E'FALLA Crear un código dio: ' || s || E'\n' end;
  s := create_verification_code(a, 'delete_account', null, 'hash-2');
  res := res || case when s = 'too_soon' then E'OK   No se puede pedir otro código antes de 60 segundos\n' else E'MAL  Se permitió pedir otro código de inmediato: ' || s || E'\n' end;
  s := consume_verification_code(a, 'delete_account', null, 'otro-hash');
  res := res || case when s = 'invalid' then E'OK   Un código equivocado se rechaza\n' else E'MAL  Un código equivocado dio: ' || s || E'\n' end;
  s := consume_verification_code(a, 'delete_account', null, 'hash-1');
  res := res || case when s = 'ok' then E'OK   El código correcto se acepta\n' else E'FALLA El código correcto dio: ' || s || E'\n' end;
  s := consume_verification_code(a, 'delete_account', null, 'hash-1');
  res := res || case when s = 'invalid' then E'OK   Un código sirve una sola vez\n' else E'MAL  Un código se pudo usar dos veces: ' || s || E'\n' end;

  -- Bloqueo por intentos
  update verification_codes set created_at = now() - interval '2 minutes' where user_id = a;
  s := create_verification_code(a, 'delete_account', null, 'hash-3');
  for n in 1..5 loop perform consume_verification_code(a, 'delete_account', null, 'malo'); end loop;
  s := consume_verification_code(a, 'delete_account', null, 'hash-3');
  res := res || case when s = 'locked' then E'OK   Tras 5 intentos fallidos el código se bloquea, aunque el sexto sea correcto\n' else E'MAL  No se bloqueó tras 5 intentos: ' || s || E'\n' end;

  -- Vencimiento
  update verification_codes set created_at = now() - interval '5 minutes', expires_at = now() - interval '1 second' where user_id = a;
  s := create_verification_code(a, 'delete_pet', pet, 'hash-4');
  update verification_codes set expires_at = now() - interval '1 second' where user_id = a and purpose = 'delete_pet';
  s := consume_verification_code(a, 'delete_pet', pet, 'hash-4');
  res := res || case when s = 'expired' then E'OK   Un código vencido se rechaza\n' else E'MAL  Un código vencido dio: ' || s || E'\n' end;

  -- Un código de una acción no sirve para otra
  update verification_codes set created_at = now() - interval '5 minutes' where user_id = a;
  perform create_verification_code(a, 'delete_account', null, 'hash-5');
  s := consume_verification_code(a, 'delete_pet', pet, 'hash-5');
  res := res || case when s <> 'ok' then E'OK   Un código de una acción no sirve para otra\n' else E'MAL  Un código sirvió para otra acción\n' end;

  -- Tope por hora
  delete from verification_codes where user_id = a;
  for n in 1..5 loop
    insert into verification_codes (user_id, purpose, subject_id, code_hash, expires_at, created_at) values (a, 'delete_account', null, 'x' || n, now() + interval '10 minutes', now() - interval '5 minutes');
  end loop;
  s := create_verification_code(a, 'delete_account', null, 'hash-6');
  res := res || case when s = 'too_many' then E'OK   No más de 5 códigos por hora\n' else E'MAL  Se permitieron más de 5 códigos por hora: ' || s || E'\n' end;

  -- ===== Como una persona con sesión (navegador): no puede tocar nada =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  begin
    select count(*) into n from verification_codes;
    res := res || case when n = 0 then E'OK   Desde el navegador no se ven los códigos (ni sus resúmenes)\n' else E'MAL  El navegador ve códigos\n' end;
  exception when others then res := res || E'OK   Desde el navegador no se pueden ver los códigos\n'; end;
  begin
    perform create_verification_code(a, 'delete_account', null, 'trampa');
    res := res || E'MAL  El navegador pudo crear un código\n';
  exception when others then res := res || E'OK   El navegador no puede crear ni consumir códigos\n'; end;

  reset role;

  -- ===== La puerta directa para borrar mascotas está cerrada (salvo mascotas recién creadas) =====
  update pets set created_at = now() - interval '1 day' where id = pet;   -- como administrador: una mascota "vieja"
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  begin
    delete from pets where id = pet; get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  El dueño borró una mascota desde el navegador sin código\n' else E'OK   El dueño ya no puede borrar una mascota desde el navegador\n' end;
  exception when others then res := res || E'OK   El dueño ya no puede borrar una mascota desde el navegador\n'; end;
  reset role;

  update pets set created_at = now() where id = pet;                      -- una mascota recién creada (deshacer un alta)
  set local role authenticated;
  begin
    delete from pets where id = pet; get diagnostics n = row_count;
    res := res || case when n > 0 then E'OK   Una mascota recién creada sí se puede deshacer (marcha atrás del alta)\n' else E'FALLA No se pudo deshacer el alta de una mascota recién creada\n' end;
  exception when others then res := res || E'FALLA No se pudo deshacer el alta: ' || sqlerrm || E'\n'; end;
  reset role;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
