-- ============================================================================
-- Saraceni Seguros · Facturación (reestructurada)
-- ----------------------------------------------------------------------------
-- Antes existía una única tabla `facturas` donde cada comprobante repetía razón
-- social, CUIT, tipo y destino de envío. Ahora eso vive una sola vez por
-- compañía y cada mes solo se cargan los importes.
--   fact_companias → datos FIJOS (nunca cambian)
--   fact_mensual   → datos VARIABLES (una fila por compañía y mes)
-- Acceso: solo organizadores, igual que la Facturación anterior.
-- ============================================================================

create table if not exists public.fact_companias (
  id            bigint generated always as identity primary key,
  razon_social  text not null,
  cuit          text not null unique,       -- identifica la compañía
  tipo          text,                       -- A | B (tipo de factura que se emite)
  envio         text,                       -- mail de facturación o 'WEB'
  banco         text,                       -- banco donde acreditan
  notas         text,                       -- aclaraciones de cómo facturarle
  activa        boolean not null default true,  -- si aparece en la carga mensual
  orden         integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.fact_mensual (
  id            bigint generated always as identity primary key,
  compania_id   bigint not null references public.fact_companias(id) on delete cascade,
  anio          integer not null,
  mes           integer not null check (mes between 1 and 12),
  fecha         date,
  nro_factura   text,
  neto          numeric,
  iva           numeric,
  total         numeric,
  enviado       boolean not null default false,
  pago          numeric,                    -- lo efectivamente cobrado
  observaciones text,
  ultima_mod_por   text,
  ultima_mod_fecha timestamptz not null default now(),
  unique (compania_id, anio, mes)           -- una sola fila por compañía y mes
);
create index if not exists fact_mensual_periodo_idx on public.fact_mensual (anio, mes);

alter table public.fact_companias enable row level security;
alter table public.fact_mensual   enable row level security;
create policy "fact_companias_org_all" on public.fact_companias
  for all to authenticated using (public.es_organizador()) with check (public.es_organizador());
create policy "fact_mensual_org_all" on public.fact_mensual
  for all to authenticated using (public.es_organizador()) with check (public.es_organizador());

-- Realtime en ambas tablas.
--
-- DATOS: 11 compañías y 197 movimientos (ene-2025 a ago-2026) importados de
-- 'FACTURACION (1).xlsx'. Zurich se quitó a pedido. OJO al releer ese Excel:
-- las hojas de 2025 y ene-26 tienen el encabezado en la fila 4 y los datos
-- desde la 5, pero de feb-26 en adelante el encabezado está en la fila 3 y los
-- datos arrancan en la 4 — hay que detectar la fila de 'FECHA', no asumirla.
-- La tabla vieja `facturas` quedó sin uso.
