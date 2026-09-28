-- 0017 — Un formulario público solo si el broker puede leer lo que entra
-- ============================================================================
-- Aicardi contrató únicamente Siniestros. Su `/aicardi/cotizar-hogar` seguía
-- abierto: cualquiera podía dejarle una cotización de hogar, la fila entraba…
-- y nadie de Aicardi podía leerla nunca, porque `cotizaciones_org_select` pide
-- el módulo `comercial`. Un formulario que se traga las consultas es peor que
-- no tener formulario.
--
-- La causa de fondo: `tiene_modulo()` mira la empresa DE QUIEN CONSULTA, y en
-- un formulario público no hay quién consulte. Hacía falta poder preguntar por
-- una empresa concreta, así que la lógica se muda a `org_tiene_modulo(org,
-- clave)` y `tiene_modulo()` pasa a ser el atajo "para mi empresa".
--
-- ⚠️ ORDEN AL PASAR A PRODUCCIÓN: igual que la 0012, esta va DESPUÉS de
-- desplegar el código. Las páginas nuevas preguntan por `modulos` antes de
-- dibujar el formulario; las viejas no, y entre una cosa y la otra un visitante
-- vería el error de la policy en vez del aviso.
-- ============================================================================

-- ─── A. La pregunta, por empresa ────────────────────────────────────────────
-- Mismo criterio de siempre: la excepción por empresa manda sobre el plan.
create or replace function public.org_tiene_modulo(p_org uuid, p_clave text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_org is null then false
    when exists (select 1 from public.org_modulos om
                  where om.org_id = p_org and om.modulo_clave = p_clave)
      then (select om.habilitado from public.org_modulos om
             where om.org_id = p_org and om.modulo_clave = p_clave)
    else exists (
      select 1 from public.suscripciones s
        join public.plan_modulos pm on pm.plan_id = s.plan_id
       where s.org_id = p_org
         and s.estado = 'activa'
         and (s.hasta is null or s.hasta >= current_date)
         and pm.modulo_clave = p_clave)
  end;
$$;
revoke execute on function public.org_tiene_modulo(uuid, text) from public;
-- `anon` la necesita: es la que decide si el formulario público existe.
grant  execute on function public.org_tiene_modulo(uuid, text) to anon, authenticated;

-- Un solo lugar donde vive la regla.
create or replace function public.tiene_modulo(p_clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_tiene_modulo((select public.org_actual()), p_clave);
$$;
revoke execute on function public.tiene_modulo(text) from public, anon;
grant  execute on function public.tiene_modulo(text) to authenticated;

-- ─── B. Qué formularios públicos acepta cada empresa ────────────────────────
-- La página pública ya pedía nombre y marca; ahora se lleva también la lista de
-- módulos de cara al público, para avisar en castellano en vez de estrellarse
-- contra una policy. Solo esos dos: el resto no tiene página pública y no es
-- asunto de un visitante.
drop function if exists public.org_publica(text);
create or replace function public.org_publica(p_slug text default null)
returns table (id uuid, nombre text, slug text, marca jsonb, modulos text[])
language sql stable security definer set search_path = public as $$
  select o.id, o.nombre, o.slug, o.marca,
         array_remove(array[
           case when public.org_tiene_modulo(o.id, 'siniestros') then 'siniestros' end,
           case when public.org_tiene_modulo(o.id, 'comercial')  then 'comercial'  end
         ], null)
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

-- ─── C. La base también lo frena ────────────────────────────────────────────
-- Esconder el formulario no alcanza: quien conozca la dirección de la API
-- puede insertar igual. La policy es la que decide de verdad.
drop policy if exists solicitudes_anon_insert on public.solicitudes;
create policy solicitudes_anon_insert on public.solicitudes for insert to anon
  with check (public.org_recibe_publico(org_id)
              and public.org_tiene_modulo(org_id, 'siniestros'));

drop policy if exists cotizaciones_anon_insert on public.cotizaciones;
create policy cotizaciones_anon_insert on public.cotizaciones for insert to anon
  with check (public.org_recibe_publico(org_id)
              and public.org_tiene_modulo(org_id, 'comercial'));

comment on function public.org_tiene_modulo(uuid, text) is 'Si una empresa CONCRETA tiene el modulo. La usan los formularios publicos, donde no hay sesion de la cual deducir la empresa.';
