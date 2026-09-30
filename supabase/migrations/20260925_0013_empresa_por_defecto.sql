-- 0013 — Cuál es "la empresa de casa"
-- ============================================================================
-- La 0011 definió la empresa por defecto como la más vieja de la base. Suena
-- razonable y es falso: en la base de test la más vieja es Aicardi, que se
-- creó para probar el aislamiento. Con esa regla, una denuncia que llega sin
-- decir de qué empresa es —el `/denuncia` de siempre— caería en el broker
-- equivocado, y los archivos viejos del bucket quedarían a nombre de otro.
--
-- La regla correcta es: la empresa ACTIVA más vieja. Un cliente en prueba
-- nunca es la empresa de casa.
-- ============================================================================
create or replace function public.org_defecto() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.organizaciones
   where estado in ('activa', 'prueba')
   order by (estado = 'activa') desc, created_at, id
   limit 1;
$$;

comment on function public.org_defecto() is 'La empresa activa más vieja: la del broker original. Sostiene los formularios públicos que todavía no dicen de qué empresa son y los archivos subidos antes de la 0012.';
