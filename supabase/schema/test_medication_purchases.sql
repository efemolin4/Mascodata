-- Prueba de medication_purchases.sql: permisos por rol y consistencia. Termina con un error a propósito: no se guarda nada.
-- Necesita un tratamiento con mascota con dueño y otra cuenta.

do $$
declare a uuid; b uuid; pet uuid; med uuid; n int; res text := '';
begin
  select p.owner_id, p.id into a, pet from pets p join medications m on m.pet_id = p.id order by p.created_at limit 1;
  select m.id into med from medications m where m.pet_id = pet limit 1;
  select id into b from profiles where id <> a order by created_at limit 1;
  if a is null or med is null or b is null then raise exception 'Se necesita una mascota con tratamiento y otra cuenta'; end if;

  -- ===== Dueño =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into medication_purchases(med_id, pet_id, purchase_date, price, quantity, days_supply) values (med, pet, current_date, 25000, 1, 30);
    res := res || E'OK   El dueño registra la compra de un tratamiento\n';
  exception when others then res := res || E'FALLA El dueño no pudo registrar la compra: ' || sqlerrm || E'\n'; end;

  select count(*) into n from medication_purchases where created_by = a;
  res := res || case when n >= 1 then E'OK   La base anota quién la registró\n' else E'MAL  No quedó el autor de la compra\n' end;

  begin
    insert into medication_purchases(med_id, pet_id, purchase_date, price) values (med, pet, current_date, 0);
    res := res || E'MAL  Aceptó un precio de 0\n';
  exception when others then res := res || E'OK   No acepta un precio de 0\n'; end;

  begin
    insert into medication_purchases(med_id, pet_id, purchase_date, price, days_supply) values (med, pet, current_date, 1000, 0);
    res := res || E'MAL  Aceptó una duración de 0 días\n';
  exception when others then res := res || E'OK   No acepta una duración de 0 días\n'; end;
  reset role;

  -- ===== Otra cuenta sin acceso: no ve ni crea =====
  delete from pet_access where pet_id = pet and user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into n from medication_purchases where pet_id = pet;
  res := res || case when n = 0 then E'OK   Quien no tiene acceso a la mascota no ve sus compras\n' else E'MAL  Una cuenta sin acceso ve compras ajenas\n' end;
  begin
    insert into medication_purchases(med_id, pet_id, purchase_date, price) values (med, pet, current_date, 1000);
    res := res || E'MAL  Una cuenta sin acceso registró una compra\n';
  exception when others then res := res || E'OK   Quien no tiene acceso no puede registrar compras\n'; end;
  reset role;

  -- ===== Lector: ve, pero no registra =====
  insert into pet_access(pet_id, user_id, role) values (pet, b, 'viewer');
  set local role authenticated;
  select count(*) into n from medication_purchases where pet_id = pet;
  res := res || case when n >= 1 then E'OK   El lector ve las compras\n' else E'MAL  El lector no ve las compras\n' end;
  begin
    insert into medication_purchases(med_id, pet_id, purchase_date, price) values (med, pet, current_date, 1000);
    res := res || E'MAL  El lector registró una compra\n';
  exception when others then res := res || E'OK   El lector no puede registrar compras\n'; end;
  reset role;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
