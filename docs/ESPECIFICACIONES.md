# Mascodata — Especificaciones técnicas y funcionales

Estado de la plataforma al **25 de septiembre de 2026**. Este documento describe *qué hace* y *cómo está construida* la plataforma hoy. El detalle de instalación y operación está en [`README.md`](../README.md) y [`supabase/README.md`](../supabase/README.md); las políticas de seguridad versionadas, en [`supabase/schema/`](../supabase/schema/).

---

## 1. Resumen

Mascodata es una aplicación web de página única (SPA) para tutores de mascotas: concentra ficha de salud, vacunas, tratamientos, historial clínico, agenda, finanzas, botiquín y nutrición de una o más mascotas, con posibilidad de compartir la ficha con un segundo tutor.

| | |
|---|---|
| Sitio | `mascodata.cl` (app), `/landing`, `/marca`, `/privacidad`, `/terminos` |
| Modelo de negocio | 2 planes: **Free** (1 mascota) y **Premium** ($2.500/mes o $19.990/año) |
| Cobro | Aún no hay cobro en línea: el administrador activa Premium a mano |
| Idioma / moneda | Español (Chile), pesos chilenos (CLP) |
| Infraestructura | Vercel (sitio estático) + Supabase (Auth, PostgreSQL, Edge Functions) + Resend (correo) |

---

## 2. Especificación funcional

### 2.1 Cuenta y acceso
- Registro con nombre, correo y contraseña; inicio de sesión con correo o con Google (OAuth); recuperación de contraseña por correo.
- **Modo demo** (`demo@mascodata.cl`) con tres mascotas de ejemplo y todas las funciones desbloqueadas.
- **Mi perfil:** nombre, teléfono, ciudad, e interruptores de *promociones personalizadas* (`marketing_opt_in`, apagado por defecto) y *recordatorios por correo* (`reminders_opt_out`). Eliminación de cuenta con verificación por código (transfiere las mascotas al segundo tutor si existe).

### 2.2 Mascotas y ficha
- Alta en 4 pasos; ficha con nombre, especie (perro, gato, ave, conejo, pez, hámster, reptil), raza, nacimiento, sexo, estado reproductivo, microchip, alergias y condiciones, peso y veterinario de cabecera.
- **Foto** reducida en el navegador a 512 px (JPEG) antes de guardarla.
- **Porcentaje de completitud** (ver §3.1) visible como barra en la ficha y en la lista, y como tarjeta en el panel con los próximos pasos.
- **Segundo tutor** (Premium): invitación por correo con rol de edición o lectura, vigencia de 7 días. Roles por mascota: `owner`, `editor`, `viewer`.
- Exportar el expediente en PDF (Premium); borrar la mascota (solo el dueño) o salir de una compartida.

### 2.3 Salud
- **Vacunas y desparasitaciones:** catálogo por especie, periodicidades configurables, fecha de próxima dosis calculada y alertas (vencida / por vencer).
- **Medicamentos y tratamientos:** dosis, frecuencia, horarios del día, duración, stock y confirmación de dosis; rachas de cumplimiento.
- **Historial clínico:** consultas, cirugías, análisis, emergencias; costo y adjuntos (imágenes reducidas a 1.600 px; PDF y Word hasta 5 MB). Plan Free: 1 adjunto por evento.
- **Seguimiento:** estado de ánimo y energía, diario de síntomas con severidad y **peso histórico**:
  - La **ficha siempre muestra el peso actual** (el de la última medición). Al registrar el primer peso, el que tenía la ficha se guarda como medición con la fecha de creación de la mascota, para no perderlo.
  - **Editar el peso en la ficha** también registra una medición de hoy (y conserva el peso anterior como inicial), así ficha e historial no se contradicen.
  - Gráfico con las **fechas reales** en el eje horizontal, margen en el vertical para que un cambio pequeño no parezca un salto, el peso sobre cada punto y un resumen del último peso frente a la medición anterior. Lista de mediciones que se pueden **eliminar** (la ficha vuelve al peso de la anterior).
  - **Recordatorio mensual de pesar** en el panel: aparece a los 30 días de la última medición (o de la creación, si nunca se pesó), solo para quien puede editar y no en peces. Por ahora no hay correo.

### 2.4 Nutrición (nuevo)
- **Alimentos** con producto, categoría (**alimento diario** o **snack/premio**), tipo (seco, húmedo, BARF, casero), tamaño y unidad del paquete, precio pagado y fecha de compra.
- **Duración del paquete** o consumo diario, ambos **opcionales**: "¿Cuánto le dura?" (7–90 días) se guarda como consumo equivalente (tamaño ÷ días). Sin ninguno de los dos no se estima nada.
- **Historial de compras** por alimento (botón *Compré de nuevo*), que reinicia el conteo de stock.
- **Tres indicadores por alimento**, calculados con las compras registradas:
  1. *Se acaba*: días restantes y fecha.
  2. *Precio por kg*, con variación frente a la compra anterior, mini línea de tendencia y mejor precio pagado.
  3. *Repones cada*: cadencia real entre compras frente a la duración estimada, con opción de **Ajustar** cuando difieren 20 % o más (mínimo dos intervalos).
- **Buscar oferta:** abre la búsqueda del producto en **Google Shopping** o **Knasta** (solo un enlace; la plataforma no extrae datos de terceros).
- **Alertas de reposición:** en el panel, cuando quedan 7 días o menos (solo alimento diario con duración o consumo indicado); y por correo (§2.9).
- Las compras cuentan como gastos de categoría *Alimentación* en Finanzas, sin duplicarlos.

### 2.5 Agenda y cuidado compartido
- Calendario mensual con eventos manuales (consulta, examen, peluquería, hotel, vacuna, otros) y eventos derivados automáticamente de vacunas, desparasitaciones y tratamientos.
- **Agenda compartida:** los eventos que tienen mascota los ven **todos sus tutores**; quien puede editar la mascota (dueño y editores) puede modificarlos y borrarlos. Los eventos sin mascota siguen siendo personales. La primera vez, la Agenda muestra un aviso descartable.
- **Modalidad de cuidado por mascota** (Editar mascota → *¿Cómo se turnan el cuidado?*, solo si tiene otro tutor): **Vivimos juntos** (por defecto) o **Tutores separados**.
- **Estadías** (solo con tutores separados): evento con fecha de inicio y de fin, y *¿con quién está?* (conmigo o el otro tutor). Se dibuja en cada día del rango, con "Contigo" o "Con Pedro". Se guarda con un rol (`owner`/`guest`) y no con un nombre, porque un tutor no puede ver quién es el otro; cada persona lo lee desde su propio rol.
- **Turnos recurrentes:** al crear una estadía se puede **repetir**: *alternar turnos* (bloques de 2 a 14 días que se reparten entre los dos tutores, sin días libres) o *todos los fines de semana* (viernes a domingo), hasta una fecha (máximo un año, tope de 80 estadías por serie). Se guardan como **estadías reales**, una por período, así cada una se puede mover o borrar por separado; las fechas que ya tienen estadía se omiten. *Quitar las estadías futuras* de una mascota permite rehacer el calendario.
- **Resumen de traspaso** (ficha, con otro tutor): tratamientos y si la dosis de hoy está dada (y quién), alimento diario y cuándo se acaba, último peso, vacunas y desparasitaciones vencidas o próximas (las 6 más urgentes), citas de los próximos 14 días, lo último que se registró y el veterinario. Se puede **copiar como texto** para enviarlo.
- **Quién hizo qué:** cada registro (vacunas, desparasitaciones, tratamientos, historial, peso, dosis, compras de alimento y eventos) guarda quién lo creó. Lo rellena la base de datos con la sesión y el nombre del perfil, así que no se puede firmar a nombre de otra persona. Los registros anteriores quedan sin autor.
- **Dosis de hoy sin duplicar:** el botón muestra quién y a qué hora la registró ("✓ Dosis de hoy registrada por Pedro · 09:04"), y antes de registrar consulta el servidor por si el otro tutor ya la dio.
- **Actividad reciente** en la ficha (solo con otro tutor): los últimos registros de todos los tutores, con "Tú" o el nombre de quien los hizo.
- **Datos al día entre tutores:** al volver a la pestaña se recargan los datos (máx. una vez por minuto, solo con mascotas compartidas, sin pisar un modal abierto ni el alta de una mascota).
- **Dónde está hoy:** franja en el panel y en la ficha ("Hoy Greta está con Pedro · hasta el 28-09-2026"), calculada con las estadías.

### 2.6 Finanzas
- Registro de gastos por categoría, mascota y fecha; filtros por mascota y período; exportación a CSV.
- Gráficos por período, variación y predicción del próximo mes (**Premium**); desglose por categoría y por mascota (libre).
- **Gastos compartidos con saldo** (Editar mascota → *¿Cómo se reparten los gastos?*, solo si tiene otro tutor): **Cada uno lleva los suyos** (por defecto) o **A partes iguales**. Con reparto, quien registró un gasto es quien lo pagó, y el otro tutor lo ve y debe la mitad. La tarjeta *Gastos compartidos* muestra "Pedro te debe $114.000" / "Le debes $X a Pedro" / "Están al día", lo que pagó cada uno y el detalle. **Registrar un pago** (yo le pagué / me pagó) reduce el saldo; solo quien lo registró puede borrarlo. Los totales y gráficos de cada tutor muestran **lo que pagó él**; lo que pagó el otro va al saldo. Los gastos anteriores a que se guardara el autor no entran al saldo (se avisa cuántos), y el botiquín nunca se reparte. Al crear un gasto de una mascota que reparte, el modal avisa que el otro tutor lo verá.
- **Tarjeta *Alimentación***: gasto del mes frente al anterior, porcentaje del gasto total y costo por día.
- Al elegir la categoría *Alimentación* en **Registrar gasto**, el modal lleva al formulario de compra de la ficha (un solo lugar para el dato); *Registrar solo como gasto* mantiene el formulario manual.

### 2.7 Botiquín (Premium)
Inventario de medicamentos e insumos del hogar con stock y caducidad, y alertas.

### 2.8 Panel de inicio
Lista única **Necesita atención** ordenada por urgencia (vencidas, por vencer, recomendaciones, alimento por acabarse, recordatorio de pesar), tarjeta de completar el perfil, franja de hoy, rachas y cumpleaños.

### 2.9 Correos automáticos
Además de estos dos, los **correos de autenticación** de Supabase (confirmar cuenta, enlace de acceso y código, restablecer contraseña, cambio de correo, código de verificación) usan plantillas con la marca (`supabase/email-templates/`). Son genéricas a propósito: no insertan ningún dato que un usuario pueda escribir, para que nadie use nuestro dominio para enviar mensajes falsos.
Ambos son avisos de servicio (no promociones), solo al **dueño**, con enlace de baja firmado y un interruptor único en Mi perfil.

| Correo | Cuándo | Contenido |
|---|---|---|
| **Completar el perfil** | Días 2, 7 y 21 desde que se creó la mascota, mientras no esté al 100 % (máx. 1 correo por persona a la semana) | Porcentaje, tres próximos pasos y botón a la ficha |
| **Alimento por acabarse** | Faltan 3 días o menos (hasta 3 días después), un aviso por alimento y ciclo de compra | Alimentos con fecha estimada, *Buscar oferta* y *Compré de nuevo*; un solo correo por persona |

### 2.10 Panel de administrador
Solo `is_admin = true`. Métricas de usuarios, mascotas y planes; tabla de usuarios; cambio de plan con registro de auditoría; gestión de usuarios que aceptan promociones (contador, filtro y exportación CSV). MRR estimado = usuarios Premium × precio mensual.

### 2.11 Sitio público y marca
Landing v2 (siempre en tema claro, con eventos `landing_*` en PostHog), Manual de marca v2 en `/marca`, páginas legales y confirmación de baja de correos (`/recordatorios`).

---

## 3. Reglas de negocio

### 3.1 Porcentaje de completitud de la mascota

14 campos con peso que suman 100. Toda mascota parte en 10 %. En peces, aves, hámsteres y reptiles no cuentan los campos de salud (vacuna, desparasitación, estado reproductivo, microchip) y el resto se reescala.

| Campo | Puntos | Campo | Puntos |
|---|---|---|---|
| Nombre y especie | 10 | Peso | 7 |
| Fecha de nacimiento | 11 | **Alimento** | 6 |
| Foto | 7 | Estado reproductivo* | 5 |
| Raza | 5 | Nombre del veterinario | 7 |
| Sexo | 3 | Teléfono del veterinario | 6 |
| Microchip* | 3 | Alergias y condiciones | 7 |
| Al menos una vacuna* | 15 | Al menos una desparasitación* | 8 |

\* No aplica a peces, aves, hámsteres ni reptiles. El cálculo existe en dos copias (navegador y Edge Function) y un test de paridad falla si se desincronizan.

### 3.2 Planes

| | Free | Premium |
|---|---|---|
| Precio | $0 | $2.500/mes o $19.990/año |
| Mascotas | 1 | Ilimitadas |
| Segundo tutor, exportar expediente, Botiquín, gráficos y predicción de gastos | — | Sí |
| Adjuntos por evento del historial | 1 | Ilimitados |

Fuente única: `PLANS` en `js/app.js`. La landing repite los precios a mano.

### 3.3 Presupuesto de correos (Resend gratuito: 100 por día)
Recordatorios de perfil: máx. 50 por corrida · alimento: máx. 40 · margen de 10 para correos de cuenta de Supabase.

---

## 4. Especificación técnica

### 4.1 Arquitectura
SPA en JavaScript sin *build step*: HTML + módulos ES nativos servidos como archivos estáticos por Vercel (`vercel.json` reescribe toda ruta a `index.html`). Tailwind CSS por CDN con la paleta de marca remapeada en `index.html`; Chart.js 4.4 para gráficos; tipografía Manrope autohospedada. Sin servidor propio: datos y autenticación en Supabase con Row Level Security; tareas programadas con Edge Functions.

### 4.2 Estructura del código
13 módulos en `js/` (`app`, `utils`, `data`, `auth`, `dashboard`, `pets`, `vaccines-dewormings`, `medications-history`, `calendar`, `finance`, `botiquin`, `tracking`, `admin`). Ninguno importa de otro: cada función se expone en `window` al final del archivo, y `scripts/check-exports.mjs` (parte de `npm test`) verifica que toda función usada en un `onclick` esté exportada.

Convenciones de seguridad en el cliente: `esc()` para texto en HTML; `safeId()` para ids dentro de `onclick`; `safeDataUrl()` para archivos adjuntos; `shrinkImage()` para reducir imágenes antes de guardarlas.

### 4.3 Modelo de datos (PostgreSQL)

| Grupo | Tablas |
|---|---|
| Cuentas | `profiles` (plan, `is_admin`, opt-ins, `reminders_opt_out`), `plan_changes`, `invitations` |
| Mascotas y acceso | `pets` (con `care_mode` y `expense_split`), `pet_access` (`owner` / `editor` / `viewer`) |
| Salud | `vaccines`, `dewormings`, `medications`, `dose_logs`, `history_records`, `weight_history`, `mood_logs`, `symptoms_logs`, `activities` |
| Nutrición | `food_items` (con `category`), `food_purchases` |
| Agenda y dinero | `events` (compartidos por mascota; con `end_date` y `holder`), `expenses` (con autor; visibles al otro tutor si la mascota reparte), `expense_settlements` (pagos entre tutores), `botiquin_items` |
| Correos | `pet_reminders`, `food_restock_reminders` |
| Heredada | `meals` (sin uso; candidata a eliminar) |

Migraciones nuevas, todas idempotentes y en `supabase/schema/`: `pet_reminders.sql`, `food_purchases.sql`, `food_category.sql`, `food_restock_reminders.sql`, `harden_invitations_pets.sql`, `harden_limits_and_audit.sql`, `shared_events_care_mode.sql`, `activity_attribution.sql`, `shared_expenses.sql`. Las tablas nuevas son opcionales para la app: si faltan, la funcionalidad correspondiente se desactiva sin errores.

### 4.4 Seguridad
- **RLS en todas las tablas.** Acceso a las mascotas mediante `pet_accessible()` y `pet_editor()`; los datos personales (`events`, `expenses`, `botiquin_items`) por `user_id`, y su `pet_id` debe ser una mascota accesible.
- **`profiles`:** un trigger impide que un usuario cambie `is_admin`, `plan`, `plan_expires_at` o `stripe_customer_id`. Probado con simulación de sesiones.
- **Invitaciones:** solo el dueño de la mascota puede crearlas; quien las recibe solo puede marcarlas como usadas (trigger); aceptar exige que la haya creado el dueño real.
- **Dueño de la mascota:** un trigger impide cambiar `pets.owner_id` desde el navegador; solo el servidor (`delete-account`, clave de servicio) puede.
- **Autoría:** `created_by` y `created_by_name` los fija un trigger en cada tabla de registros (no el navegador) y no se pueden modificar después. Probado con `test_activity_attribution.sql`.
- **Gastos compartidos:** los gastos de una mascota solo los ve el otro tutor si la mascota reparte a partes iguales (`expense_split = 'equal'`); nadie puede modificar ni borrar gastos ajenos, y los pagos entre tutores llevan la firma de quien los registró (no falsificable) y solo él puede borrarlos. Probado con `test_shared_expenses.sql`.
- **Agenda compartida:** `events` se comparte por mascota mediante `pet_accessible()` (ver) y `pet_editor()` (crear, modificar, borrar); un trigger impide cambiar el autor de un evento. Probado con simulación de sesiones (`test_shared_events.sql`).
- **Auditoría de planes:** `plan_changes` es de solo lectura y agregar, también para administradores.
- **Topes de tamaño:** `pets.photo` ≤ 1 MB y `history_records.files` ≤ 20 MB (restricciones `NOT VALID`: no rechazan filas antiguas, sí escrituras nuevas).
- **XSS:** escape de todo texto que un co-tutor puede escribir; 5 casos de `onclick` con cadenas corregidos.
- **Secretos:** `RESEND_API_KEY`, `CRON_SECRET` y `UNSUB_SECRET` solo en los secretos de Supabase; enlaces de baja firmados con HMAC-SHA256.
- **Analítica:** PostHog sin autocaptura ni grabación de sesiones; se eliminan tokens de las URL antes de enviar eventos; no corre en `localhost`.
- La auditoría con `security-audit-skill` se hizo sin ejecutar código de terceros; los hallazgos se validaron con pruebas de simulación dentro de una transacción que se deshace (`supabase/schema/test_*.sql`).

### 4.4.1 Pruebas de seguridad disponibles
`test_harden_invitations_pets.sql` (invitaciones y dueño) y `test_protect_profiles.sql` (columnas privilegiadas). Ambas terminan con un error a propósito para no guardar nada.

### 4.5 Edge Functions y tareas programadas

| Función | Cron (UTC) | Propósito |
|---|---|---|
| `pet-completion-reminders` | `0 13 * * *` | Correos para completar el perfil |
| `food-restock-reminders` | `30 13 * * *` | Aviso de alimento por acabarse |
| `delete-account` | — (a demanda) | Elimina la cuenta y transfiere mascotas al segundo tutor |

Las funciones de correo corren con **Verify JWT desactivado** y se protegen con `CRON_SECRET`; el enlace de baja se valida con `UNSUB_SECRET`. Reservan el envío en la base antes de llamar a Resend y liberan la reserva si falla. Ambas admiten `?dry=1` para simular. Programación con `pg_cron` + `pg_net`. **El despliegue es manual** (pegar el código en el panel de Supabase); el repositorio es la fuente del código.

### 4.6 Analítica de producto
Eventos explícitos en PostHog, entre otros: `signup_completed`, `login`, `pet_created`, `record_saved`, `invite_sent`, `upgrade_clicked`, `premium_blocked`, `profile_completion_click`, `food_purchase_logged`, `food_offer_click`, `food_offer_store`, `food_duration_adjusted`, `expense_food_redirect`.

### 4.7 Pruebas
Vitest con jsdom: **262 pruebas en 15 archivos**, más `check-exports`. Las vistas se renderizan de verdad. Las Edge Functions se prueban importando su lógica pura (`npm:@supabase/supabase-js` se sustituye por un stub en `vitest.config.js`). Sin cobertura de extremo a extremo en navegador.

### 4.8 Capacidad con los planes gratuitos

| Servicio | Límite relevante | Nota |
|---|---|---|
| Supabase | 500 MB de base, 1 GB de archivos, 50.000 usuarios activos al mes | Las fotos y adjuntos se guardan como base64 en la base (no en Storage). Con fotos reducidas (~100 KB) caben unas 2.000 personas; los PDF grandes reducen ese margen |
| Resend | 100 correos por día, 3.000 al mes | Ver §3.3 |
| Vercel Hobby | 100 GB de ancho de banda | **Solo uso no comercial**: al cobrar Premium hay que pasar a Pro |

---

## 5. Pendientes y deuda técnica

**Producto**
- Cobro en línea de Premium (hoy manual); registrar si la persona paga mensual o anual.
- Fotografía real para la landing y `/marca` (hoy hay un espacio reservado).
- Que `/` muestre la landing a quien no tiene sesión.

**Marca y comunicación**
- Logo nuevo en la pantalla de consentimiento de Google.
- Instalar las plantillas de correo de Supabase Auth (archivos listos en `supabase/email-templates/`) y configurar el remitente propio con Resend SMTP.

**Técnica**
- La app se describe como PWA pero no tiene manifiesto ni *service worker*: no es instalable todavía.
- Tailwind por CDN en producción (sin *build*): conviene compilarlo antes de escalar.
- Mover fotos y adjuntos a Supabase Storage para no consumir la base.
- Cobertura de pruebas parcial (wizard de alta, calendario, botiquín, autenticación).
- Eliminar la tabla `meals`.
- Los gastos manuales de *Alimentación* anteriores al flujo nuevo pueden duplicar compras registradas en la ficha; se revisan a mano.
- Correo de reposición: evaluar un interruptor propio, separado del de recordatorios de perfil.
- Recordatorio de pesar por correo (hoy solo en la plataforma): requeriría rebajar los topes de los otros correos para respetar los 100 diarios de Resend.
- **Cuidado compartido, etapas siguientes:** aviso al otro tutor cuando se registra algo importante; quién dio de comer y quién sacó a pasear (hoy el check-in de actividad no guarda autor); editar una serie de turnos completa (hoy se rehace con *Quitar las estadías futuras*); repartos distintos de 50/50 y saldo entre varias mascotas; rol de co-dueño; cuidadores temporales con acceso limitado; ubicación del botiquín y del alimento por hogar.
- Ideas de Seguimiento pendientes: rango de peso saludable por raza y tamaño, alerta de cambio de peso mensual, cambios de alimento sobre el gráfico de peso.

---

## 6. Cambios recientes (septiembre 2026)
- Modelo de 2 planes y rediseño completo con el Manual de marca v2 (app, landing, `/marca`, páginas legales).
- Completitud del perfil (app y correo), incluida la incorporación del alimento.
- Módulo de nutrición: categoría, duración del paquete, historial de compras, indicadores, buscar oferta, integración con Finanzas y aviso por correo.
- Gestión de usuarios que aceptan promociones en el panel de administrador.
- Reducción de fotos e imágenes en el navegador.
- Auditoría de seguridad y endurecimiento de la base (perfiles, invitaciones, dueño de la mascota, topes de tamaño), con pruebas automáticas.
