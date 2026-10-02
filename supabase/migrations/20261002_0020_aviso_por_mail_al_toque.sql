-- 0020 — Que el mail de una denuncia salga cuando la denuncia entra
-- ============================================================================
-- El portal avisa por dos vías: la campanita (un trigger escribe en
-- `notificaciones`) y el email (la Edge Function `enviar-notificaciones`, que
-- pg_cron despacha cada tanto). La campanita viene funcionando desde julio; el
-- email nunca salió porque falta la RESEND_API_KEY, y las 294 notificaciones
-- de producción quedaron todas en 'omitido'.
--
-- Esta migración prepara el terreno para cuando esa clave esté, y arregla una
-- diferencia entre las dos bases que apareció al probarlo.
-- ============================================================================

-- ─── A. La misma clave foránea en las dos bases ─────────────────────────────
-- En producción `notificaciones.usuario_id` apunta a `perfiles`, que es lo que
-- dice el esquema de referencia. En test apuntaba a `auth.users`.
--
-- No es un detalle cosmético: PostgREST arma sus `select` anidados leyendo las
-- claves foráneas, así que el `notificaciones → perfiles(email, nombre, estado)`
-- de la función andaba en producción y en test contestaba
-- "Could not find a relationship between 'notificaciones' and 'perfiles'".
-- Una diferencia así es la peor clase: lo que se prueba en test no es lo que
-- corre en producción, y se descubre el día que se descubre.
--
-- `perfiles.id` es `auth.users.id` (la fila nace de un trigger), así que apuntar
-- a `perfiles` no afloja nada: sigue habiendo un usuario real detrás, con el
-- mismo borrado en cascada.
alter table public.notificaciones
  drop constraint if exists notificaciones_usuario_id_fkey;
alter table public.notificaciones
  add constraint notificaciones_usuario_id_fkey
  foreign key (usuario_id) references public.perfiles(id) on delete cascade;

-- ─── B. El despacho, cada minuto ────────────────────────────────────────────
-- Estaba cada 10 minutos, que para un recordatorio de vencimiento está bien y
-- para una denuncia no: el asegurado ya cargó las fotos y está esperando. Un
-- minuto es el mínimo que permite pg_cron y alcanza para que el mail llegue
-- junto con la campanita.
--
-- Despachar cada minuto no es despachar más: `despachar_emails()` arranca con
-- un `exists` y, si no hay nada pendiente, no invoca nada. El costo de los
-- minutos en los que no pasa nada es esa consulta.
--
-- Va con guarda porque pg_cron existe solo en producción: en test los avisos
-- se despachan llamando la función a mano, y está bien que así sea (no hace
-- falta un cron corriendo sobre datos inventados).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$ select cron.alter_job(j.jobid, schedule := '* * * * *')
                  from cron.job j where j.jobname = 'despacho-emails' $q$;
  end if;
end $$;

-- ─── Lo que NO hace esta migración ──────────────────────────────────────────
-- No reenvía nada de lo viejo. Las notificaciones ya marcadas 'omitido' se
-- quedan así: el día que se cargue la clave, nadie va a recibir de golpe los
-- 294 avisos de los últimos tres meses. Solo salen por mail las nuevas.
