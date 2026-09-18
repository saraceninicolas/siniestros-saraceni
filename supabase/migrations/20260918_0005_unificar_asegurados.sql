-- Unificar asegurados duplicados + enganchar lo que ya estaba cargado
-- ============================================================================
-- La migración anterior evita duplicados NUEVOS. Faltan dos cosas:
--   · Los 26 siniestros que ya existen no tienen ficha (nunca se pidió el
--     documento), así que hay que crearlas a partir del nombre.
--   · Los duplicados que queden hay que poder unificarlos a mano.
--
-- Por qué la unificación no puede ser automática: fusionar dos personas les
-- mezcla la siniestralidad, y separarlas después es trabajo manual. Acá el
-- que decide es siempre un organizador.
-- ============================================================================

-- ─── Unificar dos fichas ────────────────────────────────────────────────────
-- Todo lo que colgaba de `id_absorbido` pasa a `id_final`, y la absorbida se
-- borra. Es irreversible, por eso solo organizador.
create or replace function public.asegurados_unificar(
  id_final bigint, id_absorbido bigint, p_quien text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_a record; v_b record; v_nota text;
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede unificar asegurados' using errcode = '42501';
  end if;
  if id_final = id_absorbido then
    raise exception 'Son la misma ficha';
  end if;

  select * into v_a from public.asegurados where id = id_final;
  if not found then raise exception 'No existe la ficha %', id_final; end if;
  select * into v_b from public.asegurados where id = id_absorbido;
  if not found then raise exception 'No existe la ficha %', id_absorbido; end if;

  -- Nada se pierde en silencio: lo de la ficha absorbida que no se puede
  -- conservar queda escrito en las notas de la que sobrevive.
  v_nota := coalesce(v_a.notas || E'\n', '')
    || 'Unificada con "' || v_b.nombre || '"'
    || case when v_b.documento is not null and v_b.documento_norm is distinct from v_a.documento_norm
            then ' · documento que traía: ' || v_b.documento else '' end
    || ' · ' || to_char(now(), 'DD/MM/YYYY')
    || case when p_quien is not null then ' por ' || p_quien else '' end;

  update public.asegurados
     set documento = coalesce(documento, v_b.documento),
         email     = coalesce(email, v_b.email),
         telefono  = coalesce(telefono, v_b.telefono),
         notas     = v_nota,
         updated_at = now()
   where id = id_final;

  update public.siniestros  set asegurado_id = id_final where asegurado_id = id_absorbido;
  update public.solicitudes set asegurado_id = id_final where asegurado_id = id_absorbido;

  -- El par que se resolvió queda marcado; los demás pares que mencionaban a la
  -- absorbida se van con ella (la FK es on delete cascade).
  update public.asegurados_duplicados
     set estado = 'unificados', resuelto_por = p_quien
   where (a_id = least(id_final, id_absorbido) and b_id = greatest(id_final, id_absorbido));

  delete from public.asegurados where id = id_absorbido;
  return id_final;
end $$;

revoke execute on function public.asegurados_unificar(bigint,bigint,text) from public, anon;
grant  execute on function public.asegurados_unificar(bigint,bigint,text) to authenticated;

-- ─── Marcar un par como "son personas distintas" ────────────────────────────
-- Para que deje de aparecer en la lista y no vuelva a preguntar.
create or replace function public.asegurados_no_son_duplicados(
  a bigint, b bigint, p_quien text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede resolver duplicados' using errcode = '42501';
  end if;
  insert into public.asegurados_duplicados (a_id, b_id, parecido, estado, resuelto_por)
  values (least(a,b), greatest(a,b), 0, 'distintos', p_quien)
  on conflict (a_id, b_id) do update set estado = 'distintos', resuelto_por = p_quien;
end $$;

revoke execute on function public.asegurados_no_son_duplicados(bigint,bigint,text) from public, anon;
grant  execute on function public.asegurados_no_son_duplicados(bigint,bigint,text) to authenticated;

-- ─── Buscar parecidos entre las fichas que YA existen ───────────────────────
-- `asegurado_buscar_o_crear` solo compara contra lo que hay al momento de
-- crear. Esta recorre todo y encuentra los pares que quedaron de antes.
-- No decide nada: solo llena la lista para revisar.
create or replace function public.asegurados_buscar_parecidos(umbral real default 0.70)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_nuevos integer := 0;
begin
  if not public.es_activo() then
    raise exception 'Sin permisos' using errcode = '42501';
  end if;
  with pares as (
    select a.id as a_id, b.id as b_id, similarity(a.nombre_norm, b.nombre_norm) as s
      from public.asegurados a
      join public.asegurados b on a.id < b.id
     where a.nombre_norm is not null and b.nombre_norm is not null
       and a.nombre_norm % b.nombre_norm
       and similarity(a.nombre_norm, b.nombre_norm) >= umbral
       -- Si las dos tienen documento y son distintos, son personas distintas:
       -- el documento manda sobre el parecido del nombre.
       and not (a.documento_norm is not null and b.documento_norm is not null
                and a.documento_norm <> b.documento_norm)
  )
  insert into public.asegurados_duplicados (a_id, b_id, parecido)
  select a_id, b_id, round(s::numeric, 3) from pares
  on conflict (a_id, b_id) do nothing;
  get diagnostics v_nuevos = row_count;
  return v_nuevos;
end $$;

revoke execute on function public.asegurados_buscar_parecidos(real) from public, anon;
grant  execute on function public.asegurados_buscar_parecidos(real) to authenticated;

-- ─── Enganchar los siniestros que ya estaban cargados ───────────────────────
-- Crea una ficha por cada `cliente` distinto y le cuelga sus siniestros. Como
-- los siniestros viejos no tienen documento, el único criterio posible es el
-- nombre normalizado: "YEL INFORMATICA SRL" y "YEL INFORMÁTICA SRL" quedan
-- juntos, y "YEL INFORMATICA" queda aparte para revisar.
--
-- `solo_simular` en true NO escribe nada: devuelve lo que haría. Conviene
-- mirarlo antes, porque después revertirlo es a mano.
create or replace function public.asegurados_enganchar_siniestros(solo_simular boolean default true)
returns table (nombre_ficha text, siniestros bigint, nombres_que_agrupa text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede hacer esto' using errcode = '42501';
  end if;

  if solo_simular then
    return query
      select min(s.cliente) as nombre_ficha,
             count(*) as siniestros,
             string_agg(distinct s.cliente, ' | ') as nombres_que_agrupa
        from public.siniestros s
       where not s.eliminado and s.asegurado_id is null and s.cliente is not null
       group by public.nombre_normalizado(s.cliente)
       order by count(*) desc, 1;
    return;
  end if;

  -- Una ficha por nombre normalizado, y se le cuelgan todos sus siniestros.
  insert into public.asegurados (nombre)
  select distinct on (public.nombre_normalizado(s.cliente)) s.cliente
    from public.siniestros s
   where not s.eliminado and s.asegurado_id is null and s.cliente is not null
     and public.nombre_normalizado(s.cliente) is not null
     and not exists (
       select 1 from public.asegurados a
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
