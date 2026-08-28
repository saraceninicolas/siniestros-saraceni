-- ============================================================================
-- Saraceni Seguros · Denuncias online de asegurados (buzón público)
-- ----------------------------------------------------------------------------
-- Página pública: /denuncia (denuncia.html) — sin login.
-- Seguridad: el rol público (anon) SOLO puede INSERTAR solicitudes y SUBIR
-- archivos al bucket 'solicitudes'. No puede leer nada (ni sus propias filas).
-- El portal (usuarios autenticados) lee, procesa y convierte en siniestros.
-- ============================================================================
create table if not exists public.solicitudes (
  id               bigint generated always as identity primary key,
  ref              text not null default upper(substr(md5(random()::text),1,6)),
  nombre           text not null,
  dni_cuit         text,
  telefono         text,
  email            text,
  cia              text,                             -- compañía declarada por el asegurado
  poliza           text,
  dominio          text,                             -- patente / bien del asegurado
  ramo             text,                             -- AUTO | HOGAR | ICO | INT_CONSORCIO | VIDA (para AUTO: patente, ubicacion y localidad son obligatorios en el formulario)
  tercero_nombre   text,                             -- datos del tercero (si corresponde)
  tercero_dni      text,
  tercero_celular  text,
  tercero_dominio  text,
  tercero_cia      text,
  tercero_poliza   text,
  fecha_hecho      date,
  hora_hecho       text,
  ubicacion        text,
  localidad        text,
  tipo_siniestro   text,                             -- CHOQUE | CRISTALES | ROBO_RUEDAS | ROBO | AGUA | … (define qué fotos se piden)
  lesionados       text,                             -- 'SI' | 'NO' | null
  relato           text,
  adjuntos         jsonb not null default '[]'::jsonb, -- [{name, path, tipo, size, etiqueta}] etiqueta = qué foto es
  estado           text not null default 'nueva',    -- nueva | procesada | descartada
  siniestro_codigo text,                             -- STR-xx al convertirla
  procesada_por    text,
  created_at       timestamptz not null default now()
);

alter table public.solicitudes enable row level security;
drop policy if exists "solicitudes_anon_insert" on public.solicitudes;
create policy "solicitudes_anon_insert" on public.solicitudes
  for insert to anon with check (true);
drop policy if exists "solicitudes_auth_all" on public.solicitudes;
create policy "solicitudes_auth_all" on public.solicitudes
  for all to authenticated using (true) with check (true);

-- Bucket para la documentación (10MB por archivo, fotos y PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solicitudes', 'solicitudes', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "solicitudes_files_anon_insert" on storage.objects;
create policy "solicitudes_files_anon_insert" on storage.objects
  for insert to anon with check (bucket_id = 'solicitudes');
drop policy if exists "solicitudes_files_auth_all" on storage.objects;
create policy "solicitudes_files_auth_all" on storage.objects
  for all to authenticated using (bucket_id = 'solicitudes') with check (bucket_id = 'solicitudes');

-- Tiempo real (notificación en el portal)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='solicitudes') then
    alter publication supabase_realtime add table public.solicitudes;
  end if;
end $$;

-- Nota: además de `solicitudes_anon_insert` (público), hace falta
-- `solicitudes_activo_insert` para los usuarios logueados del portal; si no,
-- cargar una denuncia desde la oficina con la sesión abierta da error de RLS.
