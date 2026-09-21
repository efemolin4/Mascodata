# Mascotapp — Gestión Integral de Mascotas

Aplicación web progresiva (PWA) de página única para tutores de mascotas. Permite registrar y gestionar toda la información de salud, vacunas, medicamentos, agenda y finanzas de múltiples mascotas desde un solo lugar.

🔗 **Demo en vivo:** [my-pets-3-0.vercel.app](https://my-pets-3-0.vercel.app)

---

## Características principales

### 🐾 Gestión de mascotas
- Registro de múltiples mascotas con ficha completa: nombre, especie, raza, fecha de nacimiento, sexo, color, estado reproductivo y microchip
- Catálogo de razas por especie (perro, gato, ave, conejo, pez, hámster, reptil)
- Avatar con emoji personalizado
- Datos del veterinario de cabecera (nombre, clínica, teléfono, email)
- Edad calculada automáticamente

### 💉 Vacunas
- Catálogo específico por especie (DHPP, antirrábica, triple felina, etc.)
- Periodicidades configurables: mensual, bimestral, trimestral, semestral, anual, cada 2 o 3 años
- Cálculo automático de fecha de próxima dosis
- Alertas cuando una vacuna está vencida o próxima a vencer

### 🪱 Desparasitaciones
- Registro de tratamientos antiparasitarios con producto, dosis y fecha
- Mismo sistema de periodicidades y alertas que las vacunas

### 💊 Medicamentos y tratamientos
- Registro completo: medicamento, dosis, unidad, frecuencia en horas o días
- Cálculo automático de horarios de dosificación del día
- Fecha de inicio, hora de inicio y duración del tratamiento
- Control de stock (cantidad, unidad, fecha de caducidad)
- Tratamientos activos vs. finalizados

### 📋 Historial clínico
- Registro de consultas, cirugías, análisis, emergencias y observaciones
- Vista cronológica del historial completo

### 📅 Agenda
- Calendario mensual con vista de eventos por día
- Tipos: veterinario, vacuna, medicamento, desparasitación, baño, peluquería y otros
- Indicadores visuales en días con eventos

### 💰 Finanzas
- Registro de gastos por categoría con filtros por mascota y período
- Dashboard de gastos: barras por período con el monto sobre cada una, variación vs. el período anterior y desglose por categoría y por mascota
- Exportación a CSV
- Predicción de gasto mensual

### 🧴 Botiquín
- Inventario de medicamentos e insumos del hogar
- Estado de stock: disponible, por agotarse o agotado
- Alertas de caducidad

### 📊 Seguimiento y nutrición
- Historial de peso con gráfico de evolución
- Registro de estado de ánimo y energía
- Log de síntomas con severidad
- Registro de comidas y actividad física

### 🏠 Dashboard
- "Necesita atención": lista única por urgencia (vencidas, por vencer, recomendaciones), con un botón de acción por fila; franja de hoy (medicamentos, eventos, gasto del mes) y estado por mascota
- Streaks de bienestar
- Recomendaciones inteligentes
- Cumpleaños próximos

### ⚙️ Panel de Administrador (SaaS)
- Acceso exclusivo para usuarios con `is_admin = true`
- **Dashboard:** métricas de usuarios, mascotas, distribución de planes, gráfico de registros 7 días
- **Usuarios:** tabla completa con plan, mascotas y fecha de registro
- **Planes:** gestión de planes Free / Basic / Pro / Clínica con cambio de plan por usuario

---

## Tecnología

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + JavaScript vanilla (SPA) |
| Estilos | Tailwind CSS v3 (CDN) + CSS custom |
| Gráficos | Chart.js 4.4 |
| Auth | Supabase Auth (email + password, recuperación) |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Email | Supabase Auth (SMTP) |
| Deploy | Vercel |

**Sin backend propio.** Auth y datos gestionados 100% por Supabase con Row Level Security.

---

## Arquitectura de base de datos (Supabase)

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario (nombre, plan, is_admin, teléfono, ciudad, opt-in de promociones) |
| `pets` | Mascotas (owner_id, especie, raza, microchip, vet) |
| `pet_access` | Control de acceso por mascota (owner / editor / viewer) |
| `vaccines` | Vacunas por mascota |
| `dewormings` | Desparasitaciones por mascota |
| `medications` | Medicamentos y tratamientos |
| `history_records` | Historial clínico |
| `events` | Eventos de la agenda |
| `expenses` | Gastos y finanzas |
| `botiquin_items` | Inventario del botiquín |
| `weight_history` | Historial de peso |
| `mood_logs` | Registro de estado de ánimo |
| `symptoms_logs` | Log de síntomas |
| `food_items` | Alimento de cada mascota (producto, tamaño de paquete, consumo diario) — estima cuándo se acaba, reemplaza el antiguo registro de comidas |
| `activities` | Check-in diario de actividad (Poco/Normal/Mucho) |
| `dose_logs` | Log de dosis administradas |
| `invitations` | Invitaciones pendientes/aceptadas de segundo tutor |
| `plan_changes` | Auditoría de cambios de plan (quién, de qué a qué, cuándo) — usada para el churn y el historial del panel Admin |
| `meals` ⚠️ | Registro de comidas detallado — reemplazada por `food_items`, ya no la usa la app. Sigue teniendo políticas RLS activas (candidata a limpieza). |

Todas las tablas tienen **Row Level Security (RLS)** activo — cada usuario
solo ve sus propios datos, o los de las mascotas a las que tiene acceso vía
`pet_access`. El estado real de las políticas está versionado en
[`supabase/schema/rls_policies.sql`](supabase/schema/rls_policies.sql)
(foto tomada el 2026-09-08 — ver [`supabase/README.md`](supabase/README.md)
para la query de introspección y cómo mantenerlo al día).

---

## Estructura del proyecto

```
Mascotapp/
├── index.html               # Punto de entrada + CDN scripts
├── vercel.json               # Reescribe cualquier ruta a index.html (rutas reales en prod)
├── package.json               # Solo para tests (Vitest) — la app en sí no tiene build step
├── vitest.config.js           # environment: jsdom + setupFiles (ver test/setup.js)
├── css/
│   └── style.css              # Estilos personalizados y animaciones
├── scripts/
│   ├── spa-server.py          # Servidor local con el mismo fallback de vercel.json
│   └── check-exports.mjs      # Verifica que toda función usada en onclick="..." esté exportada
├── test/
│   ├── setup.js                # Stub de window.supabase (setupFiles de Vitest)
│   └── mockSupabase.js         # Mock del query builder de supabase-js para los tests
├── supabase/
│   ├── README.md               # Query de introspección y cómo mantener la foto al día
│   └── schema/
│       └── rls_policies.sql    # Foto versionada de las políticas RLS en producción
└── js/
    ├── utils.js                    # Utilidades puras: fechas, formato, cálculo de estado
    ├── utils.test.js               # Tests de Vitest para js/utils.js
    ├── exports.test.js             # Corre check-exports.mjs como parte de `npm test`
    ├── app.js                      # Núcleo: estado, router, shell de UI, iconos, render/initApp
    ├── data.js                     # Carga de datos desde Supabase (mascotas, admin, agenda, gastos)
    ├── auth.js                     # Login/registro/logout y datos de demo
    ├── dashboard.js                # Vista de inicio
    ├── dashboard.test.js           # Tests de renderizado (onboarding, alertas, escape de HTML)
    ├── pets.js                     # Alta, ficha, edición, borrado y segundo tutor
    ├── pets.test.js                # Tests de savePet() (límite de plan, insert, rollback)
    ├── vaccines-dewormings.js      # Vacunas y desparasitaciones
    ├── vaccines-dewormings.test.js # Tests de guardar/eliminar vacuna + guardia de solo lectura
    ├── medications-history.js      # Tratamientos e historial clínico
    ├── calendar.js                 # Agenda
    ├── finance.js                  # Finanzas
    ├── finance.test.js             # Tests de guardar/eliminar gasto
    ├── botiquin.js                 # Botiquín
    ├── tracking.js                 # Seguimiento y Nutrición
    ├── admin.js                    # Panel de administrador SaaS
    └── admin.test.js               # Tests de applyPlanChange()
```

**Sin build step para la app.** Los archivos se sirven tal cual — ver
[Deploy](#deploy). Todos los `js/*.js` se cargan como módulos ES nativos
(`<script type="module">`); ninguno importa de otro — cada función y
constante de nivel superior se expone además en `window` al final de su
archivo (misma convención en los 13 archivos), así que se siguen llamando
entre sí como globales exactamente igual que en el archivo único original.
`scripts/check-exports.mjs` (corrido en `npm test`) verifica automáticamente
que toda función referenciada desde un `onclick="..."` del HTML generado
esté realmente exportada — si falta una, el botón correspondiente se
rompería en silencio, y este chequeo lo convierte en un test que falla.

### Tests

```bash
npm install
npm test        # corre una vez
npm run test:watch   # modo watch
```

Corre sobre `environment: 'jsdom'` (ver `vitest.config.js`), así que las
vistas se pueden renderizar de verdad (no solo simular) y assertar sobre el
HTML resultante. Cubre:

- **`js/utils.js`**: aritmética de fechas en zona local, los 3 niveles de
  alerta de `careAlertStatus()`, los umbrales de `medStockStatus()`/
  `foodStockStatus()`, el escape de HTML de `esc()`.
- **`js/exports.test.js`**: que ningún botón quede roto por una función sin
  exportar tras mover código entre archivos (corre `check-exports.mjs`).
- **Vistas** (`dashboard.test.js`): que `viewDashboard()` renderice el
  onboarding sin mascotas, cuente bien las alertas vencidas, y escape el
  nombre del usuario.
- **Llamadas a Supabase** (`pets.test.js`, `vaccines-dewormings.test.js`,
  `finance.test.js`, `admin.test.js`), con `sb` reemplazado por un mock del
  query builder (`test/mockSupabase.js`): que un error de Supabase muestre
  el toast correspondiente y **no** mute el estado local (la clase de bug
  que motivó agregar `{ error }` a los `deleteX()` — ver más abajo), que el
  límite de mascotas por plan bloquee el insert antes de llamar a Supabase,
  que un tutor con acceso de solo lectura no pueda llamar a Supabase, y que
  un rollback (ej. falla el insert de `pet_access` después de crear la
  mascota) efectivamente deshaga el insert previo.

Sigue faltando cobertura de la mayoría de las ~150 funciones (wizard de
alta completo, calendario, botiquín, seguimiento/nutrición, autenticación)
— lo de arriba son ejemplos representativos de vista + Supabase, no una
cobertura exhaustiva. El resto depende todavía de verificación manual en el
navegador.

---

## Funciones principales

Repartidas entre `js/*.js` según la tabla de la sección anterior (ej.
`viewDashboard()` vive en `js/dashboard.js`, `saveVaccine()` en
`js/vaccines-dewormings.js`, etc.):

| Función | Descripción |
|---|---|
| `initApp()` | Inicialización, sesión Supabase, detección recovery |
| `loadDataFromSupabase()` | Carga paralela de todos los datos del usuario |
| `loadAdminData()` | Carga datos de todos los usuarios (solo admin) |
| `viewDashboard()` | Pantalla de inicio con resumen y streaks |
| `viewPets()` | Listado de mascotas |
| `viewAddPet()` | Stepper de registro (4 pasos) |
| `viewPetProfile()` | Perfil completo con pestañas |
| `viewCalendar()` | Agenda mensual |
| `viewFinance()` | Módulo de gastos y gráficos |
| `viewBotiquin()` | Inventario del botiquín |
| `viewAdmin()` | Panel de administrador SaaS |
| `savePet()` | Crear mascota en Supabase |
| `saveVaccine()` | Guardar vacuna en Supabase |
| `saveMedication()` | Guardar medicamento en Supabase |
| `saveEvent()` | Guardar evento en Supabase |
| `saveExpense()` | Guardar gasto en Supabase |
| `applyPlanChange()` | Cambiar plan de usuario (admin) |

---

## Autenticación (Supabase Auth)

- **Registro** con nombre, email y contraseña
- **Login** con persistencia de sesión (JWT)
- **Recuperación de contraseña** por email con link seguro
- **Modo demo** con datos precargados (`demo@mascotapp.cl`)
- Sesión persistente entre recargas con `getSession()`

---

## Planes SaaS

Modelo de 2 planes (reemplaza al anterior de 4 — ver "Migración a 2 planes"
más abajo). El límite de mascotas vive en `PLAN_PET_LIMITS`
(`js/app.js`); el resto de las funciones Premium se gatean con
`isPremium()`/`blockIfNotPremium()`/`premiumUpsell()` (también en
`js/app.js`) — mismo patrón que ya usa `canEditPet()`/`blockIfReadOnly()`
para el rol de solo lectura de un tutor compartido.

| Plan | Precio | Incluye |
|---|---|---|
| **Free** | $0 | 1 mascota · fichas, vacunas, desparasitaciones, tratamientos e historial clínico completos · agenda y alertas · Finanzas básicas (lista, total y desglose por categoría) · Seguimiento y Nutrición · 1 archivo adjunto por evento del historial |
| **Premium** | $2.000/mes | 5 mascotas · todo lo de Free · compartir con un segundo tutor · Finanzas avanzada (gráficos por período y predicción de gastos) · exportar expediente en PDF · Botiquín del hogar · adjuntos ilimitados en el historial |

El modo demo (`demo@mascotapp.cl`) siempre se ve como Premium — es una
vitrina del producto completo, no debe sentirse limitado.

### Migración a 2 planes (2026-09-08)

Antes existían 4 planes (`free`/`basic`/`pro`/`clinic`), pero el único
límite realmente aplicado en todo el código era el número de mascotas —
ninguna otra función estaba restringida por plan. Al simplificar a 2
planes, corré esto una sola vez en el SQL Editor de Supabase para migrar
las cuentas existentes:

```sql
UPDATE public.profiles SET plan = 'premium' WHERE plan IN ('basic', 'pro', 'clinic');
```

Si Supabase rechaza el `UPDATE` porque `profiles.plan` tiene un CHECK
constraint restringiendo los valores permitidos (no hay ninguno
documentado en este repo — `profiles.plan` es `text` plano), hay que
ajustar ese constraint ahí mismo antes de correr la migración.

### Auditoría de cambios de plan (2026-09-08)

`applyPlanChange()` (panel Admin → Usuarios → "Cambiar plan") ahora
registra cada cambio en una tabla nueva `plan_changes` — antes
sobreescribía `profiles.plan` sin dejar ningún rastro de quién lo cambió,
de qué a qué, ni cuándo. Esto habilita el "Bajas de Premium (30d)"
(churn) y el historial que aparecen en el Dashboard del admin. Requiere
crear la tabla una sola vez:

```sql
CREATE TABLE public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_plan text,
  to_plan text not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

ALTER TABLE public.plan_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage plan_changes" ON public.plan_changes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
```

Los cambios de plan hechos con la versión anterior de `applyPlanChange()`
no quedaron registrados acá (no existía la tabla) — el historial empieza
a contar desde que se corre esta migración, no reconstruye el pasado.

---

## Configuración de Supabase

```javascript
const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### Envío de correos (recuperar contraseña / invitar tutor)

La app usa **solo Supabase Auth** para enviar correos (recuperación de
contraseña y la invitación al segundo tutor, vía magic link) — ya no
depende de EmailJS ni de ningún otro tercero. Para que los correos
realmente lleguen hay que configurar en el Dashboard de Supabase:

1. **Authentication → Emails → SMTP Settings**: activa "Enable Custom
   SMTP" y configura un proveedor real (Resend, SendGrid, Postmark,
   tu propio Gmail/Workspace, etc.). El servicio de correo por
   defecto de Supabase es solo para pruebas y está limitado a unos
   pocos correos por hora — con eso jamás va a andar en producción.
2. **Authentication → URL Configuration → Redirect URLs**: agrega la
   URL donde vive la app (por ejemplo `https://tu-dominio.com/*`) para
   que los links de "recuperar contraseña" e "invitar tutor" puedan
   redirigir de vuelta.

### Marcar usuario como administrador

```sql
UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'tu@email.com');
```

### Agregar columnas de contacto al perfil (2026-09-09)

La vista "Mi perfil" (accesible desde la fila de usuario del sidebar en
desktop, o el avatar de la barra superior en mobile) permite editar
teléfono, ciudad y si el usuario quiere recibir promociones a futuro.
Ejecuta esto una sola vez en el SQL Editor de Supabase para agregar las
columnas que le faltan a `profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
```

No hace falta tocar las políticas RLS — la política existente "Users
manage own profile" ya cubre la fila completa, columnas nuevas incluidas.

### Corregir columnas faltantes en `vaccines` y `dewormings`

Las tablas `vaccines` y `dewormings` fueron creadas sin las columnas de
periodicidad, alerta y costo que la app envía al guardar, por lo que
crear una vacuna o desparasitación nueva fallaba con un error de
Supabase (`Could not find the '...' column ... in the schema cache`).
Ejecuta esto una sola vez en el SQL Editor de Supabase para agregarlas:

```sql
ALTER TABLE public.vaccines
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS periodicity numeric,
  ADD COLUMN IF NOT EXISTS alert_type text,
  ADD COLUMN IF NOT EXISTS alert_days integer,
  ADD COLUMN IF NOT EXISTS cost numeric;

ALTER TABLE public.dewormings
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS periodicity numeric,
  ADD COLUMN IF NOT EXISTS alert_type text,
  ADD COLUMN IF NOT EXISTS alert_days integer,
  ADD COLUMN IF NOT EXISTS cost numeric;
```

`periodicity` es `numeric` (no `integer`) para soportar la opción
"1 1/2 meses" (valor `1.5`).

### Corrección de deuda técnica (2026-08-28)

Se corrigieron varios bugs donde partes de la app parecían funcionar en
el modo demo pero no persistían datos reales en Supabase. La causa de
fondo, descubierta inspeccionando el esquema real de producción, es que
buena parte del código usaba nombres de tabla/columna que **no
coinciden con el proyecto real**:

| Código asumía | Tabla/columna real |
|---|---|
| `clinical_history` | `history_records` (y `doctor`→`vet`, `files` es `text[]`) |
| `mood_log` | `mood_logs` |
| `symptoms_log` | `symptoms_logs` |
| `dose_log` (`medication_id`, `given`) | `dose_logs` (`med_id`, `confirmed`) |
| `botiquin` (`category`, `status`) | `botiquin_items` (`type`, sin `status`) |
| `meals` (`time`, `food`, `portion`, `portion_unit`) | `time_of_day`, `type`, `amount`, `unit` |
| `medications.frequency` / `stock_total` / `expiry` | no existe `frequency`; es `stock_qty` / `expiry_date` |
| tabla nueva `pet_invites` | ya existía como `invitations` |

Todo esto ya está corregido en `js/app.js`. Lo único que falta son 6
columnas nuevas en `pets` (nunca existieron) y dos políticas RLS para
que la invitación de segundo tutor funcione de punta a punta. Ejecuta
esto una sola vez en el SQL Editor de Supabase:

```sql
-- MASCOTAS: campos del wizard que nunca se guardaban (peso, talla,
-- alergias, condiciones crónicas) — las únicas columnas realmente nuevas
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS weight_gr numeric,
  ADD COLUMN IF NOT EXISTS size_range text,
  ADD COLUMN IF NOT EXISTS activity_level integer,
  ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chronic_conditions text[] DEFAULT '{}';

-- INVITACIONES: la política existente ("Inviters manage invitations")
-- solo deja ver/editar filas a quien las creó. La persona invitada
-- necesita poder ver su propia invitación por token y marcarla usada.
CREATE POLICY "Invited user can view own invitation" ON public.invitations
  FOR SELECT USING (invited_email = auth.email());
CREATE POLICY "Invited user can accept own invitation" ON public.invitations
  FOR UPDATE USING (invited_email = auth.email()) WITH CHECK (invited_email = auth.email());

-- PET ACCESS: el dueño de la mascota necesita poder quitarle el acceso
-- a un segundo tutor ya aceptado (la política existente solo permite
-- a cada usuario tocar su propia fila).
CREATE POLICY "Owner can remove pet access" ON public.pet_access
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_access.pet_id AND p.owner_id = auth.uid())
  );
```

**Notas:**
- La política actual de `pet_access` (`Users see own access`, `ALL`
  usando `user_id = auth.uid()`) ya es lo bastante amplia como para que
  cualquier usuario autenticado pueda insertarse a sí mismo en
  `pet_access` con cualquier `pet_id` — no hace falta una política
  extra para que la invitación funcione, pero vale la pena que lo
  tengas presente como consideración de seguridad aparte.
- `invitations.used` (boolean) reemplaza a lo que iba a ser una columna
  `status`; una invitación vence a los 7 días vía `expires_at`.
- Si ya tenías medicamentos, comidas, síntomas, ánimo o historial
  clínico guardados antes de esta corrección, es muy probable que esos
  inserts hayan estado fallando silenciosamente contra Supabase (nombre
  de tabla/columna incorrecto) — es decir, probablemente no haya datos
  reales que migrar, salvo lo que hayas cargado manualmente en el
  Table Editor.

### Alimentación por stock en vez de registro diario (2026-09-07)

El tab "Nutrición" dejó de pedir registrar cada comida y cada actividad
física por separado — en su lugar:

- **Alimentación**: se carga el producto que se compra (tamaño de paquete,
  consumo diario, precio) y la app calcula sola cuándo se estima que se
  acaba. Requiere una tabla nueva, `food_items`, que nunca existió:

```sql
create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  product text,
  type text,
  package_size numeric,
  package_unit text,
  daily_amount numeric,
  price numeric,
  purchase_date date,
  notes text,
  created_at timestamptz default now()
);

alter table public.food_items enable row level security;

create policy "Users manage food_items of accessible pets" on public.food_items
  for all using (
    exists (select 1 from public.pet_access pa where pa.pet_id = food_items.pet_id and pa.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pet_access pa where pa.pet_id = food_items.pet_id and pa.user_id = auth.uid())
  );
```

- **Actividad**: se reemplazó el formulario (tipo/duración/distancia) por
  un check-in de un toque (Poco/Normal/Mucho), un registro por día. Sigue
  usando la tabla `activities` ya existente — sin cambios de esquema.
- La tabla `meals` queda sin uso (no se borra por si tenías datos ahí).

### Dosis y costo en productos del botiquín (2026-09-08)

El modal de "Agregar producto al botiquín" solo pedía cantidad/unidad de
stock (ej: "20 comprimidos") — no había forma de registrar la
concentración del medicamento (ej: Pregalex de 75 mg) ni cuánto costó,
así que ese gasto nunca se reflejaba en Finanzas como sí pasa con
vacunas, desparasitaciones y tratamientos. Ahora:

- **Dosis/concentración** (`dose_val` + `dose_unit`, ej: "75 mg") se
  muestra junto al nombre del producto en el inventario — es la
  concentración por unidad, distinta de la cantidad en stock.
- **Costo** (`cost`) + **fecha de compra** (`purchase_date`): si se carga
  un costo, aparece automáticamente en Finanzas (categoría
  "Medicamentos"), igual que el costo de una vacuna o un tratamiento —
  ver `getFinanceExpenses()` en `js/data.js`.

Requiere 4 columnas nuevas en `botiquin_items` (nunca existieron):

```sql
ALTER TABLE public.botiquin_items
  ADD COLUMN IF NOT EXISTS dose_val numeric,
  ADD COLUMN IF NOT EXISTS dose_unit text,
  ADD COLUMN IF NOT EXISTS cost numeric,
  ADD COLUMN IF NOT EXISTS purchase_date date;
```

No hace falta tocar RLS — `botiquin_items` ya tiene su política
`Users manage own botiquin` (`user_id = auth.uid()`), que cubre columnas
nuevas automáticamente.

### Corrección de 13 bugs de una auditoría profunda (2026-09-08)

Una segunda pasada de auditoría (5 revisiones en paralelo, cruzando cada
campo entre carga desde Supabase / guardado / render / datos de demo)
encontró y corrigió, entre otros: el dueño de una mascota compartida no
podía borrarla de verdad si había una invitación de segundo tutor de por
medio (quedaba huérfana en la base); el modo demo perdía todos los datos
al recargar la página; editar una desparasitación no actualizaba su
unidad al cambiar el formato; el gráfico "Trimestral" y la "Predicción de
gastos" de Finanzas tenían bugs de cálculo; varias acciones de Seguimiento
(peso, ánimo, síntomas, BCS) no respetaban el acceso de solo lectura de un
tutor invitado; y el puntaje de condición corporal (BCS) nunca se
guardaba en Supabase para usuarios reales — solo en memoria.

Este último requiere una columna nueva en `pets` (nunca existió):

```sql
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS bcs integer;
```

El resto de las correcciones fueron solo de código — no requieren ningún
cambio en Supabase. Detalle completo en el historial de git de esa fecha.

---

## Deploy

El proyecto no requiere build. Se puede desplegar directamente en:

- **Vercel:** conectar el repositorio y desplegar automáticamente
- **GitHub Pages:** activar Pages desde la rama `main`
- **Cualquier hosting estático:** subir los 3 archivos

Requiere una cuenta gratuita en [supabase.com](https://supabase.com) para auth y base de datos.

---

## Licencia

MIT — libre uso, modificación y distribución.
