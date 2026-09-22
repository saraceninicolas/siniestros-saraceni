-- Base multiempresa: empresas, membresías, catálogo de módulos y cobros
-- ============================================================================
-- Primer paso de la fase 1. Esta migración SOLO AGREGA tablas nuevas: no toca
-- ninguna de las 12 que ya existen, así que el portal sigue funcionando igual
-- mientras tanto. La columna de dueño en esas tablas va en la 0010, que es la
-- que hay que mirar con lupa.
--
-- POR QUÉ UNA BASE COMPARTIDA Y NO UNA POR CLIENTE
-- Una base por cliente aísla sin pensar, pero obliga a aplicar cada migración y
-- cada arreglo N veces, a mano. Con una sola persona manteniéndolo, eso se
-- rompe en el cliente 3. Se comparte la base y el aislamiento lo hacen las
-- policies, que es lo que hay que probar con tests (ver tests/rls.test.js).
--
-- LA ORGANIZACIÓN ES EL LÍMITE DE SEGURIDAD; LA OFICINA NO
-- Las oficinas son un filtro interno de cada broker (quién atiende qué). Si
-- algún día hacen falta permisos por oficina, se agregan ADENTRO de la
-- organización; el límite que nunca se cruza es la empresa.
--
-- CÓMO SE SABE A QUÉ EMPRESA PERTENECE QUIEN CONSULTA
-- `org_actual()` lee el `org_id` del token de sesión. Todavía no existe el hook
-- que lo escribe, así que mientras tanto cae a buscar la membresía activa del
-- usuario. Cuando el hook esté, el camino rápido pasa a ser el primero y este
-- queda de red. Las policies la llaman envuelta en `(select …)` para que
-- Postgres la evalúe UNA vez por consulta y no una vez por fila.
--
-- QUÉ SE VENDE (decisión de Nico, 2026-09-22)
-- Tres planes cerrados, pero con precio de lista por módulo suelto, porque el
-- primer cliente vendido (Aicardi) compró solo siniestros. Por eso el precio
-- vive en dos lados: `modulos.precio_lista` y `planes.precio` son la lista de
-- precios, y `suscripciones.precio_mensual` es lo que se pactó con ESE cliente
-- y no se recalcula solo si mañana cambia la lista.
-- Los precios quedan en null a propósito: los completa Nico, no los invento yo.
-- ============================================================================

-- ─── Empresas ───────────────────────────────────────────────────────────────
create table if not exists public.organizaciones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  -- Para la URL pública de sus páginas: /aicardi/denuncia
  slug       text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  cuit       text,
  estado     text not null default 'prueba'
             check (estado in ('prueba', 'activa', 'suspendida', 'baja')),
  -- Logo y colores. En jsonb porque es presentación: cambia seguido y no se
  -- consulta por sus campos.
  marca      jsonb not null default '{}'::jsonb,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oficinas (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references public.organizaciones(id) on delete cascade,
  nombre  text not null,
  unique (org_id, nombre)
);

-- ─── Quién es quién ─────────────────────────────────────────────────────────
-- Reemplaza el doble papel que hoy cumple `perfiles`: la persona sigue siendo
-- una (su cuenta), pero el rol y el estado pasan a ser por empresa. Así alguien
-- puede trabajar en dos brokers sin tener dos cuentas.
create table if not exists public.membresias (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organizaciones(id) on delete cascade,
  rol        text not null default 'empleado' check (rol in ('organizador', 'empleado')),
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'suspendido')),
  oficina_id uuid references public.oficinas(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (usuario_id, org_id)
);
create index if not exists membresias_org_idx on public.membresias (org_id);

-- Quién puede entrar al portal de administración. Esta tabla no tiene NINGUNA
-- policy a propósito: solo se lee desde el servidor con la llave maestra, que
-- nunca toca un navegador.
create table if not exists public.super_admins (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  created_at timestamptz not null default now()
);

-- ─── Catálogo: qué se vende ─────────────────────────────────────────────────
create table if not exists public.modulos (
  clave        text primary key,
  nombre       text not null,
  descripcion  text,
  precio_lista numeric(12,2),
  orden        integer not null default 0,
  activo       boolean not null default true
);

create table if not exists public.planes (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  precio numeric(12,2),
  orden  integer not null default 0,
  activo boolean not null default true
);

create table if not exists public.plan_modulos (
  plan_id      uuid not null references public.planes(id) on delete cascade,
  modulo_clave text not null references public.modulos(clave) on delete cascade,
  primary key (plan_id, modulo_clave)
);

-- ─── Qué contrató cada empresa ──────────────────────────────────────────────
create table if not exists public.suscripciones (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizaciones(id) on delete cascade,
  plan_id        uuid references public.planes(id),     -- null = armado a medida
  precio_mensual numeric(12,2),
  moneda         text not null default 'ARS',
  ciclo          text not null default 'mensual' check (ciclo in ('mensual', 'anual')),
  desde          date not null default current_date,
  hasta          date,
  estado         text not null default 'activa' check (estado in ('activa', 'pausada', 'terminada')),
  notas          text
);
create index if not exists suscripciones_org_idx on public.suscripciones (org_id);

-- Excepciones por empresa: un módulo suelto que no está en el plan, o uno del
-- plan que se apaga. Manda sobre el plan.
create table if not exists public.org_modulos (
  org_id       uuid not null references public.organizaciones(id) on delete cascade,
  modulo_clave text not null references public.modulos(clave) on delete cascade,
  habilitado   boolean not null default true,
  nota         text,
  primary key (org_id, modulo_clave)
);

-- Una fila por empresa y mes. El cobro es a mano (factura y transferencia):
-- esto es la cuenta corriente, no una pasarela de pago.
create table if not exists public.cobros (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizaciones(id) on delete cascade,
  periodo     date not null,                 -- siempre el día 1 del mes
  importe     numeric(12,2) not null,
  vence_el    date,
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'pagado', 'vencido', 'anulado')),
  pagado_el   date,
  medio       text,
  comprobante text,
  notas       text,
  created_at  timestamptz not null default now(),
  unique (org_id, periodo)
);

-- ─── Helpers ────────────────────────────────────────────────────────────────
-- A qué empresa pertenece quien está consultando.
-- El `nullif(…, '')` antes del ::jsonb no es decorativo: sin sesión el ajuste
-- viene vacío y convertir '' a jsonb aborta la consulta entera en vez de
-- responder "ninguna empresa".
create or replace function public.org_actual() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'org_id', ''),
    (select m.org_id::text from public.membresias m
      where m.usuario_id = auth.uid() and m.estado = 'activo'
      order by m.created_at limit 1)
  )::uuid;
$$;

create or replace function public.es_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.super_admins where usuario_id = auth.uid());
$$;

-- ¿La empresa de quien consulta tiene contratado este módulo?
-- La excepción por empresa manda sobre el plan; si no hay excepción, vale lo
-- que incluya el plan de una suscripción activa.
create or replace function public.tiene_modulo(p_clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.org_actual() is null then false
    when exists (select 1 from public.org_modulos om
                  where om.org_id = public.org_actual() and om.modulo_clave = p_clave)
      then (select om.habilitado from public.org_modulos om
             where om.org_id = public.org_actual() and om.modulo_clave = p_clave)
    else exists (
      select 1 from public.suscripciones s
        join public.plan_modulos pm on pm.plan_id = s.plan_id
       where s.org_id = public.org_actual()
         and s.estado = 'activa'
         and (s.hasta is null or s.hasta >= current_date)
         and pm.modulo_clave = p_clave)
  end;
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Regla general: el portal LEE lo suyo; escribir empresas, planes, precios y
-- cobros es cosa del portal de administración, que va por la llave maestra y
-- no pasa por estas policies.
alter table public.organizaciones enable row level security;
alter table public.oficinas       enable row level security;
alter table public.membresias     enable row level security;
alter table public.super_admins   enable row level security;
alter table public.modulos        enable row level security;
alter table public.planes         enable row level security;
alter table public.plan_modulos   enable row level security;
alter table public.suscripciones  enable row level security;
alter table public.org_modulos    enable row level security;
alter table public.cobros         enable row level security;

create policy org_propia_select on public.organizaciones
  for select to authenticated using (id = (select public.org_actual()));
create policy oficinas_propias_select on public.oficinas
  for select to authenticated using (org_id = (select public.org_actual()));
create policy oficinas_org_escribe on public.oficinas
  for all to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador())
  with check (org_id = (select public.org_actual()) and public.es_organizador());

-- Los miembros se ven entre sí; el organizador de la empresa los administra.
-- El alta la hace el portal de administración: acá no hay insert ni delete.
create policy membresias_propias_select on public.membresias
  for select to authenticated using (org_id = (select public.org_actual()));
create policy membresias_org_update on public.membresias
  for update to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador())
  with check (org_id = (select public.org_actual()) and public.es_organizador());

-- El catálogo es lo mismo para todos: el portal lo lee para armar el menú.
create policy modulos_todos_select      on public.modulos      for select to authenticated using (true);
create policy planes_todos_select       on public.planes       for select to authenticated using (true);
create policy plan_modulos_todos_select on public.plan_modulos for select to authenticated using (true);

-- Qué contrató MI empresa, sí. Lo que contrataron las demás, no.
create policy suscripciones_propias_select on public.suscripciones
  for select to authenticated using (org_id = (select public.org_actual()));
create policy org_modulos_propios_select on public.org_modulos
  for select to authenticated using (org_id = (select public.org_actual()));

-- `cobros` y `super_admins` quedan sin policy: nadie los lee desde el navegador.

revoke execute on function public.org_actual()       from public, anon;
revoke execute on function public.es_super_admin()   from public, anon;
revoke execute on function public.tiene_modulo(text) from public, anon;
grant  execute on function public.org_actual()       to authenticated;
grant  execute on function public.es_super_admin()   to authenticated;
grant  execute on function public.tiene_modulo(text) to authenticated;

-- ─── Catálogo inicial ───────────────────────────────────────────────────────
-- Los precios van en null: los pone Nico desde el portal de administración.
insert into public.modulos (clave, nombre, descripcion, orden) values
  ('siniestros',   'Siniestros',   'Carga y seguimiento de siniestros, agenda de gestiones, estadísticas, siniestralidad por asegurado y el formulario público de denuncia', 1),
  ('renovaciones', 'Renovaciones', 'Pólizas próximas a vencer e historial de renovaciones', 2),
  ('pendientes',   'Pendientes',   'Tareas del equipo con vencimiento y responsable', 3),
  ('comercial',    'Comercial',    'Panel comercial y cotizaciones de hogar, con su formulario público', 4),
  ('facturacion',  'Facturación',  'Facturación por compañía, carga mensual y crecimiento anual', 5),
  ('objetivos',    'Objetivos',    'Metas por área con seguimiento del avance', 6)
on conflict (clave) do nothing;

insert into public.planes (nombre, orden) values
  ('Básico', 1), ('Completo', 2), ('Full', 3)
on conflict (nombre) do nothing;

-- Básico: el núcleo del negocio. Completo: el día a día de una oficina.
-- Full: todo, incluida la parte administrativa del broker.
insert into public.plan_modulos (plan_id, modulo_clave)
select p.id, m.clave
  from public.planes p
  join public.modulos m on
       (p.nombre = 'Básico'   and m.clave in ('siniestros'))
    or (p.nombre = 'Completo' and m.clave in ('siniestros', 'renovaciones', 'pendientes', 'comercial'))
    or (p.nombre = 'Full')
on conflict do nothing;

comment on table  public.organizaciones is 'Cada broker que usa el portal. Es el límite de seguridad: ninguna consulta cruza de una a otra.';
comment on column public.suscripciones.precio_mensual is 'Lo pactado con ese cliente. No se recalcula si cambia la lista de precios.';
comment on table  public.cobros is 'Cuenta corriente: el cobro es por factura y transferencia, no hay pasarela de pago.';
