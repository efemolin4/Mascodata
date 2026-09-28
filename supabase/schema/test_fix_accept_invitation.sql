-- Prueba de fix_accept_invitation.sql: simula a una persona invitada (que aún no ve la mascota) aceptando su invitación.
-- Termina con un error a propósito: no se guarda nada. Necesita al menos una invitación pendiente y vigente.

do $$
declare u uuid; e text; pet uuid; role_txt text; visible int; msg text; res text := '';
begin
  select i.pet_id, i.invited_email, case i.role when 'edicion' then 'editor' else 'viewer' end into pet, e, role_txt
    from invitations i where i.used = false and i.expires_at > now() limit 1;
  if pet is null then raise exception 'Se necesita una invitación pendiente y vigente'; end if;
  select id into u from profiles where lower(email) = lower(e);
  if u is null then raise exception 'La persona invitada aún no tiene cuenta'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'email', e, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.email', e, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select count(*) into visible from pets where id = pet;
  begin
    insert into pet_access(pet_id, user_id, role) values (pet, u, role_txt);
    res := res || E'OK   La persona invitada puede aceptar su invitación (antes de aceptar ve ' || visible || E' mascotas)\n';
  exception when others then res := res || E'FALLA No pudo aceptar: ' || sqlerrm || E'\n'; end;
  begin
    insert into pet_access(pet_id, user_id, role) values (pet, u, case role_txt when 'editor' then 'viewer' else 'editor' end);
    res := res || E'MAL  Pudo darse un rol distinto al de la invitación\n';
  exception when others then res := res || E'OK   No puede darse un rol distinto al de la invitación\n'; end;
  reset role;
  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
