-- ============================================================================
-- Saraceni Seguros · Módulo de Facturación — Esquema Supabase
-- Mismo patrón que siniestros (RLS a usuarios autenticados + realtime).
-- Los datos 2025/2026 se importaron desde FACTURACION.xlsx (196 facturas).
-- ============================================================================
create table if not exists public.facturas (
  id               bigint generated always as identity primary key,
  codigo           text unique not null,        -- FAC-0001
  n                integer not null,
  fecha_emision    date,
  nro_factura      text,
  tipo             text,                         -- A | B
  cuit             text,
  razon_social     text not null,               -- compañía aseguradora
  neto_gravado     numeric(14,2),
  iva              numeric(14,2),
  total            numeric(14,2),
  mail_envio       text,                         -- email o 'WEB'
  estado_envio     text,
  monto_pagado     numeric(14,2),
  estado_pago      text,                         -- 'OK' | 'parcial' | null
  banco            text,                         -- RIO | BBVA
  observaciones    text,
  mes              integer not null,             -- 1..12 (período)
  anio             integer not null,
  ultima_mod_por   text,
  ultima_mod_fecha timestamptz not null default now(),
  eliminado        boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists facturas_periodo_idx on public.facturas (anio, mes);
create index if not exists facturas_razon_idx   on public.facturas (razon_social);

alter table public.facturas enable row level security;
drop policy if exists "acceso facturas autenticado" on public.facturas;
create policy "acceso facturas autenticado"
  on public.facturas for all to authenticated
  using (true) with check (true);

-- Tiempo real (igual que siniestros)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'facturas'
  ) then
    alter publication supabase_realtime add table public.facturas;
  end if;
end $$;
