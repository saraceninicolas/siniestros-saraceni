-- 0016 — Que el formulario público pueda seguir escribiendo
-- ============================================================================
-- La 0011 le puso a `solicitudes` y `cotizaciones` el default
-- `coalesce(org_actual(), org_defecto())`. Se ve razonable y rompe la denuncia
-- pública: `org_actual()` está revocada para `anon` desde la 0009, y el default
-- de una columna se evalúa CON LOS PERMISOS DE QUIEN INSERTA. Resultado:
--
--   permission denied for function org_actual
--
-- o sea, un asegurado no podía denunciar. Es el mismo accidente que ya nos pasó
-- una vez con la policy de insert que faltaba, y lo volvió a encontrar el test
-- automático (`npm test`), no una lectura del SQL.
--
-- La solución no es abrirle `org_actual()` a `anon` —no tiene por qué poder
-- preguntar por membresías— sino envolver la decisión en una función propia,
-- SECURITY DEFINER, que es lo único que el default necesita ejecutar.
-- ============================================================================
create or replace function public.org_de_la_carga() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(public.org_actual(), public.org_defecto());
$$;
revoke execute on function public.org_de_la_carga() from public;
grant  execute on function public.org_de_la_carga() to anon, authenticated;

alter table public.solicitudes  alter column org_id set default public.org_de_la_carga();
alter table public.cotizaciones alter column org_id set default public.org_de_la_carga();

comment on function public.org_de_la_carga() is 'De quién es lo que se está cargando: la empresa de quien escribe, o la de casa si no hay sesión (formulario público).';
