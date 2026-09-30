-- 0011 — La columna de dueño en las tablas del portal
-- ============================================================================
-- Esta es la migración que permite que dos brokers convivan en la misma base
-- sin verse. Hasta acá `organizaciones` y `membresias` existían (0009) pero las
-- tablas del portal no sabían de quién era cada fila: cualquier usuario activo
-- veía TODOS los siniestros.
--
-- Qué hace, en orden:
--   A. Da de alta la empresa de siempre y convierte a los usuarios existentes
--      en miembros suyos (si ya están, no toca nada).
--   B. Agrega `org_id` a las diez tablas del portal, la llena con esa empresa,
--      la vuelve obligatoria y le pone de default `org_actual()`. Así el portal
--      sigue insertando igual que siempre: el dueño lo pone la base.
--   C. Las unicidades que eran globales pasan a ser por empresa. Dos brokers
--      pueden tener al mismo asegurado, y el código STR-01 de uno no tiene por
--      qué chocar con el del otro.
--   D. Reescribe las policies: cada consulta se limita a la empresa de quien
--      pregunta, y los módulos se exigen acá, no escondiendo el menú.
--   E. Arregla dos fugas que no estaban a la vista:
--      · las funciones de asegurados (buscar por documento, parecidos,
--        unificar) son SECURITY DEFINER, o sea que se saltean las policies:
--        buscaban en las fichas de TODAS las empresas;
--      · el aviso de "nueva denuncia web" se lo mandaba a todos los
--        organizadores de la base, de cualquier empresa.
--   F. `perfiles` deja de ser una guía telefónica compartida: cada uno ve a los
--      de su empresa. Y el alta de una cuenta nueva ya crea su membresía.
--
-- Lo que NO toca:
--   · `notificaciones` ya está aislada por `usuario_id`.
--   · Los archivos de `adjuntos` y `solicitudes`: eso es la 0012, porque
--     requiere que el código suba a la carpeta de cada empresa.
-- ============================================================================

-- ─── A. La empresa de siempre y sus miembros ────────────────────────────────
-- Idempotente: en test ya existen y no se toca nada; en producción se crean.
insert into public.organizaciones (nombre, slug, estado)
values ('Saraceni Broker de Seguros', 'saraceni', 'activa')
on conflict (slug) do nothing;

-- La empresa por defecto es la más vieja: la que ya estaba cuando el portal
-- era de un solo broker. La usan los formularios públicos que todavía no
-- dicen de qué empresa son, y los archivos subidos antes de la 0012.
create or replace function public.org_defecto() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.organizaciones
   where estado in ('activa', 'prueba')
   order by created_at, id
   limit 1;
$$;
revoke execute on function public.org_defecto() from public;
grant  execute on function public.org_defecto() to authenticated, anon;

-- ¿Esta empresa existe y está en pie? La usan las policies de los formularios
-- públicos, que escriben sin sesión y no pueden leer `organizaciones`.
create or replace function public.org_recibe_publico(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizaciones o
                  where o.id = p_org and o.estado in ('activa', 'prueba'));
$$;
revoke execute on function public.org_recibe_publico(uuid) from public;
grant  execute on function public.org_recibe_publico(uuid) to anon, authenticated;

-- Lo que una página pública necesita saber de la empresa a la que le escribe:
-- su id, su nombre y su marca (el logo y los colores del formulario). Nada de
-- eso es secreto. Sin slug devuelve la empresa original, para que el
-- `/denuncia` de siempre siga andando.
create or replace function public.org_publica(p_slug text default null)
returns table (id uuid, nombre text, slug text, marca jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.nombre, o.slug, o.marca
    from public.organizaciones o
   where o.estado in ('activa', 'prueba')
     and (nullif(trim(coalesce(p_slug, '')), '') is null or o.slug = lower(trim(p_slug)))
   order by case when o.slug = lower(trim(coalesce(p_slug, ''))) then 0 else 1 end, o.created_at
   limit 1;
$$;
revoke execute on function public.org_publica(text) from public;
grant  execute on function public.org_publica(text) to anon, authenticated;

-- Los usuarios que ya existen pasan a ser miembros de esa empresa, con el mismo
-- rol y estado que tenían. `perfiles` sigue mandando para los permisos; la
-- membresía es la que dice de qué empresa es cada uno.
insert into public.membresias (usuario_id, org_id, rol, estado)
select p.id,
       (select id from public.organizaciones where slug = 'saraceni'),
       case when p.rol = 'organizador' then 'organizador' else 'empleado' end,
       case when p.estado = 'activo' then 'activo'
            when p.estado = 'pendiente' then 'pendiente'
            else 'suspendido' end
  from public.perfiles p
on conflict (usuario_id, org_id) do nothing;

-- Y su contrato, para que `tiene_modulo()` le devuelva verdadero a todo: el
-- broker de casa usa el portal entero.
insert into public.suscripciones (org_id, plan_id, estado)
select o.id, pl.id, 'activa'
  from public.organizaciones o, public.planes pl
 where o.slug = 'saraceni' and pl.nombre = 'Full'
   and not exists (select 1 from public.suscripciones s where s.org_id = o.id);

-- ─── B. La columna de dueño ─────────────────────────────────────────────────
do $$
declare
  v_sar uuid := (select id from public.organizaciones where slug = 'saraceni');
  t     text;
begin
  if v_sar is null then
    raise exception 'No se pudo crear ni encontrar la empresa saraceni';
  end if;

  foreach t in array array['siniestros', 'solicitudes', 'asegurados', 'asegurados_duplicados',
                           'pendientes', 'renovaciones', 'cotizaciones', 'objetivos',
                           'fact_mensual', 'fact_companias']
  loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizaciones(id) on delete restrict', t);
    execute format('update public.%I set org_id = %L where org_id is null', t, v_sar);
    execute format('alter table public.%I alter column org_id set not null', t);
    execute format('create index if not exists %I on public.%I (org_id)', t || '_org_idx', t);
  end loop;
end $$;

-- El default. En las tablas del portal alcanza con la empresa de quien escribe.
alter table public.siniestros            alter column org_id set default public.org_actual();
alter table public.asegurados            alter column org_id set default public.org_actual();
alter table public.asegurados_duplicados alter column org_id set default public.org_actual();
alter table public.pendientes            alter column org_id set default public.org_actual();
alter table public.renovaciones          alter column org_id set default public.org_actual();
alter table public.objetivos             alter column org_id set default public.org_actual();
alter table public.fact_mensual          alter column org_id set default public.org_actual();
alter table public.fact_companias        alter column org_id set default public.org_actual();

-- Las dos que reciben cargas públicas son distintas: quien completa el
-- formulario no tiene sesión, así que `org_actual()` es nulo. Hasta que cada
-- página diga de qué empresa es, la denuncia cae en la empresa original. Nunca
-- en la del cliente nuevo: el que no dice nada, es el de casa.
alter table public.solicitudes  alter column org_id set default coalesce(public.org_actual(), public.org_defecto());
alter table public.cotizaciones alter column org_id set default coalesce(public.org_actual(), public.org_defecto());

-- ─── C. Unicidades por empresa ──────────────────────────────────────────────
-- Un documento es único DENTRO de un broker. Dos brokers pueden atender al
-- mismo asegurado, y hasta al mismo siniestro desde los dos lados.
drop index if exists public.asegurados_doc_unico;
create unique index asegurados_doc_unico
  on public.asegurados (org_id, documento_norm) where documento_norm is not null;

-- Los códigos visibles (STR-01-xxxx, PEN-…, REN-…, OBJ-…) los arma el portal de
-- cada broker sin saber de los demás: chocarían seguro.
alter table public.siniestros   drop constraint if exists siniestros_codigo_key;
alter table public.pendientes   drop constraint if exists pendientes_codigo_key;
alter table public.renovaciones drop constraint if exists renovaciones_codigo_key;
alter table public.objetivos    drop constraint if exists objetivos_codigo_key;
create unique index if not exists siniestros_codigo_unico   on public.siniestros   (org_id, codigo);
create unique index if not exists pendientes_codigo_unico   on public.pendientes   (org_id, codigo);
create unique index if not exists renovaciones_codigo_unico on public.renovaciones (org_id, codigo);
create unique index if not exists objetivos_codigo_unico    on public.objetivos    (org_id, codigo);

-- La misma compañía (Sancor, La Mercantil) la carga cada broker en su lista.
alter table public.fact_companias drop constraint if exists fact_companias_cuit_key;
create unique index if not exists fact_companias_cuit_unico
  on public.fact_companias (org_id, cuit) where cuit is not null;

-- ─── D. Policies ────────────────────────────────────────────────────────────
-- Patrón: `org_id = (select org_actual())` + el módulo contratado. El `(select …)`
-- hace que Postgres evalúe la función una vez por consulta y no una por fila.
-- Borrar sigue siendo cosa del organizador.

-- siniestros
drop policy if exists siniestros_activo_select on public.siniestros;
drop policy if exists siniestros_activo_insert on public.siniestros;
drop policy if exists siniestros_activo_update on public.siniestros;
drop policy if exists siniestros_org_delete    on public.siniestros;
create policy siniestros_org_select on public.siniestros for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy siniestros_org_insert on public.siniestros for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy siniestros_org_update on public.siniestros for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'))
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy siniestros_org_borra on public.siniestros for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

-- asegurados
drop policy if exists asegurados_activo_select on public.asegurados;
drop policy if exists asegurados_activo_insert on public.asegurados;
drop policy if exists asegurados_activo_update on public.asegurados;
drop policy if exists asegurados_org_delete    on public.asegurados;
create policy asegurados_org_select on public.asegurados for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy asegurados_org_insert on public.asegurados for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy asegurados_org_update on public.asegurados for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'))
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy asegurados_org_borra on public.asegurados for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

-- asegurados_duplicados
drop policy if exists dup_activo_select on public.asegurados_duplicados;
drop policy if exists dup_org_insert    on public.asegurados_duplicados;
drop policy if exists dup_org_update    on public.asegurados_duplicados;
drop policy if exists dup_org_delete    on public.asegurados_duplicados;
create policy dup_org_select on public.asegurados_duplicados for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy dup_org_insert on public.asegurados_duplicados for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo());
create policy dup_org_update on public.asegurados_duplicados for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador())
  with check (org_id = (select public.org_actual()) and public.es_organizador());
create policy dup_org_borra on public.asegurados_duplicados for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

-- solicitudes (las denuncias del formulario público)
drop policy if exists solicitudes_activo_select on public.solicitudes;
drop policy if exists solicitudes_activo_insert on public.solicitudes;
drop policy if exists solicitudes_activo_update on public.solicitudes;
drop policy if exists solicitudes_org_delete    on public.solicitudes;
drop policy if exists solicitudes_anon_insert   on public.solicitudes;
create policy solicitudes_org_select on public.solicitudes for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy solicitudes_org_insert on public.solicitudes for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo());
create policy solicitudes_org_update on public.solicitudes for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'))
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('siniestros'));
create policy solicitudes_org_borra on public.solicitudes for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());
-- Sin sesión se puede escribir una denuncia, pero solo a una empresa que exista
-- y esté en pie. Leer, jamás: no hay policy de select para anon.
create policy solicitudes_anon_insert on public.solicitudes for insert to anon
  with check (public.org_recibe_publico(org_id));

-- cotizaciones (el formulario público de hogar)
drop policy if exists cotizaciones_activo_select on public.cotizaciones;
drop policy if exists cotizaciones_activo_insert on public.cotizaciones;
drop policy if exists cotizaciones_activo_update on public.cotizaciones;
drop policy if exists cotizaciones_org_delete    on public.cotizaciones;
drop policy if exists cotizaciones_anon_insert   on public.cotizaciones;
create policy cotizaciones_org_select on public.cotizaciones for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('comercial'));
create policy cotizaciones_org_insert on public.cotizaciones for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo());
create policy cotizaciones_org_update on public.cotizaciones for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('comercial'))
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('comercial'));
create policy cotizaciones_org_borra on public.cotizaciones for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());
create policy cotizaciones_anon_insert on public.cotizaciones for insert to anon
  with check (public.org_recibe_publico(org_id));

-- pendientes
drop policy if exists pendientes_activo_select on public.pendientes;
drop policy if exists pendientes_activo_insert on public.pendientes;
drop policy if exists pendientes_activo_update on public.pendientes;
drop policy if exists pendientes_org_delete    on public.pendientes;
create policy pendientes_org_select on public.pendientes for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('pendientes'));
create policy pendientes_org_insert on public.pendientes for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('pendientes'));
create policy pendientes_org_update on public.pendientes for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('pendientes'))
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('pendientes'));
create policy pendientes_org_borra on public.pendientes for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

-- renovaciones
drop policy if exists renovaciones_activo_select on public.renovaciones;
drop policy if exists renovaciones_activo_insert on public.renovaciones;
drop policy if exists renovaciones_activo_update on public.renovaciones;
drop policy if exists renovaciones_org_delete    on public.renovaciones;
create policy renovaciones_org_select on public.renovaciones for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('renovaciones'));
create policy renovaciones_org_insert on public.renovaciones for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('renovaciones'));
create policy renovaciones_org_update on public.renovaciones for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('renovaciones'))
  with check (org_id = (select public.org_actual()) and public.es_activo() and public.tiene_modulo('renovaciones'));
create policy renovaciones_org_borra on public.renovaciones for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

-- objetivos y facturación: administrativas, solo organizador
drop policy if exists objetivos_org_all       on public.objetivos;
drop policy if exists fact_mensual_org_all    on public.fact_mensual;
drop policy if exists fact_companias_org_all  on public.fact_companias;
create policy objetivos_org_all on public.objetivos for all to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('objetivos'))
  with check (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('objetivos'));
create policy fact_mensual_org_all on public.fact_mensual for all to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'))
  with check (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'));
create policy fact_companias_org_all on public.fact_companias for all to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'))
  with check (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'));

-- ─── E. Las funciones que se saltean las policies ───────────────────────────
-- Todas son SECURITY DEFINER (necesitan serlo: crean fichas y unifican), así
-- que las policies NO las frenan. El filtro por empresa va adentro, a mano.

create or replace function public.asegurado_buscar_o_crear(
  p_nombre text, p_documento text default null, p_email text default null, p_telefono text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_doc  text := public.doc_normalizado(p_documento);
  v_nom  text := public.nombre_normalizado(p_nombre);
  v_org  uuid := public.org_actual();
  v_id   bigint;
  r      record;
begin
  if not public.es_activo() then
    raise exception 'Sin permisos' using errcode = '42501';
  end if;
  if v_org is null then
    raise exception 'Tu usuario no está asociado a ninguna empresa' using errcode = '42501';
  end if;
  if v_nom is null and v_doc is null then
    raise exception 'Hace falta al menos el nombre o el documento';
  end if;

  if v_doc is not null then
    select id into v_id from public.asegurados where org_id = v_org and documento_norm = v_doc;
    if found then
      update public.asegurados
         set email    = coalesce(email, nullif(p_email,'')),
             telefono = coalesce(telefono, nullif(p_telefono,'')),
             updated_at = now()
       where id = v_id;
      return v_id;
    end if;
  end if;

  if v_doc is null and v_nom is not null then
    select id into v_id from public.asegurados
     where org_id = v_org and nombre_norm = v_nom and documento_norm is null;
    if found then return v_id; end if;
  end if;

  insert into public.asegurados (org_id, nombre, documento, email, telefono)
  values (v_org, p_nombre, nullif(p_documento,''), nullif(p_email,''), nullif(p_telefono,''))
  returning id into v_id;

  if v_nom is not null then
    for r in
      select id, similarity(nombre_norm, v_nom) as s
        from public.asegurados
       where org_id = v_org and id <> v_id
         and nombre_norm % v_nom and similarity(nombre_norm, v_nom) >= 0.70
    loop
      insert into public.asegurados_duplicados (org_id, a_id, b_id, parecido)
      values (v_org, least(v_id, r.id), greatest(v_id, r.id), round(r.s::numeric, 3))
      on conflict (a_id, b_id) do nothing;
    end loop;
  end if;

  return v_id;
end $$;

create or replace function public.asegurado_completar_documento(p_id bigint, p_documento text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_doc  text := public.doc_normalizado(p_documento);
  v_org  uuid := public.org_actual();
  v_otra bigint;
begin
  if not public.es_activo() then
    raise exception 'Sin permisos' using errcode = '42501';
  end if;
  if v_doc is null then return p_id; end if;
  -- La ficha tiene que ser de MI empresa: el id viaja desde el navegador.
  if not exists (select 1 from public.asegurados where id = p_id and org_id = v_org) then
    raise exception 'Esa ficha no es de tu empresa' using errcode = '42501';
  end if;

  select id into v_otra from public.asegurados
   where org_id = v_org and documento_norm = v_doc and id <> p_id;
  if found then
    insert into public.asegurados_duplicados (org_id, a_id, b_id, parecido)
    select v_org, least(p_id, v_otra), greatest(p_id, v_otra),
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

create or replace function public.asegurados_buscar_parecidos(umbral real default 0.70)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_org    uuid := public.org_actual();
  v_nuevos integer := 0;
begin
  if not public.es_activo() then
    raise exception 'Sin permisos' using errcode = '42501';
  end if;
  if v_org is null then return 0; end if;

  with pares as (
    select a.id as a_id, b.id as b_id, similarity(a.nombre_norm, b.nombre_norm) as s
      from public.asegurados a
      join public.asegurados b on a.id < b.id and b.org_id = a.org_id
     where a.org_id = v_org
       and a.nombre_norm is not null and b.nombre_norm is not null
       and a.nombre_norm % b.nombre_norm
       and similarity(a.nombre_norm, b.nombre_norm) >= umbral
       and not (a.documento_norm is not null and b.documento_norm is not null
                and a.documento_norm <> b.documento_norm)
  )
  insert into public.asegurados_duplicados (org_id, a_id, b_id, parecido)
  select v_org, a_id, b_id, round(s::numeric, 3) from pares
  on conflict (a_id, b_id) do nothing;
  get diagnostics v_nuevos = row_count;
  return v_nuevos;
end $$;

create or replace function public.asegurados_enganchar_siniestros(solo_simular boolean default true)
returns table(nombre_ficha text, siniestros bigint, nombres_que_agrupa text)
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.org_actual();
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede hacer esto' using errcode = '42501';
  end if;
  if v_org is null then
    raise exception 'Tu usuario no está asociado a ninguna empresa' using errcode = '42501';
  end if;

  if solo_simular then
    return query
      select min(s.cliente), count(*), string_agg(distinct s.cliente, ' | ')
        from public.siniestros s
       where s.org_id = v_org and not s.eliminado and s.asegurado_id is null and s.cliente is not null
       group by coalesce('doc:' || public.doc_normalizado(s.cliente_doc),
                         'nom:' || public.nombre_normalizado(s.cliente))
       order by count(*) desc, 1;
    return;
  end if;

  insert into public.asegurados (org_id, nombre, documento)
  select distinct on (public.doc_normalizado(s.cliente_doc)) v_org, s.cliente, s.cliente_doc
    from public.siniestros s
   where s.org_id = v_org and not s.eliminado and s.asegurado_id is null
     and public.doc_normalizado(s.cliente_doc) is not null
     and not exists (select 1 from public.asegurados a
                      where a.org_id = v_org
                        and a.documento_norm = public.doc_normalizado(s.cliente_doc))
   order by public.doc_normalizado(s.cliente_doc), s.ultima_mod_fecha desc;

  update public.siniestros s
     set asegurado_id = a.id
    from public.asegurados a
   where s.org_id = v_org and a.org_id = v_org
     and s.asegurado_id is null and not s.eliminado
     and public.doc_normalizado(s.cliente_doc) is not null
     and a.documento_norm = public.doc_normalizado(s.cliente_doc);

  insert into public.asegurados (org_id, nombre)
  select distinct on (public.nombre_normalizado(s.cliente)) v_org, s.cliente
    from public.siniestros s
   where s.org_id = v_org and not s.eliminado and s.asegurado_id is null and s.cliente is not null
     and public.nombre_normalizado(s.cliente) is not null
     and not exists (select 1 from public.asegurados a
                      where a.org_id = v_org
                        and a.nombre_norm = public.nombre_normalizado(s.cliente))
   order by public.nombre_normalizado(s.cliente), s.cliente;

  update public.siniestros s
     set asegurado_id = a.id
    from public.asegurados a
   where s.org_id = v_org and a.org_id = v_org
     and s.asegurado_id is null and not s.eliminado
     and a.nombre_norm = public.nombre_normalizado(s.cliente);

  return query
    select a.nombre, count(s.id), string_agg(distinct s.cliente, ' | ')
      from public.asegurados a
      join public.siniestros s on s.asegurado_id = a.id and not s.eliminado
     where a.org_id = v_org
     group by a.id, a.nombre
     order by count(s.id) desc, a.nombre;
end $$;

create or replace function public.asegurados_no_son_duplicados(a bigint, b bigint, p_quien text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.org_actual();
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede resolver duplicados' using errcode = '42501';
  end if;
  if (select count(*) from public.asegurados x where x.id in (a, b) and x.org_id = v_org) <> 2 then
    raise exception 'Esas fichas no son de tu empresa' using errcode = '42501';
  end if;
  insert into public.asegurados_duplicados (org_id, a_id, b_id, parecido, estado, resuelto_por)
  values (v_org, least(a,b), greatest(a,b), 0, 'distintos', p_quien)
  on conflict (a_id, b_id) do update set estado = 'distintos', resuelto_por = p_quien;
end $$;

create or replace function public.asegurados_unificar(id_final bigint, id_absorbido bigint, p_quien text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.org_actual();
  v_a record; v_b record; v_nota text;
begin
  if not public.es_organizador() then
    raise exception 'Solo un organizador puede unificar asegurados' using errcode = '42501';
  end if;
  if id_final = id_absorbido then
    raise exception 'Son la misma ficha';
  end if;

  -- Las dos fichas tienen que ser de la empresa de quien unifica. Sin esto, con
  -- dos ids se podría arrastrar la ficha de otro broker.
  select * into v_a from public.asegurados where id = id_final and org_id = v_org;
  if not found then raise exception 'No existe la ficha % en tu empresa', id_final; end if;
  select * into v_b from public.asegurados where id = id_absorbido and org_id = v_org;
  if not found then raise exception 'No existe la ficha % en tu empresa', id_absorbido; end if;

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

  update public.siniestros  set asegurado_id = id_final where asegurado_id = id_absorbido and org_id = v_org;
  update public.solicitudes set asegurado_id = id_final where asegurado_id = id_absorbido and org_id = v_org;

  update public.asegurados_duplicados
     set estado = 'unificados', resuelto_por = p_quien
   where a_id = least(id_final, id_absorbido) and b_id = greatest(id_final, id_absorbido);

  delete from public.asegurados where id = id_absorbido and org_id = v_org;
  return id_final;
end $$;


-- ─── F. Avisos de la empresa correcta ───────────────────────────────────────
-- Antes, una denuncia web despertaba a los organizadores de TODAS las empresas.
create or replace function public.trg_notif_solicitud()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in
    select p.id from public.perfiles p
      join public.membresias m on m.usuario_id = p.id and m.estado = 'activo'
     where p.estado = 'activo' and p.rol = 'organizador' and m.org_id = new.org_id
  loop
    perform public.notificar(u.id, 'solicitud',
      'Nueva denuncia web de ' || coalesce(new.nombre,'un asegurado'),
      'Ref ' || new.ref || coalesce(' · ' || nullif(new.localidad,''), ''),
      'solicitudes', 'SOL-' || lpad(new.id::text, 4, '0'));
  end loop;
  return new;
end $$;

create or replace function public.trg_notif_cotizacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in
    select p.id from public.perfiles p
      join public.membresias m on m.usuario_id = p.id and m.estado = 'activo'
     where p.estado = 'activo' and m.org_id = new.org_id
  loop
    perform public.notificar(u.id, 'cotizacion',
      'Nueva cotización de hogar: ' || coalesce(new.nombre,'un interesado'),
      'Ref ' || new.ref || coalesce(' · ' || nullif(new.localidad,''), '') || coalesce(' · ' || nullif(new.telefono,''), ''),
      'com-cotizaciones', 'COT-' || lpad(new.id::text, 4, '0'));
  end loop;
  return new;
end $$;

-- ─── G. La gente de mi empresa, y nada más ──────────────────────────────────
-- `perfiles` era una guía telefónica compartida: cualquier usuario activo veía
-- el nombre y el mail de todos, de cualquier empresa.
drop policy if exists perfiles_select     on public.perfiles;
drop policy if exists perfiles_org_update on public.perfiles;
drop policy if exists perfiles_org_delete on public.perfiles;
create policy perfiles_select on public.perfiles for select to authenticated
  using (
    id = auth.uid()
    or (public.es_activo() and exists (
          select 1 from public.membresias m
           where m.usuario_id = public.perfiles.id
             and m.org_id = (select public.org_actual())))
  );
create policy perfiles_org_update on public.perfiles for update to authenticated
  using (public.es_organizador() and exists (
          select 1 from public.membresias m
           where m.usuario_id = public.perfiles.id
             and m.org_id = (select public.org_actual())))
  with check (public.es_organizador() and exists (
          select 1 from public.membresias m
           where m.usuario_id = public.perfiles.id
             and m.org_id = (select public.org_actual())));
create policy perfiles_org_delete on public.perfiles for delete to authenticated
  using (public.es_organizador() and exists (
          select 1 from public.membresias m
           where m.usuario_id = public.perfiles.id
             and m.org_id = (select public.org_actual())));

-- Una cuenta nueva ya nace con su membresía, si no el organizador no la ve para
-- aprobarla. De qué empresa es lo dice el registro (el portal manda `org_slug`);
-- si no viene, es la empresa original.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_slug text := nullif(new.raw_user_meta_data->>'org_slug', '');
  v_org  uuid;
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'nombre',''),
                   initcap(replace(split_part(new.email,'@',1),'.',' '))))
  on conflict (id) do nothing;

  select id into v_org from public.organizaciones
   where slug = lower(v_slug) and estado in ('activa','prueba');
  if v_org is null then v_org := public.org_defecto(); end if;

  if v_org is not null then
    insert into public.membresias (usuario_id, org_id, rol, estado)
    values (new.id, v_org, 'empleado', 'pendiente')
    on conflict (usuario_id, org_id) do nothing;
  end if;
  return new;
end $$;

-- Cuando el organizador aprueba o cambia el rol de alguien, la membresía sigue
-- al perfil: son dos tablas que tienen que contar la misma historia.
create or replace function public.trg_perfil_sincroniza_membresia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.membresias m
     set rol    = case when new.rol = 'organizador' then 'organizador' else 'empleado' end,
         estado = case when new.estado = 'activo' then 'activo'
                       when new.estado = 'pendiente' then 'pendiente'
                       else 'suspendido' end
   where m.usuario_id = new.id;
  return new;
end $$;

drop trigger if exists perfil_sincroniza_membresia on public.perfiles;
create trigger perfil_sincroniza_membresia
  after update of rol, estado on public.perfiles
  for each row execute function public.trg_perfil_sincroniza_membresia();

comment on column public.siniestros.org_id is 'De qué broker es esta fila. Es el límite de seguridad: ninguna consulta lo cruza.';
comment on function public.org_defecto() is 'La empresa más vieja de la base: la del broker original. Sostiene los formularios públicos que todavía no dicen de qué empresa son.';
