-- 0019 — El pipeline comercial, y quién hizo cada cosa
-- ============================================================================
-- `cotizaciones` era la bandeja del formulario público de hogar: llegaba un
-- pedido, se marcaba "cotizada" y ahí moría. No había forma de saber qué se
-- cotizó, cuándo, por cuánto, ni cuáles se terminaron cerrando. Tampoco quién
-- hizo cada llamado.
--
-- Se extiende la misma tabla en vez de crear otra: una cotización que entra por
-- el formulario y una que carga el equipo son la misma cosa en momentos
-- distintos, y separarlas obligaría a mirar dos pantallas para responder "¿cómo
-- venimos este mes?". `origen` distingue de dónde salió.
--
-- ⚠️ Ninguna columna nueva es obligatoria: el formulario público sigue
-- insertando exactamente lo mismo que antes.
-- ============================================================================

-- ─── A. Lo que le faltaba a una cotización ──────────────────────────────────
alter table public.cotizaciones
  add column if not exists detalle          text,      -- qué se cotiza
  add column if not exists fecha_cotizacion date,      -- cuándo se pasó el precio
  add column if not exists compania         text,      -- a qué compañía
  add column if not exists prima            numeric,   -- cuánto se cotizó
  add column if not exists fecha_cierre     date,      -- cuándo se cerró
  add column if not exists poliza           text,      -- la póliza que salió
  add column if not exists motivo_perdida   text,      -- por qué no se cerró
  add column if not exists responsable      text,      -- quién la lleva
  add column if not exists origen           text not null default 'web';

comment on column public.cotizaciones.origen is 'web = entro por el formulario publico; manual = la cargo el equipo.';

-- El formulario público no puede hacerse pasar por una carga del equipo.
drop policy if exists cotizaciones_anon_insert on public.cotizaciones;
create policy cotizaciones_anon_insert on public.cotizaciones for insert to anon
  with check (public.org_recibe_publico(org_id)
              and public.org_tiene_modulo(org_id, 'comercial')
              and origen = 'web');

create index if not exists cotizaciones_estado_idx on public.cotizaciones (org_id, estado);

-- ─── B. Quién hizo cada acción ──────────────────────────────────────────────
-- Un llamado, una cotización enviada, un cierre, una emisión. Una fila por
-- cosa que pasó, con nombre y apellido.
--
-- Una sola tabla para cotizaciones y objetivos, con dos claves y un check de
-- que venga exactamente una: son el mismo concepto ("qué se hizo y quién lo
-- hizo") y tenerlo dos veces significa dos pantallas que se desincronizan.
create table if not exists public.acciones (
  id            bigserial primary key,
  org_id        uuid not null default coalesce(public.org_actual(), public.org_defecto())
                references public.organizaciones(id) on delete restrict,
  cotizacion_id bigint references public.cotizaciones(id) on delete cascade,
  objetivo_id   bigint references public.objetivos(id)    on delete cascade,
  tipo          text not null,
  nota          text,
  fecha         timestamptz not null default now(),
  usuario       text not null,
  usuario_id    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint acciones_una_sola_cosa check (num_nonnulls(cotizacion_id, objetivo_id) = 1)
);
create index if not exists acciones_cot_idx on public.acciones (cotizacion_id, fecha desc);
create index if not exists acciones_obj_idx on public.acciones (objetivo_id, fecha desc);
create index if not exists acciones_org_idx on public.acciones (org_id, fecha desc);

alter table public.acciones enable row level security;

-- Cada rama hereda el permiso de lo que cuelga: las de una cotización piden el
-- módulo comercial, las de un objetivo piden objetivos, que además es
-- administrativo y solo lo ve un organizador.
drop policy if exists acciones_select on public.acciones;
drop policy if exists acciones_insert on public.acciones;
drop policy if exists acciones_update on public.acciones;
drop policy if exists acciones_delete on public.acciones;

create policy acciones_select on public.acciones for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo()
         and ((cotizacion_id is not null and public.tiene_modulo('comercial'))
           or (objetivo_id  is not null and public.tiene_modulo('objetivos') and public.es_organizador())));

create policy acciones_insert on public.acciones for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_activo()
         and ((cotizacion_id is not null and public.tiene_modulo('comercial'))
           or (objetivo_id  is not null and public.tiene_modulo('objetivos') and public.es_organizador())));

-- Corregir un typo, sí; reescribir lo que hizo otro, no. Un registro de
-- acciones que cualquiera puede editar no sirve para saber qué pasó.
create policy acciones_update on public.acciones for update to authenticated
  using  (org_id = (select public.org_actual()) and public.es_activo() and usuario_id = auth.uid())
  with check (org_id = (select public.org_actual()) and public.es_activo() and usuario_id = auth.uid());

create policy acciones_delete on public.acciones for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

comment on table public.acciones is 'Que se hizo, cuando y quien: llamados, cotizaciones, cierres, emisiones. Cuelga de una cotizacion o de un objetivo.';
