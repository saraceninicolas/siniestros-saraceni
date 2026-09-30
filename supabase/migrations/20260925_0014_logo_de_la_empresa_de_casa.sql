-- 0014 — El logo del broker original, guardado como dato
-- ============================================================================
-- El formulario público de denuncia dejó de tener un logo clavado en el HTML:
-- ahora muestra el de la empresa a la que le está escribiendo, y si esa empresa
-- no cargó ninguno muestra su nombre escrito. Nunca el logo de OTRO broker, que
-- es lo que pasaría si el archivo del repositorio quedara como respaldo.
--
-- El efecto secundario es que la empresa de casa, que nunca pasó por Ajustes,
-- perdería su logo de siempre. Así que se lo dejamos puesto como dato: el
-- archivo sigue estando en el repositorio y la ruta relativa funciona igual.
-- Desde Ajustes lo puede cambiar cuando quiera.
-- ============================================================================
update public.organizaciones o
   set marca = coalesce(o.marca, '{}'::jsonb) || jsonb_build_object('logo', '/assets/saraceni-logo.jpg'),
       updated_at = now()
 where o.id = public.org_defecto()
   and coalesce(o.marca->>'logo', '') = '';
