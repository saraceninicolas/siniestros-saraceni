-- 0021 — Un mes puede cobrarse en varias veces
-- ============================================================================
-- `fact_mensual.pago` era UN número por compañía y por mes, y varias compañías
-- pagan la misma factura en partes: La Mercantil transfiere 100 y a la semana
-- siguiente 150. Con un solo campo había que pisar el 100 con 250 a mano, y se
-- perdía cuándo entró cada parte, que es justo lo que se mira cuando una
-- compañía se atrasa.
--
-- Ahora cada transferencia es una fila en `fact_pagos` y el total lo mantiene
-- la base. `fact_mensual.pago` NO se borra ni cambia de significado: sigue
-- siendo "cuánto se cobró de este mes", y lo siguen leyendo el resumen, la
-- ficha de cada compañía y las estadísticas (la dona, las alertas, la
-- evolución). Lo que cambia es quién lo escribe: antes la pantalla, ahora un
-- trigger. Así ninguna de esas quince lecturas se entera de nada.
-- ============================================================================

-- ─── A. El detalle ──────────────────────────────────────────────────────────
-- Cuelga de `fact_mensual` y no de (compañía, año, mes) sueltos: un cobro es
-- de UNA factura. Si esa fila se borra, sus cobros se van con ella; que
-- quedaran huérfanos sumando en algún lado sería peor que perderlos.
create table if not exists public.fact_pagos (
  id         bigint generated always as identity primary key,
  org_id     uuid not null default public.org_actual() references public.organizaciones(id) on delete cascade,
  fact_id    bigint not null references public.fact_mensual(id) on delete cascade,
  fecha      date,                 -- cuándo entró la transferencia
  importe    numeric not null,
  nota       text,                 -- "a cuenta", "retenciones", el nro de operación
  created_at timestamptz not null default now()
);

create index if not exists fact_pagos_fact_idx on public.fact_pagos (fact_id);

alter table public.fact_pagos enable row level security;

-- La misma forma que `fact_mensual`: facturación es administrativo, solo
-- organizador, y además pide el módulo.
drop policy if exists fact_pagos_org_all on public.fact_pagos;
create policy fact_pagos_org_all on public.fact_pagos for all to authenticated
  using      (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'))
  with check (org_id = (select public.org_actual()) and public.es_organizador() and public.tiene_modulo('facturacion'));

-- ─── B. El total lo mantiene la base ────────────────────────────────────────
-- Si el total lo calculara la pantalla, el día que alguien cargue un cobro
-- desde otro lado —o que dos pestañas guarden a la vez— el resumen del mes
-- diría una cosa y el detalle otra. Acá no hay forma de que se separen.
--
-- Sin cobros el total queda en NULL y no en 0, a propósito: "todavía no cobré"
-- y "me pagaron cero" se ven igual en una tabla y significan distinto.
create or replace function public.fact_recalcular_pago()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_fact bigint;
begin
  v_fact := coalesce(new.fact_id, old.fact_id);
  update public.fact_mensual m
     set pago = (select sum(p.importe) from public.fact_pagos p where p.fact_id = m.id)
   where m.id = v_fact;
  return null;
end $$;

drop trigger if exists fact_pagos_recalcula on public.fact_pagos;
create trigger fact_pagos_recalcula
  after insert or update or delete on public.fact_pagos
  for each row execute function public.fact_recalcular_pago();

-- ─── C. Lo ya cobrado pasa a ser el primer cobro ────────────────────────────
-- Cada `pago` cargado hasta hoy se convierte en una fila. Sin esto, la primera
-- vez que alguien agregara un cobro el trigger recalcularía el total sobre una
-- tabla vacía y el mes se iría a cero: lo viejo tiene que estar adentro del
-- detalle ANTES de que el detalle mande.
--
-- La fecha del cobro no la sabemos (nunca se preguntó), así que se usa la de la
-- factura y la nota lo aclara. Inventar una fecha sería peor que no tenerla.
insert into public.fact_pagos (org_id, fact_id, fecha, importe, nota)
select m.org_id, m.id, m.fecha, m.pago, 'Cargado antes de que se pudiera dividir'
  from public.fact_mensual m
 where m.pago is not null
   and not exists (select 1 from public.fact_pagos p where p.fact_id = m.id);

-- ⚠️ La pantalla deja de escribir `pago` (sale de `toRowFM` en db.js). No se le
-- revocan privilegios a la columna para no romper un guardado en producción por
-- un permiso de columna mal puesto; si algún día algo vuelve a escribirla, el
-- primer cobro que se agregue la devuelve a la suma del detalle.
