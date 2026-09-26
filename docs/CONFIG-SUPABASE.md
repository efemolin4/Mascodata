# Configuración del proyecto de Supabase (producción)

Lo que está configurado **en el panel de Supabase** y no vive en el código. Sirve para reconstruirlo, para repetirlo en un
proyecto de pruebas (staging) y para saber qué cambió y cuándo. **Nunca se anotan aquí claves ni secretos**: solo dónde van.

- Estado: ✅ confirmado (lo vimos funcionando o lo dejó el usuario) · ⚠️ por confirmar en el panel.
- Última revisión completa: 25-sep-2026. Actualizar este archivo cada vez que se cambie algo en el panel.
- Proyecto: `dmpvqhdpldlvzwunscah` (`https://dmpvqhdpldlvzwunscah.supabase.co`). La URL y la clave pública (anon) están en `js/app.js`.

## 1. Autenticación

| Ajuste | Dónde | Valor | Estado |
|---|---|---|---|
| Correo y contraseña | Authentication → Sign In / Providers → Email | Activado | ✅ |
| **Confirm email** (exigir confirmar el correo al registrarse) | Mismo lugar | Probablemente **apagado** | ⚠️ ver "Decisiones pendientes" |
| **Largo mínimo de contraseña** | Mismo lugar | **8** (igual que `MIN_PASSWORD_LENGTH` en `js/app.js`) | ✅ |
| Google | Authentication → Sign In / Providers → Google | Activado. El *client id* y el secreto vienen de Google Cloud | ✅ |
| Site URL | Authentication → URL Configuration | `https://mascodata.cl` | ⚠️ |
| Redirect URLs | Mismo lugar | `https://mascodata.cl/**` (agregar las de staging cuando exista) | ⚠️ |
| CAPTCHA | Authentication → Attack Protection | **Apagado** (código listo; ver `supabase/README.md`, *Protección contra abuso*) | ✅ |

## 2. Límites (Authentication → Rate Limits)

| Límite | Valor | Estado |
|---|---|---|
| Correos por hora (todo el proyecto) | 15 | ⚠️ (recomendado; el usuario los guardó) |
| Registros e inicios de sesión (por IP, 5 min) | 20 | ⚠️ (ídem) |
| Verificaciones de código/enlace (por IP, 5 min) | 30 | ✅ (valor por defecto) |
| Renovaciones de sesión (por IP, 5 min) | 150 | ✅ (valor por defecto) |
| SMS, anónimos, Web3 | Sin uso | ✅ |

Un ataque de volumen puede agotar los **100 correos diarios de Resend** (plan gratuito), compartidos con los recordatorios
(perfil: máx. 50 por corrida; alimento: máx. 40). Por eso los límites son bajos y el CAPTCHA está preparado.

## 3. Correo

| Ajuste | Valor | Estado |
|---|---|---|
| SMTP propio (Authentication → SMTP Settings) | Activado, con **Resend**: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = una clave de API de Resend (solo en Supabase). Remitente `Mascodata <noreply@mascodata.cl>` | ✅ (los correos llegan desde `noreply@mascodata.cl`) |
| Dominio `mascodata.cl` en Resend | Verificado | ✅ |
| Vigencia de códigos y enlaces (OTP expiry) | Recomendado 900 a 1800 s | ⚠️ |

### Plantillas (Authentication → Emails → Templates)

Las cinco están instaladas con la marca v2. **La copia de referencia está en `supabase/email-templates/`**: si se edita en el
panel, actualizar también el archivo. Al pegarlas, escribir el asunto a mano y guardar (esperar el aviso de guardado).

| Pestaña | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirma tu correo en Mascodata |
| Magic Link | `magic-link.html` | Tu enlace y código para entrar a Mascodata |
| Reset Password | `recovery.html` | Restablece tu contraseña de Mascodata |
| Change Email Address | `email-change.html` | Confirma tu nuevo correo en Mascodata |
| Reauthentication | `reauthentication.html` | Tu código de verificación de Mascodata |

`Invite user` no se usa. Las plantillas son genéricas a propósito (sin `.Data` ni nombres): cualquiera puede pedirle a Supabase un
correo con datos inventados hacia cualquier dirección.

## 4. Edge Functions y secretos

| Función | Verify JWT | Se llama desde |
|---|---|---|
| `pet-completion-reminders` | **Apagado** (la protege `CRON_SECRET`; el enlace de baja va firmado) | Cron `0 13 * * *` UTC |
| `food-restock-reminders` | **Apagado** (ídem) | Cron `30 13 * * *` UTC |
| `delete-account` | Según se creó (usa la sesión del usuario) | La app, al eliminar la cuenta |

Secretos (Edge Functions → Secrets), **solo nombres**: `RESEND_API_KEY`, `CRON_SECRET`, `UNSUB_SECRET`, `APP_URL` (opcional).
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase. El deploy es manual (pegar `index.ts` en el panel).

Extensiones necesarias: `pg_cron` y `pg_net`. Los crons se crean con SQL que toma el secreto del cron existente (ver `supabase/README.md`).

## 5. Base de datos

SQL aplicado, **en este orden** (todos en `supabase/schema/`, idempotentes):

1. Tablas base y `rls_policies.sql` (foto de las reglas de acceso). **Las tablas base no están versionadas**: se crearon a mano
   antes de empezar el repositorio de esquema. Para armar un staging hay que exportarlas (`supabase db dump --schema public` con
   la CLI de Supabase, o el esquema desde el panel) y guardarlas en el repositorio.
2. `pet_reminders.sql` · 3. `food_purchases.sql` · 4. `food_category.sql` · 5. `food_restock_reminders.sql`
6. `harden_invitations_pets.sql` · 7. `harden_limits_and_audit.sql` · 8. `shared_events_care_mode.sql`
9. `activity_attribution.sql` · 10. `shared_expenses.sql`

Pruebas de reglas (simulan sesiones y no guardan nada): `test_harden_invitations_pets.sql`, `test_protect_profiles.sql`,
`test_shared_events.sql`, `test_activity_attribution.sql`, `test_shared_expenses.sql`. Respaldo antes de cambios que toquen datos:
`backup_before_migration.sql`. El plan gratuito **no tiene respaldos automáticos**.

Triggers que protegen datos: `profiles` (no se puede cambiar `is_admin`, `plan`, `plan_expires_at`, `stripe_customer_id`), `pets.owner_id`,
columnas de `invitations`, autor de cada registro (`set_created_by`), autor de un evento.

## 6. Decisiones pendientes y riesgos

### Confirmar el correo al registrarse (Confirm email)

La pantalla de registro asume que `signUp` devuelve una **sesión inmediata** ("¡Cuenta creada! Bienvenido"), lo que solo pasa con
**Confirm email apagado**. Si es así:

- **Nadie verifica que el correo sea suyo.** Se puede crear una cuenta con la dirección de otra persona.
- **Invitaciones:** aceptar una invitación exige que el correo de la cuenta coincida con el invitado (`auth.email()`), y ese
  correo no está verificado. Quien se registre antes con el correo de una persona invitada podría ver su invitación.
- La recuperación de contraseña **no** se ve afectada: el enlace llega al dueño real del correo.

Con pocos usuarios el riesgo es bajo, pero conviene resolverlo antes de invitar a más gente: **activar Confirm email** (Authentication → Sign In / Providers →
Email) y cambiar el registro para que, al no recibir sesión, muestre "Revisa tu correo para confirmar tu cuenta" en vez de entrar
directo. Para verificar cuál es el estado real: crear una cuenta de prueba y ver si llega un correo de confirmación.

### Otros pendientes
- Confirmar Site URL, Redirect URLs y la vigencia de códigos (⚠️ arriba).
- Activar el CAPTCHA (código listo, en espera).
- Crear el proyecto de staging (`docs/ENTORNOS.md`, Nivel 2) y versionar el esquema base.
