-- ============================================================================
-- Saraceni Seguros · Módulo de Renovaciones — Esquema Supabase
-- Disponible para TODOS los perfiles (organizador y empleado); la baja
-- definitiva queda solo para el organizador. Realtime activo.
-- Datos: "RENOVACION AGOSTO 26" (19 pólizas) + "RENOVACION SEPTIEMBRE 26" (30).
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
-- Ver/crear/editar: cualquier usuario activo (organizador o empleado).
-- Borrar: solo organizador. Ver supabase/roles_notificaciones.sql.
create policy "renovaciones_activo_select" on public.renovaciones
  for select to authenticated using (public.es_activo());
create policy "renovaciones_activo_insert" on public.renovaciones
  for insert to authenticated with check (public.es_activo());
create policy "renovaciones_activo_update" on public.renovaciones
  for update to authenticated using (public.es_activo()) with check (public.es_activo());
create policy "renovaciones_org_delete" on public.renovaciones
  for delete to authenticated using (public.es_organizador());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'renovaciones'
  ) then
    alter publication supabase_realtime add table public.renovaciones;
  end if;
end $$;
