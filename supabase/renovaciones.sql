-- ============================================================================
-- Saraceni Seguros · Módulo de Renovaciones — Esquema Supabase
-- Mismo patrón que siniestros/facturas (RLS a autenticados + realtime).
-- Datos iniciales: listado "RENOVACION AGOSTO 26" (19 pólizas).
-- ============================================================================
create table if not exists public.renovaciones (
  id               bigint generated always as identity primary key,
  codigo           text unique not null,        -- REN-0001
  n                integer not null,
  poliza           text,
  cliente          text not null,
  aseguradora      text,
  seccion          text,                         -- AUTOS, INT.COMERC, ...
  inicio_vig       date,
  fin_vig          date,                         -- vencimiento = fecha de renovación
  estado           text default 'Pendiente',     -- Pendiente | En gestión | Renovada | No renueva
  observaciones    text,
  ultima_mod_por   text,
  ultima_mod_fecha timestamptz not null default now(),
  eliminado        boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists renovaciones_finvig_idx on public.renovaciones (fin_vig);

alter table public.renovaciones enable row level security;
drop policy if exists "acceso renovaciones autenticado" on public.renovaciones;
create policy "acceso renovaciones autenticado"
  on public.renovaciones for all to authenticated
  using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'renovaciones'
  ) then
    alter publication supabase_realtime add table public.renovaciones;
  end if;
end $$;
