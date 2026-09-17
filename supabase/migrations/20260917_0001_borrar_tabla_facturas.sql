-- Borra la tabla `facturas`, que quedó muerta.
--
-- Facturación se rehizo en dos tablas —`fact_companias` (los datos fijos de
-- cada compañía) y `fact_mensual` (los importes de cada mes)— y esta quedó
-- sin uso. Verificado antes de borrar:
--   · 0 filas
--   · 0 referencias en todo el código del portal
--   · 0 claves foráneas de otras tablas apuntándole
--
-- Se borra ahora y no después porque el próximo paso es agregar `org_id` a
-- cada tabla: no tiene sentido arrastrar peso muerto a multi-tenant.

drop table if exists public.facturas;
