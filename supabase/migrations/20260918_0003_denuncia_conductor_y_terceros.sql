-- Datos nuevos que pide el formulario público de denuncia.
--
-- CONDUCTOR: hasta ahora se asumía que manejaba el asegurado. Cuando no es
-- así, la compañía pide los datos y el registro de quien iba al volante, y sin
-- eso la gestión se traba desde el arranque. Son columnas y no jsonb porque es
-- siempre una sola persona y se van a querer buscar y mostrar en la bandeja.
--
-- TERCEROS_EXTRA: en un choque múltiple hay más de un tercero. El primero
-- sigue en las columnas `tercero_*` que ya existían —con sus datos completos
-- de póliza, que es lo que hace falta para reclamar— y del segundo en adelante
-- alcanza con identificarlos. Va como jsonb porque son 0..N y no tiene sentido
-- inventar tercero2_nombre, tercero3_nombre, etc.
--   forma: [{"nombre": "...", "dni": "..."}, ...]

alter table public.solicitudes
  add column if not exists conductor_distinto boolean not null default false,
  add column if not exists conductor_nombre   text,
  add column if not exists conductor_dni      text,
  add column if not exists terceros_extra     jsonb not null default '[]'::jsonb;

comment on column public.solicitudes.conductor_distinto is
  'true si al volante iba alguien que no es el asegurado';
comment on column public.solicitudes.terceros_extra is
  'Terceros adicionales al principal: [{nombre, dni}]. El primero va en tercero_*';
