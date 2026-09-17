-- Saca de la API pública las funciones que solo deben correr como trigger.
--
-- El linter de Supabase avisa que estas funciones `security definer` se pueden
-- invocar por REST (`/rest/v1/rpc/<nombre>`), algunas incluso sin estar
-- logueado. Como son `security definer`, corren con los permisos de quien las
-- creó, salteándose RLS.
--
-- Hoy el daño real es limitado: son funciones de trigger y esperan un `new`
-- que por RPC no existe, así que fallan. Pero no hay motivo para dejarlas
-- expuestas, y con varios clientes en la misma base el margen de error se
-- achica mucho.
--
-- ⚠️ EL DETALLE QUE IMPORTA: en Postgres toda función nace con EXECUTE
-- concedido a PUBLIC, y todos los roles lo heredan. Revocar solo a
-- `anon, authenticated` NO alcanza: se ve en el ACL como `=X/postgres`
-- (el grantee vacío es PUBLIC) y el permiso sigue vigente. Por eso hay que
-- revocar primero a PUBLIC. Verificado con has_function_privilege().
--
-- Revocar el EXECUTE no afecta a los triggers: Postgres no chequea ese
-- permiso al dispararlos, solo al crearlos. Probado en test con una tabla
-- descartable: el trigger corrió igual con el permiso revocado.

revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.trg_notif_siniestro()  from public, anon, authenticated;
revoke execute on function public.trg_notif_pendiente()  from public, anon, authenticated;
revoke execute on function public.trg_notif_solicitud()  from public, anon, authenticated;
revoke execute on function public.trg_notif_cotizacion() from public, anon, authenticated;

-- `notificar()` la llaman los triggers de arriba, no el portal. Mismo criterio.
revoke execute on function public.notificar(uuid, text, text, text, text, text)
  from public, anon, authenticated;

-- OJO: `es_activo()` y `es_organizador()` aparecen en el mismo aviso del
-- linter pero NO se tocan. Las policies de RLS se evalúan con los permisos
-- del usuario que consulta, así que `authenticated` necesita poder
-- ejecutarlas: revocarlas dejaría a todo el portal sin acceso a nada.
-- La forma correcta de sacarlas de la API es moverlas a un esquema que
-- PostgREST no exponga; queda para la migración de multi-tenant, donde esas
-- funciones se reescriben igual.
