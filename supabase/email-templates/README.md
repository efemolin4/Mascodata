# Plantillas de los correos de autenticación

Correos que Supabase envía al registrarse, entrar, cambiar la contraseña o el correo. Van con la marca de Mascodata
(mismo diseño que los recordatorios) y **no insertan ningún texto que pueda escribir un usuario**: cualquiera puede
pedirle a Supabase que envíe un correo con datos inventados a cualquier dirección, así que mostrarlos permitiría mensajes
falsos con nuestra marca. Por eso las plantillas son genéricas (sin `.Data` ni nombres).

## Instalar (una vez, a mano)

Supabase → **Authentication → Emails → Templates**. Para cada fila: cambiar el **Subject**, borrar el contenido del
cuadro de mensaje, pegar el archivo completo y **Save changes**.

| Plantilla de Supabase | Archivo | Asunto |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirma tu correo en Mascodata |
| Magic Link | `magic-link.html` | Tu código y enlace de acceso a Mascodata |
| Reset Password | `recovery.html` | Restablece tu contraseña de Mascodata |
| Change Email Address | `email-change.html` | Confirma tu nuevo correo en Mascodata |
| Reauthentication | `reauthentication.html` | Tu código de verificación de Mascodata |

`Invite user` no se usa (la app invita con el enlace de acceso, no con la invitación de administrador), así que se deja igual.

## Qué correo se manda en cada caso

- **Crear una cuenta** y **aceptar una invitación** con un correo que aún no tiene cuenta → *Confirm signup*.
- **Pedir el código para borrar la cuenta o una mascota**, o **aceptar una invitación** con un correo que ya tiene cuenta → *Magic Link*
  (por eso ese correo lleva el botón y también el código de 6 dígitos).
- **Olvidé mi contraseña** → *Reset Password*.

## Recomendado: que salgan desde noreply@mascodata.cl

Por defecto salen del remitente de Supabase, con un límite muy bajo por hora. En **Authentication → SMTP Settings →
Enable custom SMTP**: host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = una API key de Resend con permiso
de envío (créala solo para esto y pégala directamente en Supabase, nunca en un chat ni en el repositorio), remitente
`noreply@mascodata.cl` y nombre `Mascodata`. Estos correos cuentan para el tope de 100 diarios de Resend.

## Probar

Las pruebas de `js/email-templates.test.js` revisan las variables, que no haya texto de usuario, imágenes externas ni
etiquetas rotas. Para ver el resultado real: crear una cuenta de prueba, y pedir "Olvidé mi contraseña".
