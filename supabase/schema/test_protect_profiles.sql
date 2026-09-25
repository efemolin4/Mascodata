-- Prueba automática del trigger que protege las columnas privilegiadas de `profiles`
-- (is_admin, plan, plan_expires_at, stripe_customer_id). Simula sesiones reales de tu base
-- y termina con un error a propósito para deshacer todo: no se guarda nada.
-- Ejecutar completo en el SQL Editor; el resultado aparece como el texto del "error".
-- Necesita al menos 1 cuenta que NO sea administradora; si además hay un administrador,
-- se prueba también que él sí pueda cambiar el plan de otra persona.

do $$
declare
  u uuid; u_email text; adm uuid; other uuid;
  v_admin boolean; v_plan text; v_name text; n int; res text := '';
begin
  select id, email into u, u_email from profiles where coalesce(is_admin, false) = false and email is not null order by created_at limit 1;
  select id into adm from profiles where is_admin = true order by created_at limit 1;
  if u is null then raise exception 'No hay una cuenta no administradora para probar'; end if;

  -- ===== Como usuario normal =====
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'email', u_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.email', u_email, true);
  set local role authenticated;

  begin update profiles set is_admin = true where id = u; exception when others then null; end;
  select is_admin into v_admin from profiles where id = u;
  res := res || case when coalesce(v_admin, false) then E'MAL  Un usuario normal se volvió administrador\n' else E'OK   Un usuario normal no puede volverse administrador\n' end;

  select plan into v_plan from profiles where id = u;
  begin update profiles set plan = 'premium-prueba' where id = u; exception when others then null; end;
  select plan into v_name from profiles where id = u;
  res := res || case when v_name is distinct from v_plan then E'MAL  Un usuario normal cambió su propio plan\n' else E'OK   Un usuario normal no puede cambiar su plan\n' end;

  begin update profiles set plan_expires_at = now() + interval '10 years' where id = u; get diagnostics n = row_count; exception when others then n := 0; end;
  select (plan_expires_at > now() + interval '5 years')::text into v_name from profiles where id = u;
  res := res || case when v_name = 'true' then E'MAL  Un usuario normal se extendió el plan\n' else E'OK   Un usuario normal no puede extender su plan\n' end;

  begin update profiles set stripe_customer_id = 'cus_prueba' where id = u; exception when others then null; end;
  select stripe_customer_id into v_name from profiles where id = u;
  res := res || case when v_name = 'cus_prueba' then E'MAL  Un usuario normal cambió su stripe_customer_id\n' else E'OK   Un usuario normal no puede cambiar su stripe_customer_id\n' end;

  -- Lo legítimo: editar sus propios datos
  begin update profiles set name = 'Nombre de prueba' where id = u; exception when others then null; end;
  select name into v_name from profiles where id = u;
  res := res || case when v_name = 'Nombre de prueba' then E'OK   El usuario sí puede editar su nombre\n' else E'FALLA El usuario no pudo editar su nombre\n' end;

  -- ===== Como administrador (si existe) =====
  reset role;
  if adm is not null then
    select id into other from profiles where id <> adm order by created_at limit 1;
    if other is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', adm::text, true);
      set local role authenticated;
      begin update profiles set plan = 'premium' where id = other; exception when others then null; end;
      select plan into v_name from profiles where id = other;
      res := res || case when v_name = 'premium' then E'OK   Un administrador sí puede cambiar el plan de otra persona\n' else E'FALLA Un administrador no pudo cambiar el plan de otra persona\n' end;
      reset role;
    end if;
  else
    res := res || E'--   No hay cuentas administradoras: no se probó el cambio de plan por un administrador\n';
  end if;

  raise exception E'RESULTADOS DE LA PRUEBA (no se guardó nada):\n%', res;
end
$$;
