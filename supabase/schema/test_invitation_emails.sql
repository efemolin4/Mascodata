-- Prueba automática de invitation_emails.sql (límites de envío y contadores protegidos). Termina con un error a propósito
-- para deshacer todo: no se guarda nada. El resultado aparece como el texto del "error".
-- Necesita una mascota con dueño y al menos otra cuenta.

do $$
declare
  a uuid; b uuid; b_email text; pet uuid; r jsonb; res text := '';
begin
  select p.owner_id, p.id into a, pet
    from pets p join pet_access x on x.pet_id = p.id and x.user_id = p.owner_id
    order by p.created_at limit 1;
  select id, email into b, b_email from profiles where id <> a and email is not null order by created_at limit 1;
  if a is null or b is null then raise exception 'Se necesita una mascota con dueño y otra cuenta'; end if;

  -- ===== Como el dueño: los contadores no se pueden inflar al crear la invitación =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  begin
    insert into invitations(token, pet_id, pet_name, inviter_id, invited_email, invited_name, role, used, expires_at, email_count)
      values ('zz-mail-1', pet, 'Greta', a, 'nadie@ejemplo.cl', 'x', 'lectura', false, now() + interval '1 day', -100);
    res := res || case when (select email_count from invitations where token = 'zz-mail-1') = 0
      then E'OK   Los contadores parten siempre en cero al crear la invitación\n'
      else E'MAL  El dueño logró crear una invitación con contadores manipulados\n' end;
  exception when others then res := res || E'FALLA El dueño no pudo crear la invitación: ' || sqlerrm || E'\n'; end;
  reset role;

  -- ===== Servidor: reserva de envíos =====
  r := claim_invitation_email(a, 'zz-mail-1');
  res := res || case when r->>'status' = 'ok' and r->>'invited_email' = 'nadie@ejemplo.cl' and r->>'pet_name' = 'Greta'
    then E'OK   El primer envío se reserva y devuelve los datos de la invitación\n' else E'MAL  Primer envío: ' || r::text || E'\n' end;

  r := claim_invitation_email(a, 'zz-mail-1');
  res := res || case when r->>'status' = 'too_soon' then E'OK   Un segundo envío inmediato se rechaza (1 por minuto)\n' else E'MAL  Segundo envío inmediato: ' || r::text || E'\n' end;

  r := claim_invitation_email(b, 'zz-mail-1');
  res := res || case when r->>'status' = 'not_found' then E'OK   Otra persona no puede enviar la invitación de alguien más\n' else E'MAL  Otra persona: ' || r::text || E'\n' end;

  perform release_invitation_email(a, 'zz-mail-1');
  r := claim_invitation_email(a, 'zz-mail-1');
  res := res || case when r->>'status' = 'ok' then E'OK   Si Resend falla, el envío se libera y se puede reintentar\n' else E'MAL  Reintento tras liberar: ' || r::text || E'\n' end;

  update invitations set email_sent_at = now() - interval '2 minutes', email_count = 5 where token = 'zz-mail-1';
  r := claim_invitation_email(a, 'zz-mail-1');
  res := res || case when r->>'status' = 'too_many' then E'OK   Después de 5 envíos de la misma invitación se rechaza\n' else E'MAL  Sexto envío: ' || r::text || E'\n' end;

  update invitations set email_count = 1, expires_at = now() - interval '1 minute' where token = 'zz-mail-1';
  r := claim_invitation_email(a, 'zz-mail-1');
  res := res || case when r->>'status' = 'not_found' then E'OK   Una invitación vencida no se envía\n' else E'MAL  Invitación vencida: ' || r::text || E'\n' end;

  -- ===== La persona invitada no puede tocar los contadores =====
  update invitations set expires_at = now() + interval '1 day' where token = 'zz-mail-1';
  update invitations set invited_email = b_email where token = 'zz-mail-1';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'email', b_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claim.email', b_email, true);
  set local role authenticated;
  begin
    update invitations set email_count = 0 where token = 'zz-mail-1';
    res := res || E'MAL  La persona invitada pudo cambiar los contadores\n';
  exception when others then res := res || E'OK   La persona invitada no puede cambiar los contadores\n'; end;
  reset role;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
