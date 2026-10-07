-- 0022 — Lo que no es de una compañía sino del mes entero
-- ============================================================================
-- Para repartir sueldos no alcanza con lo que facturó cada compañía: hay que
-- descontar lo que se pagó de IVA, y eso es UNO por mes, no uno por compañía.
-- No tenía dónde vivir: `fact_mensual` es por compañía y `fact_companias` es lo
-- fijo de cada una.
--
-- La tabla queda a propósito con una sola columna de plata. Lo que se agregue
-- después (retenciones, gastos del mes, lo que sea) es otra columna acá y no
-- otra tabla: todo lo que se descuenta del total antes de repartir es la misma
-- cosa mirada por el mismo mes.
-- ============================================================================

create table if not exists public.fact_periodo (
  org_id     uuid not null default public.org_actual() references public.organizaciones(id) on delete cascade,
  anio       int  not null,
  mes        int  not null check (mes between 1 and 12),
  pago_iva   numeric,          -- lo que se transfirió a la AFIP por ese mes
  notas      text,
  updated_at timestamptz not null default now(),
  primary key (org_id, anio, mes)
);

alter table public.fact_periodo enable row level security;

-- Igual que el resto de facturación: administrativo, solo organizador, y con
-- el módulo contratado.
drop policy if exists fact_periodo_org_all on public.fact_periodo;
create policy fact_periodo_org_all on public.fact_periodo for all to authenticated
  using      (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'))
  with check (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'));
