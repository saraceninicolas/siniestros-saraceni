-- 0024 — `fact_periodo.pago_iva` no es lo que se pagó, es lo que se debe
-- ============================================================================
-- La columna nació pensando que Nico iba a escribir lo que le transfirió a la
-- AFIP. No es así: el IVA del mes sale solo de las facturas, porque el débito
-- fiscal nace con la factura y no con el cobro. Septiembre facturó 9,2 millones
-- y cobró 6,6, y se le debe a la AFIP el IVA de los 9,2 igual.
--
-- Entonces la pantalla ya no pide ese número: lo calcula. La columna queda para
-- el caso en que el IVA a pagar de verdad sea otro —crédito fiscal del mes,
-- retenciones ya sufridas— y haya que corregirlo a mano. En null significa
-- "usá el de las facturas".
--
-- Solo se corrige el comentario. Renombrarla pediría tocar la capa de datos
-- para no ganar nada, y el nombre viejo no hace daño mientras diga lo que es.
-- ============================================================================

comment on column public.fact_periodo.pago_iva is
  'IVA a pagar del mes, SOLO si hay que corregir el que sale de las facturas. En null, la pantalla usa la suma del IVA facturado.';
