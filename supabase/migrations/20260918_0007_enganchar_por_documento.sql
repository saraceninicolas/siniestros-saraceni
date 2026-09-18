-- El enganche de siniestros viejos tiene que usar el documento si lo hay
-- ============================================================================
-- La versión de la migración 0005 agrupaba solo por nombre e ignoraba
-- `cliente_doc`. Con los siniestros viejos de producción da igual (no tienen
-- documento: la columna es nueva), pero quedaba un hueco:
--
--   Al guardar un siniestro, si enganchar la ficha falla, el siniestro se
--   guarda igual —a propósito: la ficha no puede impedir registrar un
--   siniestro—. Ese siniestro queda con documento y sin ficha. El enganche
--   posterior le creaba una ficha SIN documento, por nombre: un duplicado
--   justo de lo que la ficha con documento hubiera evitado.
--
-- Ahora va en dos pasadas: primero lo que tiene documento (que es lo único que
-- identifica sin ambigüedad), después por nombre lo que no tiene.
-- ============================================================================

create or replace function public.asegurados_enganchar_siniestros(solo_simular boolean default true)
returns table (nombre_ficha text, siniestros bigint, nombres_que_agrupa text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede hacer esto' using errcode = '42501';
  end if;

  if solo_simular then
    -- Misma clave de agrupación que usa la pasada real: documento si lo hay,
    -- nombre si no. Así la simulación muestra exactamente lo que va a pasar.
    return query
      select min(s.cliente),
             count(*),
             string_agg(distinct s.cliente, ' | ')
        from public.siniestros s
       where not s.eliminado and s.asegurado_id is null and s.cliente is not null
       group by coalesce('doc:' || public.doc_normalizado(s.cliente_doc),
                         'nom:' || public.nombre_normalizado(s.cliente))
       order by count(*) desc, 1;
    return;
  end if;

  -- 1. Con documento: una ficha por documento normalizado.
  insert into public.asegurados (nombre, documento)
  select distinct on (public.doc_normalizado(s.cliente_doc)) s.cliente, s.cliente_doc
    from public.siniestros s
   where not s.eliminado and s.asegurado_id is null
     and public.doc_normalizado(s.cliente_doc) is not null
     and not exists (select 1 from public.asegurados a
                      where a.documento_norm = public.doc_normalizado(s.cliente_doc))
   order by public.doc_normalizado(s.cliente_doc), s.ultima_mod_fecha desc;

  update public.siniestros s
     set asegurado_id = a.id
    from public.asegurados a
   where s.asegurado_id is null and not s.eliminado
     and public.doc_normalizado(s.cliente_doc) is not null
     and a.documento_norm = public.doc_normalizado(s.cliente_doc);

  -- 2. Sin documento: por nombre normalizado, como antes.
  insert into public.asegurados (nombre)
  select distinct on (public.nombre_normalizado(s.cliente)) s.cliente
    from public.siniestros s
   where not s.eliminado and s.asegurado_id is null and s.cliente is not null
     and public.nombre_normalizado(s.cliente) is not null
     and not exists (select 1 from public.asegurados a
                      where a.nombre_norm = public.nombre_normalizado(s.cliente))
   order by public.nombre_normalizado(s.cliente), s.cliente;

  update public.siniestros s
     set asegurado_id = a.id
    from public.asegurados a
   where s.asegurado_id is null and not s.eliminado
     and a.nombre_norm = public.nombre_normalizado(s.cliente);

  return query
    select a.nombre, count(s.id), string_agg(distinct s.cliente, ' | ')
      from public.asegurados a
      join public.siniestros s on s.asegurado_id = a.id and not s.eliminado
     group by a.id, a.nombre
     order by count(s.id) desc, a.nombre;
end $$;

revoke execute on function public.asegurados_enganchar_siniestros(boolean) from public, anon;
grant  execute on function public.asegurados_enganchar_siniestros(boolean) to authenticated;
