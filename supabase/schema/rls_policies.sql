-- ============================================================
-- MASCODATA — Foto de las políticas RLS en producción
-- ============================================================
-- Generado a partir de las 3 queries de introspección de
-- supabase/README.md, corridas en el SQL Editor de Supabase.
--
-- Esto es una FOTO para auditoría y recuperación ante desastre, NO una
-- migración idempotente para correr — las políticas y funciones ya
-- existen en producción. Si necesitás reconstruir el esquema desde cero,
-- creá primero las 3 funciones de la sección de abajo (las políticas
-- dependen de ellas) y después revisá cada CREATE POLICY antes de
-- ejecutarlo.
--
-- Última actualización: 2026-09-08

-- ============================================================
-- Funciones de seguridad
-- ============================================================
-- pet_accessible/pet_editor son STABLE (no SECURITY DEFINER): corren con
-- los privilegios del usuario que llama, así que dependen de que
-- pet_access tenga su propia RLS correcta (ver "Users view own access"
-- más abajo) — no hay bypass de por medio.
--
-- is_admin() SÍ es SECURITY DEFINER: es intencional y necesario, no un
-- descuido. Las políticas "Admins view/update all profiles" la usan
-- para decidir si un usuario puede leer profiles.is_admin de OTRA fila
-- (la suya propia) — pero para leer esa columna primero necesitaría que
-- la política ya lo dejara pasar, lo cual sería circular. SECURITY
-- DEFINER rompe el ciclo: la función corre con los privilegios de quien
-- la creó (bypasseando RLS de profiles solo dentro de la función), así
-- que sí puede leer is_admin de forma segura. `SET search_path TO
-- 'public'` fijo es la mitigación estándar para que un SECURITY DEFINER
-- no sea secuestrable cambiando el search_path del caller.

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$function$;

CREATE OR REPLACE FUNCTION public.pet_accessible(p_pet_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.pet_access
    where pet_id = p_pet_id and user_id = auth.uid()
  );
$function$;

-- Igual que pet_accessible pero excluye role='viewer' — usada en todas
-- las políticas "Pet editors manage X" (ALL) de abajo para que un tutor
-- de solo lectura pueda ver los datos (vía pet_accessible, en la política
-- SELECT separada) pero no modificarlos.
CREATE OR REPLACE FUNCTION public.pet_editor(p_pet_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from public.pet_access
    where pet_id = p_pet_id and user_id = auth.uid() and role <> 'viewer'
  );
$function$;

-- ============================================================
-- Cobertura de RLS
-- ============================================================
-- `select relname, relrowsecurity from pg_class ...` confirmó (2026-09-08)
-- que las 18 tablas de public usadas por la app tienen RLS activo —
-- ninguna quedó desprotegida.
--
-- En esa misma revisión aparecieron dos tablas más con RLS activo pero
-- CERO políticas (announcements, feature_flags) — sin código en js/ que
-- las referenciara, restos de alguna feature que nunca se conectó a la
-- app. Se borraron el 2026-09-08 tras confirmar que estaban vacías (ver
-- historial de git para el detalle).

-- ============================================================
-- Políticas por tabla
-- ============================================================

-- ---------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view activities" ON public.activities
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage activities" ON public.activities
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- botiquin_items
-- ---------------------------------------------------------------
CREATE POLICY "Users manage own botiquin" ON public.botiquin_items
  FOR ALL TO public
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------
-- dewormings
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view dewormings" ON public.dewormings
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage dewormings" ON public.dewormings
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- dose_logs
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view dose logs" ON public.dose_logs
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage dose logs" ON public.dose_logs
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- events
-- ---------------------------------------------------------------
CREATE POLICY "Users manage own events" ON public.events
  FOR ALL TO public
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------
CREATE POLICY "Users manage own expenses" ON public.expenses
  FOR ALL TO public
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------
-- food_items
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view food_items" ON public.food_items
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage food_items" ON public.food_items
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- history_records
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view history" ON public.history_records
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage history" ON public.history_records
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- invitations
-- ---------------------------------------------------------------
CREATE POLICY "Invited user can view own invitation" ON public.invitations
  FOR SELECT TO public
  USING (invited_email = auth.email());

CREATE POLICY "Invited user can accept own invitation" ON public.invitations
  FOR UPDATE TO public
  USING (invited_email = auth.email())
  WITH CHECK (invited_email = auth.email());

CREATE POLICY "Inviters manage invitations" ON public.invitations
  FOR ALL TO public
  USING (inviter_id = auth.uid());

-- ---------------------------------------------------------------
-- meals
-- NOTA: tabla del registro de comidas detallado, reemplazada por
-- food_items (estimación de stock) en el rediseño de Nutrición del
-- 2026-09-07 — la app ya no la usa. Las políticas siguen activas porque
-- nunca se borró la tabla; candidata a limpieza si se confirma que no
-- queda ningún dato ni código que la referencie.
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view meals" ON public.meals
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage meals" ON public.meals
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view medications" ON public.medications
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage medications" ON public.medications
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- mood_logs
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view mood" ON public.mood_logs
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage mood" ON public.mood_logs
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- pet_access
-- El control de acceso compartido en sí: qué usuario puede ver/editar
-- qué mascota, y con qué rol (owner / editor / viewer). pet_accessible()
-- y pet_editor() (usadas en casi todas las tablas de arriba) se apoyan en
-- esta tabla.
-- ---------------------------------------------------------------
CREATE POLICY "Users view own access" ON public.pet_access
  FOR SELECT TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can remove own access" ON public.pet_access
  FOR DELETE TO public
  USING (user_id = auth.uid());

CREATE POLICY "Owner can remove pet access" ON public.pet_access
  FOR DELETE TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = pet_access.pet_id AND p.owner_id = auth.uid()
    )
  );

-- Se dispara al crear una mascota nueva: el propio dueño se inserta a sí
-- mismo con role='owner' (ver savePet() en js/pets.js, que hace el insert
-- en pets y el de pet_access como dos pasos, con rollback manual si el
-- segundo falla — ver js/pets.test.js).
CREATE POLICY "Owner grants self access on pet creation" ON public.pet_access
  FOR INSERT TO public
  WITH CHECK (
    (user_id = auth.uid())
    AND (role = 'owner')
    AND EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = pet_access.pet_id AND p.owner_id = auth.uid()
    )
  );

-- Se dispara cuando el segundo tutor invitado acepta la invitación (link
-- de magic link con ?invite=TOKEN, ver acceptPetInvite() en js/pets.js):
-- valida que exista una invitación sin usar, no vencida, para su email,
-- y que el rol que se está insertando coincida con el que se invitó.
CREATE POLICY "Accept own invitation grants access" ON public.pet_access
  FOR INSERT TO public
  WITH CHECK (
    (user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.invitations i
      WHERE i.pet_id = pet_access.pet_id
        AND i.invited_email = auth.email()
        AND i.used = false
        AND i.expires_at > now()
        AND i.role = CASE pet_access.role
                        WHEN 'editor' THEN 'edicion'
                        WHEN 'viewer' THEN 'lectura'
                        ELSE NULL
                      END
    )
  );

-- ---------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view pets" ON public.pets
  FOR SELECT TO public
  USING ((owner_id = auth.uid()) OR pet_accessible(id) OR is_admin());

CREATE POLICY "Owner can insert pets" ON public.pets
  FOR INSERT TO public
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Pet editors can update pets" ON public.pets
  FOR UPDATE TO public
  USING ((owner_id = auth.uid()) OR pet_editor(id))
  WITH CHECK ((owner_id = auth.uid()) OR pet_editor(id));

-- Solo el dueño puede borrar — un editor invitado NO puede eliminar la
-- mascota, solo editarla.
CREATE POLICY "Owner can delete pets" ON public.pets
  FOR DELETE TO public
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------
-- plan_changes
-- Auditoría de cambios de plan (ver applyPlanChange() en js/admin.js) —
-- tabla nueva del 2026-09-08, no existía antes. Solo el admin la toca
-- (tanto para insertar el registro al cambiar un plan como para leerla
-- en el dashboard), así que una sola política ALL alcanza.
-- ---------------------------------------------------------------
CREATE POLICY "Admins manage plan_changes" ON public.plan_changes
  FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL TO public
  USING (auth.uid() = id);

-- Estas dos son las que cierran el hueco del panel Admin: sin ellas,
-- loadAdminData() (js/data.js) haría select * sobre profiles/pets y solo
-- el chequeo `state.user?.isAdmin` del cliente (js/admin.js) evitaría que
-- cualquier usuario autenticado leyera los datos de todos los demás.
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO public
  USING (is_admin() OR (auth.uid() = id));

CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO public
  USING (is_admin());

-- ---------------------------------------------------------------
-- symptoms_logs
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view symptoms" ON public.symptoms_logs
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage symptoms" ON public.symptoms_logs
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- vaccines
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view vaccines" ON public.vaccines
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage vaccines" ON public.vaccines
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ---------------------------------------------------------------
-- weight_history
-- ---------------------------------------------------------------
CREATE POLICY "Pet access can view weight" ON public.weight_history
  FOR SELECT TO public
  USING (pet_accessible(pet_id));

CREATE POLICY "Pet editors manage weight" ON public.weight_history
  FOR ALL TO public
  USING (pet_editor(pet_id))
  WITH CHECK (pet_editor(pet_id));

-- ============================================================
-- Estado: completo (2026-09-08)
-- ============================================================
-- Las 3 funciones de seguridad y la confirmación de que las 20 tablas de
-- public tienen RLS activo ya están arriba — no queda ningún TODO
-- pendiente de esta foto. Si en el futuro se agrega una tabla o política
-- nueva, correr de nuevo las 3 queries de supabase/README.md y actualizar
-- este archivo (ver "Cómo mantenerlo al día" ahí).
