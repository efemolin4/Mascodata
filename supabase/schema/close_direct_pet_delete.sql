-- Cierra la puerta directa para borrar mascotas desde el navegador. Ejecutar AL FINAL, cuando ya esté publicada la app
-- nueva (que elimina mascotas a través de la función `verification-codes`, con código). Si se ejecuta antes, la app
-- anterior seguiría mostrando "eliminada" sin borrar nada. Idempotente.
--
-- Después de esto el dueño ya no puede borrar una mascota con una llamada directa (ni con la sesión abierta): la función
-- exige el código. La excepción de 2 minutos deja deshacer el alta de una mascota si falla su acceso (marcha atrás de savePet).
-- Para volver atrás: recrear "Owner can delete pets" con USING (owner_id = auth.uid()), como en rls_policies.sql.

drop policy if exists "Owner can delete pets" on public.pets;
create policy "Owner can delete pets" on public.pets
  for delete to public
  using (owner_id = auth.uid() and created_at > now() - interval '2 minutes');
