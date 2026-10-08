-- 0023 — El reparto del mes y las transferencias a cada uno
-- ============================================================================
-- Lo que entra se reparte entre los socios sobre el cobrado menos el IVA
-- pagado. Hasta ahora esa cuenta se hacía afuera del portal, así que no quedaba
-- registro de cuánto le tocó a cada uno ni de cuándo se le transfirió.
--
-- Dos piezas:
--   · `fact_periodo.reparto`: los porcentajes que rigieron ESE mes.
--   · `fact_transferencias`: cada giro, con su fecha.
-- ============================================================================

-- ─── A. Los porcentajes, guardados por mes ──────────────────────────────────
-- Van en el período y no en una configuración suelta porque cambian: el día
-- que se mueva un porcentaje, los meses ya cerrados tienen que seguir mostrando
-- el reparto con el que se cerraron. Una tabla de configuración única
-- reescribiría la historia hacia atrás.
--
-- Es jsonb —[{nombre, pct}]— para no necesitar una migración cada vez que entra
-- o sale alguien del reparto.
alter table public.fact_periodo
  add column if not exists reparto jsonb;

comment on column public.fact_periodo.reparto is
  'Porcentajes que rigieron ese mes: [{"nombre":"...","pct":75}]. Si está en null, la pantalla arrastra el del último mes que tenga.';

-- ─── B. Las transferencias ──────────────────────────────────────────────────
-- Una fila por giro. Puede haber varios por persona y por mes: casi nunca se
-- paga todo junto, y lo que importa es cuándo salió cada parte.
create table if not exists public.fact_transferencias (
  id         bigint generated always as identity primary key,
  org_id     uuid not null default public.org_actual() references public.organizaciones(id) on delete cascade,
  anio       int  not null,
  mes        int  not null check (mes between 1 and 12),
  persona    text not null,
  fecha      date,
  importe    numeric not null,
  created_at timestamptz not null default now()
);

-- La pantalla siempre pide el mes entero.
create index if not exists fact_transf_periodo_idx
  on public.fact_transferencias (org_id, anio, mes);

alter table public.fact_transferencias enable row level security;

-- Cuánto cobra cada socio es de lo más reservado que hay en la empresa: va con
-- la misma llave que el resto de facturación, que es solo organizador.
drop policy if exists fact_transf_org_all on public.fact_transferencias;
create policy fact_transf_org_all on public.fact_transferencias for all to authenticated
  using      (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'))
  with check (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'));
