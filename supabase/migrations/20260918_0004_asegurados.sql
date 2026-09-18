-- Asegurados: una ficha por persona, para poder medir siniestralidad
-- ============================================================================
-- POR QUÉ HAY DUPLICADOS HOY
-- `siniestros` solo tiene `cliente`, un texto libre con el nombre. Nunca se
-- pidió un documento, así que el mismo cliente entra distinto cada vez. En la
-- base real ya conviven "YEL INFORMATICA SRL", "YEL INFORMÁTICA SRL" y
-- "YEL INFORMATICA": tres registros, un cliente.
--
-- El arreglo de fondo no es el algoritmo de comparación: es pedir el documento.
-- Lo que sigue resuelve las dos mitades.
--
-- CÓMO SE EVITA LA DUPLICACIÓN
--   1. El documento se guarda COMO LO CARGARON (`documento`) y además
--      normalizado (`documento_norm`). El normalizado es único: dos fichas no
--      pueden compartirlo, así que el duplicado se vuelve imposible por
--      estructura, no por disciplina.
--   2. La normalización saca puntos y guiones, corrige los tipeos clásicos
--      (O por cero, I/L por uno) y —lo que más rinde— extrae el DNI de adentro
--      del CUIT: 20-33344455-9 y 33.344.455 son la misma persona.
--   3. Lo que NO coincide por documento pero sí se parece por nombre no se
--      fusiona: va a `asegurados_duplicados` para que un organizador decida.
--      Fusionar a dos personas distintas les mezcla la siniestralidad y
--      deshacerlo es trabajo manual.
--
-- EL DÍA QUE LLEGUEN LAS APIS DE LAS COMPAÑÍAS
-- `documento` guarda siempre el original sin tocar, y quedan `id_externo` y
-- `fuente` libres para el identificador que mande la compañía, que va a pasar
-- a ser la autoridad. Nada de lo que se cargue ahora se pierde ni estorba.
-- ============================================================================

create extension if not exists pg_trgm;

-- ─── Normalizadores ─────────────────────────────────────────────────────────
-- Tienen que ser IMMUTABLE porque se usan en columnas generadas y en índices.
-- Por eso las tildes se sacan con translate() y no con unaccent(): unaccent
-- depende de un diccionario instalable, así que Postgres la considera STABLE
-- y rechaza el create table.

create or replace function public.doc_normalizado(txt text) returns text
language sql immutable parallel safe as $$
  with limpio as (
    select regexp_replace(translate(upper(coalesce(txt,'')), 'OIL', '011'), '[^0-9]', '', 'g') as d
  )
  select case
           -- Un CUIT/CUIL argentino es XX-DDDDDDDD-V: adentro lleva el DNI.
           when length(d) = 11 then ltrim(substr(d, 3, 8), '0')
           when length(d) between 6 and 9 then ltrim(d, '0')
           else nullif(d, '')
         end
  from limpio;
$$;

create or replace function public.nombre_normalizado(txt text) returns text
language sql immutable parallel safe as $$
  select nullif(array_to_string(array(
    select p from unnest(string_to_array(
      regexp_replace(
        translate(upper(coalesce(txt,'')),
                  'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÇ', 'AEIOUUNAEIOUAEIOUC'),
        '[^A-Z0-9 ]', ' ', 'g'), ' ')) as p
    where p <> '' order by p), ' '), '');
$$;

-- El último dígito del CUIT se calcula con los otros diez: un CUIT mal tipeado
-- se detecta solo, sin compararlo contra nada. Devuelve null si no son 11
-- dígitos (o sea: "no opino, esto no es un CUIT").
create or replace function public.cuit_valido(txt text) returns boolean
language plpgsql immutable parallel safe as $$
declare d text; pesos int[] := array[5,4,3,2,7,6,5,4,3,2]; suma int := 0; i int; v int;
begin
  d := regexp_replace(coalesce(txt,''), '[^0-9]', '', 'g');
  if length(d) <> 11 then return null; end if;
  for i in 1..10 loop suma := suma + substr(d,i,1)::int * pesos[i]; end loop;
  v := 11 - (suma % 11);
  if v = 11 then v := 0; elsif v = 10 then v := 9; end if;
  return v = substr(d,11,1)::int;
end $$;

-- ─── Ficha del asegurado ────────────────────────────────────────────────────
create table if not exists public.asegurados (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  nombre_norm text generated always as (public.nombre_normalizado(nombre)) stored,
  documento   text,                                   -- tal cual lo cargaron
  documento_norm text generated always as (public.doc_normalizado(documento)) stored,
  email       text,
  telefono    text,
  notas       text,
  -- Para cuando lleguen las APIs de las compañías
  id_externo  text,
  fuente      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- La pieza que hace imposible el duplicado: dos fichas no pueden compartir
-- documento. Los null no chocan entre sí, así que un asegurado sin documento
-- cargado sigue siendo válido.
create unique index if not exists asegurados_doc_unico
  on public.asegurados (documento_norm) where documento_norm is not null;
-- Para buscar por nombre parecido sin recorrer la tabla entera.
create index if not exists asegurados_nombre_trgm
  on public.asegurados using gin (nombre_norm gin_trgm_ops);

-- ─── Enganche con lo que ya existe ──────────────────────────────────────────
alter table public.siniestros
  add column if not exists asegurado_id bigint references public.asegurados(id) on delete set null,
  add column if not exists cliente_doc  text;   -- documento cargado en el siniestro
alter table public.solicitudes
  add column if not exists asegurado_id bigint references public.asegurados(id) on delete set null;

create index if not exists siniestros_asegurado_idx on public.siniestros (asegurado_id);

-- ─── Cola de posibles duplicados ────────────────────────────────────────────
-- Lo que se parece pero no coincide por documento no se fusiona solo.
create table if not exists public.asegurados_duplicados (
  id         bigint generated always as identity primary key,
  a_id       bigint not null references public.asegurados(id) on delete cascade,
  b_id       bigint not null references public.asegurados(id) on delete cascade,
  parecido   numeric(4,3) not null,
  estado     text not null default 'pendiente' check (estado in ('pendiente','unificados','distintos')),
  resuelto_por text,
  created_at timestamptz not null default now(),
  -- El par (a,b) es el mismo que (b,a): se guarda siempre con el menor primero
  -- para que no entre dos veces.
  constraint dup_ordenado check (a_id < b_id),
  constraint dup_unico unique (a_id, b_id)
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Operativa: los asegurados los usa cualquier activo (carga siniestros).
-- La baja definitiva y resolver duplicados, solo organizador.
alter table public.asegurados enable row level security;
alter table public.asegurados_duplicados enable row level security;

drop policy if exists asegurados_activo_select on public.asegurados;
drop policy if exists asegurados_activo_insert on public.asegurados;
drop policy if exists asegurados_activo_update on public.asegurados;
drop policy if exists asegurados_org_delete    on public.asegurados;
create policy asegurados_activo_select on public.asegurados for select to authenticated using (public.es_activo());
create policy asegurados_activo_insert on public.asegurados for insert to authenticated with check (public.es_activo());
create policy asegurados_activo_update on public.asegurados for update to authenticated using (public.es_activo()) with check (public.es_activo());
create policy asegurados_org_delete    on public.asegurados for delete to authenticated using (public.es_organizador());

drop policy if exists dup_activo_select on public.asegurados_duplicados;
drop policy if exists dup_org_insert    on public.asegurados_duplicados;
drop policy if exists dup_org_update    on public.asegurados_duplicados;
drop policy if exists dup_org_delete    on public.asegurados_duplicados;
create policy dup_activo_select on public.asegurados_duplicados for select to authenticated using (public.es_activo());
create policy dup_org_insert    on public.asegurados_duplicados for insert to authenticated with check (public.es_activo());
create policy dup_org_update    on public.asegurados_duplicados for update to authenticated using (public.es_organizador()) with check (public.es_organizador());
create policy dup_org_delete    on public.asegurados_duplicados for delete to authenticated using (public.es_organizador());

-- ─── Buscar o crear: el único punto de entrada ──────────────────────────────
-- En vez de insertar a ciegas, busca primero y reusa. Devuelve el id, y de paso
-- anota los posibles duplicados por nombre para que los revise un organizador.
--
-- Es `security definer` (se saltea RLS), así que chequea es_activo() a mano:
-- sin eso, una cuenta recién creada —que está en estado 'pendiente' y no
-- debería poder tocar nada— igual podía crear asegurados.
create or replace function public.asegurado_buscar_o_crear(
  p_nombre text, p_documento text default null,
  p_email text default null, p_telefono text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_doc text := public.doc_normalizado(p_documento);
  v_nom text := public.nombre_normalizado(p_nombre);
  v_id  bigint;
  r     record;
begin
  if not public.es_activo() then
    raise exception 'Sin permisos' using errcode = '42501';
  end if;
  if v_nom is null and v_doc is null then
    raise exception 'Hace falta al menos el nombre o el documento';
  end if;

  -- 1. Por documento: la única coincidencia en la que confiamos para unir sola.
  if v_doc is not null then
    select id into v_id from public.asegurados where documento_norm = v_doc;
    if found then
      -- Completa lo que falte sin pisar lo que ya había cargado alguien.
      update public.asegurados
         set email = coalesce(email, nullif(p_email,'')),
             telefono = coalesce(telefono, nullif(p_telefono,'')),
             updated_at = now()
       where id = v_id;
      return v_id;
    end if;
  end if;

  -- 2. Sin documento, el nombre exacto ya normalizado alcanza: no hay otra cosa
  --    con qué distinguirlos, y crear una ficha por cada vez que se escribe
  --    igual es justamente el problema que vinimos a resolver.
  if v_doc is null and v_nom is not null then
    select id into v_id from public.asegurados
     where nombre_norm = v_nom and documento_norm is null;
    if found then return v_id; end if;
  end if;

  insert into public.asegurados (nombre, documento, email, telefono)
  values (p_nombre, nullif(p_documento,''), nullif(p_email,''), nullif(p_telefono,''))
  returning id into v_id;

  -- 3. Lo parecido NO se une: se anota para que lo mire un humano.
  if v_nom is not null then
    for r in
      select id, similarity(nombre_norm, v_nom) as s
        from public.asegurados
       where id <> v_id and nombre_norm % v_nom and similarity(nombre_norm, v_nom) >= 0.70
    loop
      insert into public.asegurados_duplicados (a_id, b_id, parecido)
      values (least(v_id, r.id), greatest(v_id, r.id), round(r.s::numeric, 3))
      on conflict (a_id, b_id) do nothing;
    end loop;
  end if;

  return v_id;
end $$;

revoke execute on function public.asegurado_buscar_o_crear(text,text,text,text) from public, anon;
grant execute on function public.asegurado_buscar_o_crear(text,text,text,text) to authenticated;
