-- 0012 — Los archivos de cada empresa, y qué módulos tiene contratada
-- ============================================================================
-- La 0011 aisló las filas. Los archivos seguían compartidos: las policies de
-- `adjuntos` y `solicitudes` decían "cualquier usuario activo", sin mirar de
-- qué empresa era. Un broker podía listar y bajarse las fotos de los siniestros
-- del otro.
--
-- La solución es la misma que ya usa el bucket `marcas`: cada archivo vive en
-- la carpeta de su empresa (`<org_id>/loquesea`) y la policy mira esa carpeta.
--
-- ⚠️ ORDEN AL PASAR A PRODUCCIÓN: esta migración va DESPUÉS de desplegar el
-- código que sube a la carpeta de la empresa. Al revés, el portal seguiría
-- subiendo a la raíz y la policy nueva le rebotaría cada archivo.
--
-- Los archivos que ya están subidos se quedan donde están: moverlos es una
-- operación de la API de storage (no un update de SQL), y las rutas viejas
-- están escritas adentro de cada siniestro. Por eso `archivo_de_mi_org` los
-- deja en manos de la empresa original, que es de quien son.
-- ============================================================================

-- ¿Este archivo es de mi empresa? Un archivo en `<uuid>/…` es de esa empresa;
-- uno sin carpeta es de los viejos, o sea del broker original.
create or replace function public.archivo_de_mi_org(p_name text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-' then
      (storage.foldername(p_name))[1] = (select public.org_actual())::text
    else
      (select public.org_actual()) = (select public.org_defecto())
  end;
$$;
revoke execute on function public.archivo_de_mi_org(text) from public, anon;
grant  execute on function public.archivo_de_mi_org(text) to authenticated;

-- Para el formulario público, que sube sin sesión: la carpeta tiene que ser el
-- id de una empresa que exista y esté en pie. El cast va en un bloque aparte
-- porque un texto que no es uuid revienta la consulta entera.
create or replace function public.org_carpeta_valida(p_carpeta text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  if p_carpeta is null then return false; end if;
  begin
    v := p_carpeta::uuid;
  exception when others then
    return false;
  end;
  return public.org_recibe_publico(v);
end $$;
revoke execute on function public.org_carpeta_valida(text) from public;
grant  execute on function public.org_carpeta_valida(text) to anon, authenticated;

-- ─── adjuntos (fotos y PDF de los siniestros) ───────────────────────────────
-- Estaba con un `for all` que solo pedía estar activo. Se reemplaza por los
-- cuatro comandos: al cambiar un `for all` es fácil olvidarse uno.
drop policy if exists adjuntos_activo_all on storage.objects;
create policy adjuntos_org_select on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and public.es_activo() and public.archivo_de_mi_org(name));
create policy adjuntos_org_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and public.es_activo()
              and (storage.foldername(name))[1] = (select public.org_actual())::text);
create policy adjuntos_org_update on storage.objects for update to authenticated
  using (bucket_id = 'adjuntos' and public.es_activo() and public.archivo_de_mi_org(name))
  with check (bucket_id = 'adjuntos' and public.es_activo() and public.archivo_de_mi_org(name));
create policy adjuntos_org_delete on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and public.es_activo() and public.archivo_de_mi_org(name));

-- ─── solicitudes (lo que adjunta el asegurado en la denuncia web) ───────────
drop policy if exists solicitudes_files_activo_all  on storage.objects;
drop policy if exists solicitudes_files_anon_insert on storage.objects;
create policy solicitudes_files_org_select on storage.objects for select to authenticated
  using (bucket_id = 'solicitudes' and public.es_activo() and public.archivo_de_mi_org(name));
create policy solicitudes_files_org_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'solicitudes' and public.es_activo()
              and (storage.foldername(name))[1] = (select public.org_actual())::text);
create policy solicitudes_files_org_delete on storage.objects for delete to authenticated
  using (bucket_id = 'solicitudes' and public.es_activo() and public.archivo_de_mi_org(name));
-- Sin sesión se puede dejar un archivo, pero solo dentro de la carpeta de una
-- empresa real. Leer, nunca: no hay policy de select para anon.
create policy solicitudes_files_anon_insert on storage.objects for insert to anon
  with check (bucket_id = 'solicitudes'
              and public.org_carpeta_valida((storage.foldername(name))[1]));

-- ─── Qué módulos tiene mi empresa ───────────────────────────────────────────
-- El menú necesita la lista entera de una; preguntar módulo por módulo son seis
-- viajes a la base cada vez que alguien entra.
create or replace function public.mis_modulos() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(m.clave order by m.orden), '{}')
    from public.modulos m
   where m.activo and public.tiene_modulo(m.clave);
$$;
revoke execute on function public.mis_modulos() from public, anon;
grant  execute on function public.mis_modulos() to authenticated;

comment on function public.archivo_de_mi_org(text) is 'Un archivo en <org_id>/… es de esa empresa; uno sin carpeta es de los viejos, o sea del broker original.';
