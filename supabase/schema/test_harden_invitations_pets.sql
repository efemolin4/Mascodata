-- Prueba automática del endurecimiento (harden_invitations_pets.sql). Simula a dos cuentas
-- reales de tu base (no las modifica: termina con un error a propósito para deshacer todo).
-- Ejecutar completo en el SQL Editor. El resultado aparece como el texto del "error".
-- Necesita al menos 2 cuentas y 1 mascota con dueño.

do $$
declare
  a uuid; b uuid; b_email text; pet uuid; n int; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  select id, email into b, b_email from profiles where id <> a and email is not null order by created_at limit 1;
  if a is null or b is null then raise exception 'No hay dos cuentas para probar'; end if;

  -- Preparación (como administrador): B es editor de la mascota de A y A invitó a B como lector.
  insert into pet_access(pet_id, user_id, role) values (pet, b, 'editor');
  insert into invitations(token, pet_id, pet_name, inviter_id, invited_email, invited_name, role, used, expires_at)
    values ('zz-prueba', pet, 'x', a, b_email, 'x', 'lectura', false, now() + interval '1 day');

  -- ===== Como el DUEÑO (A): lo legítimo debe seguir funcionando =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into invitations(token, pet_id, pet_name, inviter_id, invited_email, invited_name, role, used, expires_at)
      values ('zz-prueba-2', pet, 'x', a, 'otro@ejemplo.cl', 'x', 'lectura', false, now() + interval '1 day');
    res := res || E'OK   El dueño puede invitar a otra persona a su mascota\n';
  exception when others then res := res || E'FALLA El dueño no pudo invitar: ' || sqlerrm || E'\n'; end;
  reset role;

  -- ===== Como B (editor e invitado): los ataques deben fallar =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claim.email', b_email, true);
  set local role authenticated;

  begin
    insert into invitations(token, pet_id, pet_name, inviter_id, invited_email, invited_name, role, used, expires_at)
      values ('zz-ataque-1', pet, 'x', b, b_email, 'x', 'edicion', false, now() + interval '1 day');
    res := res || E'MAL  Ataque 1: B creó una invitación para una mascota que no es suya\n';
  exception when others then res := res || E'OK   Ataque 1 bloqueado (invitación falsa)\n'; end;

  begin
    update pets set owner_id = b where id = pet;
    get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  Ataque 2: un editor se quedó con la mascota\n' else E'OK   Ataque 2 bloqueado (owner_id)\n' end;
  exception when others then res := res || E'OK   Ataque 2 bloqueado (owner_id)\n'; end;

  begin
    update invitations set role = 'edicion', expires_at = now() + interval '30 days' where token = 'zz-prueba';
    get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  Ataque 3: el invitado reescribió su invitación\n' else E'OK   Ataque 3 bloqueado (rol y caducidad)\n' end;
  exception when others then res := res || E'OK   Ataque 3 bloqueado (rol y caducidad)\n'; end;

  begin
    update invitations set used = true where token = 'zz-prueba';
    get diagnostics n = row_count;
    res := res || case when n > 0 then E'OK   El invitado sí puede marcar su invitación como usada\n' else E'FALLA El invitado no pudo marcarla como usada\n' end;
  exception when others then res := res || E'FALLA El invitado no pudo marcarla como usada: ' || sqlerrm || E'\n'; end;

  begin
    update invitations set used = false where token = 'zz-prueba';
    get diagnostics n = row_count;
    res := res || case when n > 0 then E'MAL  Ataque 4: reactivó una invitación usada\n' else E'OK   Ataque 4 bloqueado (reactivar)\n' end;
  exception when others then res := res || E'OK   Ataque 4 bloqueado (reactivar)\n'; end;

  reset role;
  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
