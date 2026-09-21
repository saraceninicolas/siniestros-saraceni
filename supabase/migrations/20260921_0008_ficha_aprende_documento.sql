-- La ficha elegida por nombre aprende el documento que se carga en el siniestro
-- ============================================================================
-- El enganche de los siniestros viejos (2026-09-21) dejó 20 fichas SIN
-- documento: los siniestros viejos nunca lo pidieron. Al cargar uno nuevo, lo
-- natural es elegir la ficha de la lista por nombre y escribir el DNI. Hasta
-- acá ese DNI quedaba en el siniestro pero no en la ficha, y el hueco era
-- serio: la próxima vez que alguien escribiera ese DNI, la búsqueda por
-- documento no encontraba nada y se creaba una ficha nueva. Justo el
-- duplicado que todo esto vino a evitar.
--
-- Qué hace:
--   · Si la ficha no tiene documento, lo guarda.
--   · Si ese documento ya es de OTRA ficha, no toca nada y devuelve esa otra:
--     el documento identifica sin ambigüedad, el nombre no. El par queda en la
--     cola de duplicados para que un organizador decida si son la misma.
--   · Si la ficha ya tiene otro documento, no lo pisa: puede ser un error de
--     tipeo en el siniestro, y la ficha es la que manda.
-- ============================================================================

create or replace function public.asegurado_completar_documento(p_id bigint, p_documento text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_doc  text := public.doc_normalizado(p_documento);
  v_otra bigint;
begin
  if not public.es_activo() then
    raise exception 'Sin permisos' using errcode = '42501';
  end if;
  if v_doc is null then return p_id; end if;

  select id into v_otra from public.asegurados
   where documento_norm = v_doc and id <> p_id;
  if found then
    insert into public.asegurados_duplicados (a_id, b_id, parecido)
    select least(p_id, v_otra), greatest(p_id, v_otra),
           round(coalesce(similarity(a.nombre_norm, b.nombre_norm), 0)::numeric, 3)
      from public.asegurados a, public.asegurados b
     where a.id = p_id and b.id = v_otra
    on conflict (a_id, b_id) do nothing;
    return v_otra;
  end if;

  update public.asegurados
     set documento = p_documento, updated_at = now()
   where id = p_id and documento_norm is null;
  return p_id;
end $$;

revoke execute on function public.asegurado_completar_documento(bigint, text) from public, anon;
grant  execute on function public.asegurado_completar_documento(bigint, text) to authenticated;
