-- Prueba automática de close_direct_pet_delete.sql. Termina con un error a propósito para deshacer todo: no se guarda nada.
-- Necesita una mascota con dueño.

do $$
declare
  a uuid; pet uuid; n int; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  if a is null then raise exception 'Se necesita una mascota con dueño'; end if;

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
