# Cómo se publican los cambios (entornos y flujo de trabajo)

Hoy hay **un solo entorno real**: producción (`mascodata.cl`, un proyecto de Supabase). Este documento describe el flujo
mínimo para cambiar cosas sin ponerla en riesgo, y cuándo conviene sumar un entorno de pruebas.

## Qué es "producción" aquí

| Parte | Dónde vive | Cómo se publica |
|---|---|---|
| Sitio (HTML, JS, CSS) | Vercel, rama `main` de GitHub | Cada cambio que llega a `main` se publica solo en `mascodata.cl` |
| Base de datos, reglas de acceso (RLS), triggers | Proyecto de Supabase | A mano: pegar el SQL de `supabase/schema/` en el SQL Editor |
| Edge Functions y tareas programadas | Proyecto de Supabase | A mano: pegar el código en el panel y desplegar; los crons con SQL |

`localhost` (servidor local) y las vistas previas de Vercel usan **la misma base de datos de producción**, porque la URL de
Supabase está escrita en `js/app.js`. Hasta que exista un proyecto de pruebas, cualquier cosa que se guarde desde ahí queda
en la base real.

## Flujo para cada cambio (Nivel 1)

1. **Rama, no `main`.** Cada cambio se hace en una rama propia (`git checkout -b nombre-del-cambio`).
2. **Pruebas automáticas.** Al subir la rama, GitHub corre `npm test` (`.github/workflows/tests.yml`). Debe quedar en verde.
3. **Pull request.** Se abre un PR hacia `main` (GitHub muestra el enlace al subir la rama). La plantilla trae la lista de
   verificación de abajo.
4. **Vista previa.** Vercel publica la rama en una URL temporal y la pone como comentario del PR. Se revisa ahí.
5. **Fusionar.** Al fusionar el PR con `main`, se publica en producción.

Lista antes de fusionar: pruebas en verde · visto en la vista previa · si hay SQL, respaldo hecho y ensayado · si hay Edge
Function, desplegada y probada con `?dry=1` · sé cómo volver atrás.

### Limitaciones de las vistas previas (mientras no haya staging)
- Escriben en la base **real**. Para ver pantallas conviene usar el modo demo (`demo@mascodata.cl`), que no guarda nada.
- El acceso con **Google** y los **enlaces de los correos** (recuperar contraseña, invitaciones) vuelven a `mascodata.cl`, porque
  las direcciones `*.vercel.app` no están en la lista de *Redirect URLs* de Supabase. Iniciar sesión con correo y contraseña sí funciona.

## Volver atrás

- **Sitio:** Vercel → Deployments → elegir el despliegue anterior que funcionaba → **Promote to Production** (un clic, sin
  tocar el código). Después se corrige la rama con calma.
- **Base de datos:** no hay marcha atrás automática. Por eso, **antes de un SQL que modifique o borre datos**, ejecutar
  `supabase/schema/backup_before_migration.sql`, que deja copias de las tablas en el esquema `backups` (con la fecha en el
  nombre). El plan gratuito de Supabase no hace respaldos automáticos (verificarlo en *Database → Backups*).
- Los SQL del repositorio son **idempotentes** y la app funciona aunque falten (avisa que falta actualizar la base): un SQL que
  aún no se ejecutó no rompe el sitio.

## Reglas recomendadas en GitHub (una vez)

*Settings → Branches* (o *Rules → Rulesets*) → regla para `main`:
- **Require a pull request before merging** (nadie sube directo a `main`).
- **Require status checks to pass** → elegir **Pruebas** (aparece después de que el flujo corra una vez).

Y en Vercel (*Settings → Git*): **Production Branch = `main`**, con vistas previas activadas para las demás ramas (es lo normal).

## Lo que no pasa por el repositorio

Las plantillas de correo del panel, los límites de envío, el SMTP, las Edge Functions pegadas y el SQL del editor se aplican
**directo en producción**. Qué hay configurado hoy: [`docs/CONFIG-SUPABASE.md`](CONFIG-SUPABASE.md) (actualizarlo al cambiar algo).
Regla: cambiar una cosa a la vez, anotar el valor anterior antes de cambiarlo y probar en el momento.

## Cuándo sumar un entorno de pruebas (Nivel 2)

Antes de invitar a más personas, o antes del primer cambio de reglas de acceso que no se pueda ensayar sin riesgo:

1. Crear un **segundo proyecto de Supabase** (el plan gratuito permite dos): `mascodata-staging`.
2. Aplicar en él, en orden, todo `supabase/schema/` y desplegar las funciones; cargar datos de prueba.
3. Hacer que `js/app.js` elija la URL y la clave de Supabase según el sitio: `mascodata.cl` → producción; `localhost` y `*.vercel.app` → staging.
4. Agregar las URLs de vista previa a *Redirect URLs* de staging.
5. Regla: **todo SQL, función o cambio de reglas se ensaya primero en staging** y después se aplica en producción.

## Nivel 3 (cuando haya ingresos)

Plan Pro de Supabase (respaldos automáticos y ramas de base de datos), migraciones versionadas con la CLI de Supabase y
monitoreo de errores.
