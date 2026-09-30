-- 0015 — El formulario público sin slug, a la empresa correcta
-- ============================================================================
-- `org_publica(null)` (el `/denuncia` de siempre, sin empresa en la ruta)
-- devolvía la empresa MÁS VIEJA, y en la base de test la más vieja es Aicardi,
-- que se creó para probar el aislamiento. O sea: una denuncia de un cliente de
-- Saraceni mostraba la marca de Aicardi. La 0013 ya había arreglado esta misma
-- trampa en `org_defecto()`; acá quedó viva porque la función ordenaba por su
-- cuenta en vez de preguntarle a ella.
--
-- Ahora hay un solo lugar donde se decide cuál es la empresa de casa.
-- De paso: un slug que no existe (alguien escribe mal la dirección) también
-- cae en la empresa de casa, en vez de dejar el formulario a medio resolver.
-- ============================================================================
create or replace function public.org_publica(p_slug text default null)
returns table (id uuid, nombre text, slug text, marca jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.nombre, o.slug, o.marca
    from public.organizaciones o
   where o.estado in ('activa', 'prueba')
     and o.id = coalesce(
           (select x.id from public.organizaciones x
             where x.slug = lower(trim(coalesce(p_slug, '')))
               and x.estado in ('activa', 'prueba')),
           public.org_defecto());
$$;
revoke execute on function public.org_publica(text) from public;
grant  execute on function public.org_publica(text) to anon, authenticated;
