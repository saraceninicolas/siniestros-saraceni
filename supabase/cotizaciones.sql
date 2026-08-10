-- ============================================================================
-- Saraceni Seguros · Cotizaciones de seguro de hogar (módulo COMERCIAL)
-- ----------------------------------------------------------------------------
-- Página pública: /cotizar-hogar (cotizar-hogar.html) — sin login.
-- Seguridad: mismo patrón que `solicitudes`. El rol anon SOLO puede INSERTAR;
-- no puede leer nada (ni sus propias filas). El portal (cualquier usuario
-- activo, organizador o empleado) lee, cotiza y cierra el pedido.
-- ============================================================================
create table if not exists public.cotizaciones (
  id                bigint generated always as identity primary key,
  ref               text not null default upper(substr(md5(random()::text),1,6)),
  ramo              text not null default 'HOGAR',
  -- contacto
  nombre            text not null,
  documento         text,
  telefono          text,
  email             text,
  -- domicilio a asegurar
  direccion         text,
  codigo_postal     text,
  localidad         text,
  tipo_vivienda     text,                       -- Casa | Departamento
  piso              text,                       -- solo si es departamento
  en_country        boolean,                    -- solo si es casa (vallado perimetral)
  tiene_pileta      boolean,                    -- solo si es casa (riesgo de RC)
  metros2           numeric,
  -- medidas de seguridad (casa y departamento)
  alarma            boolean not null default false,
  rejas             boolean not null default false,
  -- coberturas pedidas (casillas del formulario)
  equipos_fuera     boolean,                    -- equipos que salen del hogar
  equipos_fuera_detalle   text,                 -- marca, modelo y valor de cada uno (obligatorio si se tilda)
  bicicleta         boolean,
  bicicleta_marca   text,                       -- marca/modelo/valor obligatorios si se tilda
  bicicleta_modelo  text,
  bicicleta_valor   numeric,
  robo_celular      boolean not null default false,
  valor_electrodomesticos numeric,              -- ya NO se pide en el formulario (se quitó a pedido)
  observaciones     text,
  -- seguimiento interno
  estado            text not null default 'nueva',  -- nueva | cotizada | descartada
  notas_internas    text,
  gestionada_por    text,
  created_at        timestamptz not null default now()
);
create index if not exists cotizaciones_estado_idx on public.cotizaciones (estado, created_at desc);

alter table public.cotizaciones enable row level security;

-- El público solo inserta su propio pedido (nunca lee)
create policy "cotizaciones_anon_insert" on public.cotizaciones
  for insert to anon with check (true);

-- El portal: gestiona cualquier usuario activo; borrar solo el organizador
create policy "cotizaciones_activo_select" on public.cotizaciones
  for select to authenticated using (public.es_activo());
create policy "cotizaciones_activo_update" on public.cotizaciones
  for update to authenticated using (public.es_activo()) with check (public.es_activo());
create policy "cotizaciones_activo_insert" on public.cotizaciones
  for insert to authenticated with check (public.es_activo());
create policy "cotizaciones_org_delete" on public.cotizaciones
  for delete to authenticated using (public.es_organizador());

-- Aviso in-app a todos los usuarios activos cuando entra un pedido nuevo
-- (función public.notificar y tipos de notificación en roles_notificaciones.sql)
create or replace function public.trg_notif_cotizacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  for u in select id from public.perfiles where estado = 'activo' loop
    perform public.notificar(u.id, 'cotizacion',
      'Nueva cotización de hogar: ' || coalesce(new.nombre,'un interesado'),
      'Ref ' || new.ref || coalesce(' · ' || nullif(new.localidad,''), '') ||
        coalesce(' · ' || nullif(new.telefono,''), ''),
      'com-cotizaciones', 'COT-' || lpad(new.id::text, 4, '0'));
  end loop;
  return new;
end $$;
create trigger notif_cotizacion_nueva after insert on public.cotizaciones
  for each row execute function public.trg_notif_cotizacion();

-- Tiempo real (badge del menú + bandeja en vivo)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cotizaciones') then
    alter publication supabase_realtime add table public.cotizaciones;
  end if;
end $$;
