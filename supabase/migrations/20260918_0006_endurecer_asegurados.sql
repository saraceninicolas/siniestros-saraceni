-- Avisos de seguridad que dejaron las migraciones 0004 y 0005
-- ============================================================================
-- Revisados uno por uno con el linter de Supabase. Lo que se corrige acá:
--
-- 1. search_path fijo en los tres normalizadores. Sin eso, quien llama a la
--    función puede cambiar qué `translate` o `regexp_replace` termina
--    ejecutando. Van con search_path vacío: todo lo que usan vive en
--    pg_catalog, que Postgres busca siempre igual.
--    Se usa ALTER y no CREATE OR REPLACE a propósito: las dos columnas
--    generadas de `asegurados` dependen de estas funciones y así no se toca
--    el cuerpo.
--
-- 2. `fuzzystrmatch` y `unaccent` se van. Se instalaron para medir la regla
--    del 90% y comparar métodos, pero ninguna función del portal las usa
--    (las tildes se sacan con translate() porque unaccent no es IMMUTABLE).
--    Verificado contra el cuerpo de todas las funciones antes de borrarlas.
--
-- 3. `anon` ya no puede ejecutar es_activo() ni es_organizador(). Solo las
--    necesitan las policies de usuarios logueados; las tres policies de anon
--    (insertar denuncia, cotización y archivos) no las llaman —verificado en
--    pg_policies—. `authenticated` las conserva: sin eso RLS deja al portal
--    entero sin acceso.
--
-- Lo que NO se toca, y por qué:
--   · pg_trgm en el esquema public: la usan el índice y las funciones de
--     duplicados. Moverla a `extensions` es un cambio coordinado que conviene
--     hacer junto con pg_net, que ya estaba en public antes de todo esto.
--   · El aviso de funciones `security definer` ejecutables por authenticated:
--     las cinco de asegurados SON la API a propósito, y cada una chequea
--     es_activo() o es_organizador() adentro. Probado con un usuario empleado.
-- ============================================================================

alter function public.doc_normalizado(text)    set search_path = '';
alter function public.nombre_normalizado(text) set search_path = '';
alter function public.cuit_valido(text)        set search_path = '';

drop extension if exists fuzzystrmatch;
drop extension if exists unaccent;

revoke execute on function public.es_activo()      from public, anon;
revoke execute on function public.es_organizador() from public, anon;
grant  execute on function public.es_activo()      to authenticated;
grant  execute on function public.es_organizador() to authenticated;
