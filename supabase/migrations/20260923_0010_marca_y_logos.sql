-- Configuración de marca: cada broker edita sus colores y sube su logo
-- ============================================================================
-- Hasta acá la marca de una empresa solo la podía tocar quien entrara a la
-- base. Esto habilita la pantalla de Configuración del portal, con dos
-- cuidados:
--
-- 1. SOLO LA COLUMNA `marca`. Un organizador de un broker no tiene por qué
--    poder cambiar el nombre de su empresa, su slug (que es su dirección
--    pública) ni su estado (activa / suspendida): eso lo decide el portal de
--    administración. RLS filtra POR FILA, no por columna, así que el límite se
--    pone con privilegios de columna: se revoca el update entero y se concede
--    solo sobre `marca` y `updated_at`.
--
-- 2. LOS LOGOS VAN EN SU PROPIA CARPETA. El bucket `marcas` guarda cada uno en
--    `<org_id>/…`, y la policy exige que esa primera carpeta sea la empresa de
--    quien sube. Sin eso, un broker podría pisar el logo de otro.
--    El bucket es público a propósito: un logo institucional no es un secreto,
--    y las URLs firmadas vencen, lo que rompería el logo del menú cada hora.
-- ============================================================================

-- ─── La empresa edita su marca ──────────────────────────────────────────────
drop policy if exists org_marca_update on public.organizaciones;
create policy org_marca_update on public.organizaciones
  for update to authenticated
  using (id = (select public.org_actual()) and public.es_organizador())
  with check (id = (select public.org_actual()) and public.es_organizador());

revoke update on public.organizaciones from authenticated;
grant  update (marca, updated_at) on public.organizaciones to authenticated;

-- ─── Los logos ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('marcas', 'marcas', true)
on conflict (id) do nothing;

drop policy if exists "marcas lectura publica"        on storage.objects;
drop policy if exists "marcas sube el organizador"    on storage.objects;
drop policy if exists "marcas cambia el organizador"  on storage.objects;
drop policy if exists "marcas borra el organizador"   on storage.objects;

create policy "marcas lectura publica" on storage.objects
  for select using (bucket_id = 'marcas');

create policy "marcas sube el organizador" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = (select public.org_actual())::text
    and public.es_organizador());

create policy "marcas cambia el organizador" on storage.objects
  for update to authenticated using (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = (select public.org_actual())::text
    and public.es_organizador());

create policy "marcas borra el organizador" on storage.objects
  for delete to authenticated using (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = (select public.org_actual())::text
    and public.es_organizador());

comment on column public.organizaciones.marca is
  'Colores y logo que elige el broker desde Configuración: {color, menu, menuColor, logo}';
