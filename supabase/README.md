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
