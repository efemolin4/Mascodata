-- Prueba de pet_owner_premium.sql. Termina con un error a propósito: no se guarda nada.
-- Necesita una mascota con dueño.

do $$
declare a uuid; pet uuid; old_plan text; r boolean; res text := '';
begin
  select p.owner_id, p.id into a, pet from pets p order by p.created_at limit 1;
  if a is null then raise exception 'Se necesita una mascota con dueño'; end if;
  select plan into old_plan from profiles where id = a;

  update profiles set plan = 'premium' where id = a;
  select owner_premium into r from pets where id = pet;
  res := res || case when r then E'OK   Al pasar al dueño a Premium, su mascota queda Premium\n' else E'FALLA La mascota no siguió al plan del dueño\n' end;

  update profiles set plan = 'free' where id = a;
  select owner_premium into r from pets where id = pet;
  res := res || case when not r then E'OK   Al volver el dueño a Free, su mascota vuelve a Free\n' else E'FALLA La mascota siguió Premium tras bajar el plan\n' end;

  -- El dueño (Free) no puede marcar su propia mascota como Premium desde el navegador.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    update pets set owner_premium = true where id = pet;
  exception when others then null; end;
  reset role;
  select owner_premium into r from pets where id = pet;
  res := res || case when not r then E'OK   El dueño no puede darse Premium a sí mismo editando su mascota\n' else E'MAL  El dueño se marcó Premium editando su mascota\n' end;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
