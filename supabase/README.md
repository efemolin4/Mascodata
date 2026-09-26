# Esquema de seguridad (Supabase)

Este proyecto no usa Supabase CLI ni migraciones automáticas — todo el SQL
(tablas, RLS, funciones) se corre a mano en el SQL Editor de Supabase. Eso
significa que, sin este directorio, **no hay ningún registro versionado**
de qué políticas de seguridad existen hoy en producción: si algo se borra
o se rompe sin querer, no hay forma de reproducirlo a partir del repo.

`schema/` guarda una **foto** (no un historial de migraciones) del estado
real de RLS en producción — políticas por tabla y las funciones SQL que
usan (`pet_accessible()`, `pet_editor()`, `is_admin()`). No se aplica
automáticamente a nada; es documentación versionada para poder auditar y
reconstruir el esquema de seguridad si hace falta.

## Cómo mantenerlo al día

Es 100% manual — no hay ningún hook ni CI que lo verifique. Cada vez que
cambies una política RLS o una función de seguridad en el SQL Editor:

1. Corré la query de introspección de abajo.
2. Reemplazá el contenido de `schema/rls_policies.sql` con el resultado.
3. Commiteá el cambio junto con (o inmediatamente después de) el cambio en
   Supabase, para que el repo nunca quede desincronizado por mucho tiempo.

## Query de introspección

```sql
-- Políticas RLS de todas las tablas públicas
select schemaname, tablename, policyname, permissive, roles, cmd,
       qual as using_expression, with_check as with_check_expression
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Funciones de seguridad usadas por las políticas (pet_accessible, pet_editor, is_admin)
select p.proname as function_name, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('pet_accessible', 'pet_editor', 'is_admin')
order by p.proname;

-- Qué tablas tienen RLS activo (para detectar alguna que quedó sin proteger)
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
```

Pegá los tres resultados (como CSV o tabla) y con eso se arma
`schema/rls_policies.sql` con el estado real.

## Edge Functions

`functions/delete-account/index.ts` borra la cuenta del usuario que la llama:
transfiere sus mascotas al segundo tutor si tienen uno (o las borra si no),
limpia gastos/eventos/botiquín/perfil, y finalmente la fila en
`auth.users` — ver el comentario al principio del archivo para el detalle
completo. Existe como función porque eliminar de `auth.users` requiere la
clave de servicio, que nunca puede vivir en el navegador. La invoca
`verifyAccountDeleteCode()` en `js/auth.js`, después de confirmar un código
de un solo uso enviado al email del usuario (mismo mecanismo que el borrado
de una mascota, `sendDeleteCode()`/`verifyDeleteCode()` en `js/pets.js`).

Igual que el resto del proyecto, el deploy es manual (no se usa la CLI de
Supabase):

1. Dashboard → **Edge Functions → New Function**.
2. Nombre: `delete-account`.
3. Pegá el contenido de `functions/delete-account/index.ts`.
4. **Deploy**. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles automáticamente como
   variables de entorno en toda función — no hace falta configurar ningún
   secreto a mano.

Cada vez que cambies `functions/delete-account/index.ts`, pegá el archivo
actualizado en el Dashboard y hacé Deploy de nuevo — el repo es la fuente de
verdad del código, pero el deploy real vive en Supabase.

## Recordatorios para completar el perfil de una mascota

Función: `functions/pet-completion-reminders/index.ts`. Migración:
`schema/pet_reminders.sql`. Envía hasta 3 correos por mascota (día 2, 7 y 21
desde que se creó) mientras su perfil no esté al 100 %, con máximo 1 correo por
persona a la semana entre mascotas distintas (entre avisos de una misma mascota: 5 y 14 días). El porcentaje es el mismo que
muestra la app (`petCompleteness()` en `js/utils.js`; un test de paridad avisa
si se desincronizan). Son avisos de servicio: no dependen del interruptor de
promociones y cada correo trae un enlace para darse de baja.

Puesta en marcha (una sola vez, en este orden):

1. **SQL Editor**: correr `schema/pet_reminders.sql` (agrega `profiles.reminders_opt_out`
   y la tabla `pet_reminders`). La app funciona igual antes de correrlo; el
   interruptor de Mi perfil aparece cuando la columna existe.
2. **Resend**: crear una API key con permiso de envío (Resend → API Keys).
3. **Edge Functions → Secrets**: `RESEND_API_KEY`, `CRON_SECRET` y `UNSUB_SECRET`
   (los dos últimos, textos largos y aleatorios distintos entre sí). Opcional: `APP_URL`.
4. **Edge Functions → New function** `pet-completion-reminders`: pegar el archivo,
   **desactivar "Verify JWT"** (se protege con su `CRON_SECRET`; el enlace de baja
   del correo lo abre un navegador sin sesión) y Deploy.
5. **Probar sin enviar nada**:
   `curl -H "Authorization: Bearer <CRON_SECRET>" "https://<PROJECT_REF>.supabase.co/functions/v1/pet-completion-reminders?dry=1"`
   devuelve a quiénes les escribiría (mascota, paso, porcentaje).
6. **Programar** (bloque comentado al final de `schema/pet_reminders.sql`; requiere
   activar las extensiones `pg_cron` y `pg_net`). Para pausarlo:
   `select cron.unschedule('pet-completion-reminders');`

## Historial de compras de alimento (opcional)

Para guardar el precio por kilo de cada compra (y mostrar "Pagaste $2.450/kg en
marzo…"), ejecutar en el SQL Editor el archivo `supabase/schema/food_purchases.sql`.
Es idempotente y copia el precio actual de cada alimento como su primera compra.
Si no se ejecuta, la app funciona igual pero sin historial de compras.

## Categoría del alimento (diario / snack)

Ejecutar `supabase/schema/food_category.sql` (idempotente). Sin él la app funciona,
pero no recuerda la categoría al recargar y el gráfico "alimento diario vs snacks"
no distingue los snacks.

## Aviso de "el alimento se está acabando" por correo

Función: `functions/food-restock-reminders/index.ts`. Tabla: `schema/food_restock_reminders.sql`.
Avisa al dueño cuando a un alimento diario (con consumo o duración indicada) le quedan
3 días o menos, un aviso por alimento y por ciclo de compra, y un solo correo por
persona aunque tenga varios alimentos. Comparte el interruptor de recordatorios
(`profiles.reminders_opt_out`) y los secretos con `pet-completion-reminders`.

Puesta en marcha (una sola vez):

1. **SQL Editor**: correr `schema/food_restock_reminders.sql` (crea la tabla).
2. **Edge Functions → New function** `food-restock-reminders`: pegar el archivo,
   **desactivar "Verify JWT"** y Deploy. No requiere secretos nuevos.
3. **Probar sin enviar nada** (`?dry=1`, igual que la otra función; ver el paso 5 de
   arriba con la URL de esta función).
4. **Programar** con el bloque comentado al final de `schema/food_restock_reminders.sql`
   (13:30 UTC). Para pausarlo: `select cron.unschedule('food-restock-reminders');`

## Agenda compartida y tutores separados

Ejecutar `schema/shared_events_care_mode.sql` (idempotente): agrega `events.end_date`, `events.holder`
y `pets.care_mode`, y reemplaza la regla de `events` para que los eventos con mascota los vean todos
sus tutores. Después, `schema/test_shared_events.sql` comprueba las reglas con sesiones simuladas (no
guarda nada). La app funciona antes de ejecutarlo, pero las estadías avisan que falta actualizar la base.

## Quién hizo qué (autor de cada registro)

Ejecutar `schema/activity_attribution.sql` (idempotente): agrega `created_by`, `created_by_name` (y `dose_logs.logged_at`)
a las tablas de registros y un trigger que los completa con la sesión y el nombre del perfil. Luego
`schema/test_activity_attribution.sql` lo comprueba con sesiones simuladas (no guarda nada). Sin el SQL la app
funciona, pero no muestra autores.

## Gastos compartidos con saldo

Ejecutar `schema/shared_expenses.sql` (idempotente; requiere haber ejecutado antes `activity_attribution.sql`): agrega
`pets.expense_split`, el autor de cada gasto, una regla para que el otro tutor vea los gastos de una mascota que reparte
a partes iguales, y la tabla `expense_settlements` (pagos entre tutores). Luego `schema/test_shared_expenses.sql` lo
comprueba con sesiones simuladas (no guarda nada). Sin el SQL la app funciona, pero no permite repartir gastos.

## Protección contra abuso (login, registro, recuperar contraseña, códigos)

Todo lo que envía un correo o inicia sesión (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `signInWithOtp`)
se puede llamar desde cualquier script con la clave pública. Se protege por capas:

1. **Largo mínimo de contraseña: 8.** En la app (`MIN_PASSWORD_LENGTH` en `js/app.js`) y en Supabase
   (*Authentication → Sign In / Providers → Email → Minimum password length* = 8). Solo se exige al crear o cambiar
   una contraseña: las cuentas antiguas con contraseñas más cortas siguen entrando.
2. **Límites de Supabase** (*Authentication → Rate Limits*): correos por hora en total (unos 20-30 para este tamaño) y
   por IP. Un ataque de volumen puede agotar los 100 correos diarios de Resend y dejar sin correo a los usuarios reales.
3. **Vigencia de códigos y enlaces** (*Authentication → Emails*, *OTP expiry*): 900 a 1800 segundos.
4. **CAPTCHA (Cloudflare Turnstile).** La app lo pide antes de cada una de esas llamadas; está APAGADO mientras
   `window.MASCODATA_TURNSTILE_KEY` (en `index.html`) esté vacía. Orden obligatorio:
   1. Cloudflare → Turnstile → *Add site* (dominio `mascodata.cl`, widget "Managed") → copiar la **clave del sitio** (pública)
      y la **clave secreta**.
   2. Pegar la clave del sitio en `index.html` (`window.MASCODATA_TURNSTILE_KEY`) y desplegar.
   3. Solo entonces: Supabase → *Authentication → Attack Protection → Enable CAPTCHA protection* → Cloudflare Turnstile →
      pegar la **clave secreta**. La secreta va únicamente en Supabase: nunca en el repositorio ni en un chat.
   Activarlo en Supabase antes del paso 2 impide iniciar sesión a todo el mundo. Para desactivarlo: apagar el interruptor en Supabase.
5. **Alertas**: en Resend, aviso de consumo al llegar a ~70 correos diarios, y revisar de vez en cuando *Logs → Auth*.

## Códigos de verificación para eliminar la cuenta o una mascota

Antes el código lo enviaba Supabase Auth (plantilla "Magic Link", igual para todo) y solo lo comprobaba el navegador. Ahora
lo envía la función `functions/verification-codes` con un correo propio de cada acción, y **el servidor lo exige** antes de
borrar: `verification-codes` (eliminar o dejar de ver una mascota) y `delete-account` (eliminar la cuenta). El código es de 6
dígitos, se guarda solo su resumen HMAC (`UNSUB_SECRET`), vence a los 10 minutos, sirve una vez, se bloquea tras 5 intentos y
solo se pueden pedir 1 por minuto y 5 por hora (la lógica vive en `schema/verification_codes.sql`).

**Orden de instalación (importa: cada paso depende del anterior):**

1. **SQL Editor:** `schema/verification_codes.sql`, y luego `schema/test_verification_codes.sql` (debe salir todo en `OK`).
2. **Edge Functions → New function `verification-codes`:** pegar `functions/verification-codes/index.ts`, Deploy y en Settings
   dejar **"Verify JWT with legacy secret" apagado** (la función valida la sesión por su cuenta). Sin secretos nuevos.
3. **Publicar la app** (fusionar el pull request): la app nueva pide los códigos a estas funciones.
4. **Volver a desplegar `delete-account`** con `functions/delete-account/index.ts` (ahora exige el código). Hacerlo antes de
   publicar la app rompería el borrado de cuenta de la app anterior.
5. **Al final:** `schema/close_direct_pet_delete.sql` y `schema/test_close_direct_pet_delete.sql`. Cierra el borrado directo de
   mascotas desde el navegador; hacerlo antes de publicar la app dejaría a la app anterior mostrando "eliminada" sin borrar.

Cada código cuenta para los 100 correos diarios de Resend.

## Correo propio de invitación a un segundo tutor

Antes la invitación salía de Supabase Auth (magic link con plantilla genérica, distinta si la persona tenía cuenta o no). Ahora la
app crea la invitación y la función `functions/send-invitation` envía por Resend un correo propio ("Ana te invitó a cuidar a
Greta") armado en el servidor con datos de la base, con un enlace `?invite=TOKEN`. Quien lo abre inicia sesión o crea su cuenta
con ese correo y la invitación se acepta sola. Límites (en `schema/invitation_emails.sql`): 1 envío por minuto y 5 por
invitación, 10 invitaciones por hora por persona.

**Orden de instalación:**

1. **SQL Editor:** `schema/invitation_emails.sql`, y luego `schema/test_invitation_emails.sql` (debe salir todo en `OK`). Es seguro
   antes de publicar la app: la app anterior no usa esas columnas.
2. **Edge Functions → New function `send-invitation`:** pegar `functions/send-invitation/index.ts`, Deploy y en Settings dejar
   **"Verify JWT with legacy secret" apagado**. Sin secretos nuevos (usa `RESEND_API_KEY` y, si existe, `APP_URL`).
3. **Publicar la app** (fusionar el pull request). Hacerlo antes rompería el envío de invitaciones.

Cada invitación cuenta para los 100 correos diarios de Resend.
