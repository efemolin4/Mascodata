-- Prueba automática de los gastos compartidos (shared_expenses.sql). Simula sesiones reales y termina
-- con un error a propósito para deshacer todo: no se guarda nada.
-- Necesita una mascota con dueño y al menos 2 cuentas más (o 1 más: se omite la de "ajeno").

do $$
declare
  a uuid; pet uuid; b uuid; c uuid; ex_a uuid; ex_solo uuid; st uuid; n int; who uuid; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  select id into b from profiles where id <> a order by created_at limit 1;
  select id into c from profiles where id <> a and id <> b order by created_at limit 1;
  if a is null or b is null then raise exception 'Se necesitan al menos 2 cuentas'; end if;

  -- Preparación (como administrador): B es editor de la mascota; A tiene un gasto con mascota.
  insert into pet_access(pet_id, user_id, role) values (pet, b, 'editor') on conflict do nothing;
  insert into expenses(user_id, pet_id, date, category, amount, description) values (a, pet, current_date, 'Veterinaria', 30000, 'zz-gasto') returning id into ex_a;
  insert into expenses(user_id, pet_id, date, category, amount, description) values (a, null, current_date, 'Otro', 1000, 'zz-personal') returning id into ex_solo;

  -- ===== Como B, con la mascota SIN dividir gastos =====
  update pets set expense_split = 'none' where id = pet;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into n from expenses where id = ex_a;
  res := res || case when n = 0 then E'OK   Sin dividir gastos, el otro tutor NO ve mis gastos\n' else E'MAL  El otro tutor ve mis gastos aunque no se dividen\n' end;
  reset role;

  -- ===== Con la mascota dividiendo a partes iguales =====
  update pets set expense_split = 'equal' where id = pet;
  set local role authenticated;
  select count(*) into n from expenses where id = ex_a;
  res := res || case when n = 1 then E'OK   Dividiendo a partes iguales, el otro tutor ve el gasto de la mascota\n' else E'FALLA El otro tutor no ve el gasto de la mascota\n' end;
  select count(*) into n from expenses where id = ex_solo;
  res := res || case when n = 0 then E'OK   Un gasto sin mascota sigue siendo personal\n' else E'MAL  El otro tutor ve un gasto personal\n' end;
  select created_by into who from expenses where id = ex_a;
  res := res || case when who = a then E'OK   El gasto queda a nombre de quien lo pagó\n' else E'FALLA El gasto no muestra quién lo pagó\n' end;

  begin
    update expenses set amount = 1 where id = ex_a; get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  El otro tutor modificó un gasto que no era suyo\n' else E'OK   El otro tutor no puede modificar mis gastos\n' end;
  exception when others then res := res || E'OK   El otro tutor no puede modificar mis gastos\n'; end;
  begin
    delete from expenses where id = ex_a; get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  El otro tutor borró un gasto que no era suyo\n' else E'OK   El otro tutor no puede borrar mis gastos\n' end;
  exception when others then res := res || E'OK   El otro tutor no puede borrar mis gastos\n'; end;

  -- Pagos entre tutores
  begin
    insert into expense_settlements(pet_id, amount, created_by, created_by_name) values (pet, 15000, a, 'Falso') returning id into st;
    select created_by into who from expense_settlements where id = st;
    res := res || case when who = b then E'OK   Un pago queda firmado por quien lo registró, aunque mande otro autor\n' else E'MAL  Se pudo firmar un pago a nombre de otra persona\n' end;
  exception when others then res := res || E'FALLA El otro tutor no pudo registrar un pago: ' || sqlerrm || E'\n'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select count(*) into n from expense_settlements where pet_id = pet;
  res := res || case when n >= 1 then E'OK   El dueño ve los pagos registrados por el otro tutor\n' else E'FALLA El dueño no ve los pagos\n' end;
  begin
    delete from expense_settlements where id = st; get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  Un tutor borró un pago registrado por otro\n' else E'OK   Solo quien registró un pago puede borrarlo\n' end;
  exception when others then res := res || E'OK   Solo quien registró un pago puede borrarlo\n'; end;
  reset role;

  -- ===== Persona ajena a la mascota =====
  if c is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', c::text, true);
    set local role authenticated;
    select count(*) into n from expenses where id = ex_a;
    res := res || case when n = 0 then E'OK   Una persona sin acceso no ve los gastos de la mascota\n' else E'MAL  Una persona sin acceso ve gastos de la mascota\n' end;
    select count(*) into n from expense_settlements where pet_id = pet;
    res := res || case when n = 0 then E'OK   Una persona sin acceso no ve los pagos\n' else E'MAL  Una persona sin acceso ve los pagos\n' end;
    reset role;
  else
    res := res || E'--   Solo hay 2 cuentas: no se probó a una persona ajena\n';
  end if;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
