-- ============================================================================
-- Saraceni Seguros · Módulos Pendientes y Objetivos — Esquema Supabase
-- Mismo patrón que el resto (RLS a autenticados + realtime).
-- ============================================================================

-- ---- PENDIENTES: tareas generales del broker ----
create table if not exists public.pendientes (
  id               bigint generated always as identity primary key,
  codigo           text unique not null,          -- PEN-0001
  n                integer not null,
  titulo           text not null,
  descripcion      text,
  cliente          text,
  categoria        text default 'Otro',           -- Cotización | Póliza | Cobranza | Administración | Otro
  prioridad        text default 'Media',          -- Alta | Media | Baja
  fecha_limite     date,
  estado           text default 'Pendiente',      -- Pendiente | En curso | Hecho
  asignado         text,
  ultima_mod_por   text,
  ultima_mod_fecha timestamptz not null default now(),
  eliminado        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists pendientes_fecha_idx on public.pendientes (fecha_limite);
alter table public.pendientes enable row level security;
drop policy if exists "acceso pendientes autenticado" on public.pendientes;
create policy "acceso pendientes autenticado" on public.pendientes for all to authenticated using (true) with check (true);

-- ---- OBJETIVOS: metas con seguimiento ----
create table if not exists public.objetivos (
  id               bigint generated always as identity primary key,
  codigo           text unique not null,           -- OBJ-0001
  n                integer not null,
  titulo           text not null,
  tipo             text not null default 'manual', -- 'facturacion' (avance automático) | 'manual'
  mes              integer,                        -- null = todo el año
  anio             integer not null,
  meta             numeric(14,2) not null default 0,
  valor_actual     numeric(14,2),                  -- solo tipo manual
  unidad           text default '$',
  notas            text,
  ultima_mod_por   text,
  ultima_mod_fecha timestamptz not null default now(),
  eliminado        boolean not null default false,
  created_at       timestamptz not null default now()
);
alter table public.objetivos enable row level security;
drop policy if exists "acceso objetivos autenticado" on public.objetivos;
create policy "acceso objetivos autenticado" on public.objetivos for all to authenticated using (true) with check (true);

-- Realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pendientes') then
    alter publication supabase_realtime add table public.pendientes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='objetivos') then
    alter publication supabase_realtime add table public.objetivos;
  end if;
end $$;

-- Objetivos de ejemplo (editables desde el portal)
insert into public.objetivos (codigo,n,titulo,tipo,mes,anio,meta,unidad,notas) values
('OBJ-0001',1,'Facturación del mes','facturacion',7,2026,10000000,'$','Meta de ejemplo — editá el monto objetivo'),
('OBJ-0002',2,'Facturación anual 2026','facturacion',null,2026,120000000,'$','Meta de ejemplo — editá el monto objetivo')
on conflict (codigo) do nothing;
