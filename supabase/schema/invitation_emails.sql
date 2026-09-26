-- Correo propio de invitación a un segundo tutor (Etapa B). Ejecutar completo en el SQL Editor. Es idempotente.
--
-- Antes la invitación se enviaba pidiéndole a Supabase Auth un "magic link" (plantilla genérica, distinta si la persona ya
-- tenía cuenta o no). Ahora la Edge Function `send-invitation` envía por Resend un correo propio ("Ana te invitó a cuidar
-- a Greta") armado en el servidor con datos de la base, con un enlace `?invite=TOKEN` a la app.
--   * Los límites de envío viven aquí: 1 por minuto y 5 por invitación, y 10 invitaciones por hora por persona.
--   * Los contadores no los puede tocar el navegador: al crear la invitación se reinician y después no se pueden editar.
--   * Solo el servidor (clave de servicio) puede llamar a claim_invitation_email.
-- Es seguro ejecutarlo antes de publicar la app nueva: la app anterior no usa estas columnas.

alter table public.invitations add column if not exists email_count   int not null default 0;
alter table public.invitations add column if not exists email_sent_at timestamptz;

-- Al crear una invitación desde el navegador, los contadores siempre parten en cero (nadie se da más envíos).
create or replace function public.reset_invitation_email_counters()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.email_count := 0;
    new.email_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reset_invitation_email_counters_trg on public.invitations;
create trigger reset_invitation_email_counters_trg
  before insert on public.invitations
  for each row execute function public.reset_invitation_email_counters();

-- La protección de columnas ahora incluye los contadores (quien acepta solo puede marcarla como usada).
create or replace function public.protect_invitation_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Sin sesión de usuario (SQL Editor, clave de servicio) no se restringe.
  if auth.uid() is null then
    return new;
  end if;
  if (new.token, new.pet_id, new.pet_name, new.inviter_id, new.invited_email, new.invited_name, new.role, new.expires_at, new.email_count, new.email_sent_at)
     is distinct from
     (old.token, old.pet_id, old.pet_name, old.inviter_id, old.invited_email, old.invited_name, old.role, old.expires_at, old.email_count, old.email_sent_at) then
    raise exception 'Una invitación solo se puede marcar como usada' using errcode = '42501';
  end if;
  if old.used and not new.used then
    raise exception 'Una invitación usada no se puede reactivar' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Reserva un envío. Devuelve un json:
--   {"status":"ok", "pet_name":…, "invited_email":…, "role":…, "expires_at":…}  (y anota el envío)
--   {"status":"not_found"}  no existe, no es de esa persona, ya se usó o venció
--   {"status":"too_soon"}   pasó menos de 1 minuto desde el último envío de esa invitación
--   {"status":"too_many"}   ya se envió 5 veces, o esa persona superó 10 invitaciones en la última hora
create or replace function public.claim_invitation_email(p_inviter uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare inv public.invitations%rowtype; recent int;
begin
  select * into inv from public.invitations
   where token = p_token and inviter_id = p_inviter and used = false and expires_at > now()
   for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  if inv.email_sent_at is not null and inv.email_sent_at > now() - interval '1 minute' then
    return jsonb_build_object('status', 'too_soon');
  end if;
  select count(*) into recent from public.invitations
   where inviter_id = p_inviter and email_sent_at > now() - interval '1 hour';
  if inv.email_count >= 5 or (inv.email_sent_at is null and recent >= 10) then
    return jsonb_build_object('status', 'too_many');
  end if;

  update public.invitations set email_count = email_count + 1, email_sent_at = now() where token = inv.token;
  return jsonb_build_object('status', 'ok', 'pet_name', inv.pet_name, 'invited_email', inv.invited_email,
                            'role', inv.role, 'expires_at', inv.expires_at);
end;
$$;

-- Si Resend falla, se libera el envío para poder reintentar enseguida.
create or replace function public.release_invitation_email(p_inviter uuid, p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.invitations
     set email_count = greatest(email_count - 1, 0), email_sent_at = null
   where token = p_token and inviter_id = p_inviter;
$$;

revoke all on function public.claim_invitation_email(uuid, text) from public, anon, authenticated;
revoke all on function public.release_invitation_email(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_invitation_email(uuid, text) to service_role;
grant execute on function public.release_invitation_email(uuid, text) to service_role;

-- Para deshacer (solo si algo falla; después avisar):
--   drop trigger if exists reset_invitation_email_counters_trg on public.invitations;
--   drop function if exists public.claim_invitation_email(uuid, text);
--   drop function if exists public.release_invitation_email(uuid, text);
--   (las columnas email_count y email_sent_at pueden quedarse: no molestan.)
