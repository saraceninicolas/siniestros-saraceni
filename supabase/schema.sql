-- ============================================================================
-- Saraceni Seguros · Portal de Siniestros — Esquema Supabase
-- ----------------------------------------------------------------------------
-- Cómo usarlo:
--   1. Entrá a tu proyecto en https://supabase.com
--   2. Menú izquierdo → SQL Editor → New query
--   3. Pegá TODO este archivo y presioná "Run".
-- Es seguro correrlo más de una vez (usa IF NOT EXISTS y ON CONFLICT).
-- ============================================================================

-- ---- Tabla principal -------------------------------------------------------
create table if not exists public.siniestros (
  id                bigint generated always as identity primary key,
  codigo            text unique not null,            -- ej: STR-01 (se muestra en la app)
  n                 integer not null,                -- orden / numerador
  estado            text not null default 'Abierto', -- Abierto | Terminado
  cliente           text not null,
  cia               text,                            -- compañía (LMA, PROVINCIA, ALLIANZ, ...)
  ramo              text,                            -- AUTO | HOGAR | ICO | COMERCIO | VIDA
  hecho             text,
  cobertura         text,
  poliza            text,
  nro_siniestro     text,
  fecha_ocurrido    date,
  fecha_denuncia    date,
  fecha_limite      date,                            -- fecha límite de respuesta
  fecha_inspeccion  date,
  gestion_ar        text,                            -- gestión a realizar (próximo paso)
  gestion_real      text,                            -- última gestión realizada
  gestor            text,                            -- gestor de la compañía
  gestor_email      text,
  obs               text,
  ticket            text,
  en_calendario     boolean not null default false,
  ultima_mod_por    text,
  ultima_mod_fecha  timestamptz not null default now(),
  eliminado         boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists siniestros_n_idx on public.siniestros (n);
create index if not exists siniestros_eliminado_idx on public.siniestros (eliminado);

-- ---- Seguridad (RLS) -------------------------------------------------------
-- El portal es de uso interno y SIN login (puesto compartido), por lo que usa
-- la clave pública "anon". Esta política permite leer/escribir con esa clave.
--
-- ⚠️  Cualquiera que conozca la URL del sitio podría leer/editar los datos.
--     Para un uso real recomendado, ver la sección "Seguridad" del README
--     (proteger el sitio con contraseña en Vercel, o agregar login Supabase).
alter table public.siniestros enable row level security;

drop policy if exists "acceso anon portal" on public.siniestros;
create policy "acceso anon portal"
  on public.siniestros
  for all
  to anon
  using (true)
  with check (true);

-- ============================================================================
-- Carga inicial — 12 siniestros reales (planilla SEGUIMIENTO)
-- ON CONFLICT (codigo) DO NOTHING → no duplica si ya existen.
-- Las fechas "última modificación" se siembran relativas a hoy.
-- ============================================================================
insert into public.siniestros
  (codigo, n, estado, cliente, cia, ramo, hecho, cobertura, poliza, nro_siniestro,
   fecha_ocurrido, fecha_denuncia, fecha_limite, fecha_inspeccion,
   gestion_ar, gestion_real, gestor, gestor_email, obs, ticket, en_calendario,
   ultima_mod_por, ultima_mod_fecha)
values
  ('STR-01', 1, 'Abierto', 'SARACENI VERONICA', 'LMA', 'AUTO', 'DAÑO PARCIAL', 'M PLUS', '516208977', '501032421224',
   '2026-06-01','2026-06-02','2026-06-08', null,
   'Rilla: reclamar línea de colectivo', 'Denuncia en LMA y Rilla para demandar', 'Coca, Julieta', 'julieta.coca@lamercantil.com.ar',
   'Choque colectivo, espejo y lateral derecho', null, true, 'PC_OFICINA_2', now() - interval '0 days'),

  ('STR-02', 2, 'Abierto', 'ONLY GAVIOTAS', 'LMA', 'AUTO', 'DAÑO PARCIAL', 'TR 2%', '516755196', '501032421169',
   '2026-05-13','2026-05-15','2026-06-05','2026-05-15',
   'Responder ticket después de respuesta', 'Propuesta de LMA enviada a Alonso (indemnización)', 'Coca, Julieta', 'julieta.coca@lamercantil.com.ar',
   'Siniestro capó, carta franquicia pedida 1/6', 'https://mercantilandina.cloud.invgate.net/requests/show/index/id/313297', true, 'PC_OFICINA_1', now() - interval '1 days'),

  ('STR-03', 3, 'Abierto', 'PALOMEQUE FERNANDO', 'LMA', 'HOGAR', 'ROBO TOTAL', 'TR PORTATIL', '163221780', '1601032420027',
   '2026-05-13','2026-05-18','2026-06-08','2026-06-01',
   'Consultar a Fernando semana del 8', 'Gestor en contacto con el asegurado', 'Brian Rozza', 'brian.rozza@lamercantil.com.ar',
   'Notebook — robo total', 'https://mercantilandina.cloud.invgate.net/requests/show/index/id/313329', true, 'PC_OFICINA_2', now() - interval '1 days'),

  ('STR-04', 4, 'Abierto', 'TOTAL OBRAS SRL', 'LMA', 'AUTO', 'ROBO TOTAL', 'TR 4%', '516109137', '501032421162',
   '2026-05-13','2026-05-14','2026-06-08','2026-06-01',
   'Pedir status', 'Enviado a Micaela dato de gestor para iniciar baja', 'Gisela Perdiguero', 'gisela.perdiguero@lamercantil.com.ar',
   'Gestor asignado y comunicado', 'https://mercantilandina.cloud.invgate.net/requests/show/index/id/312149', true, 'PC_OFICINA_1', now() - interval '2 days'),

  ('STR-05', 5, 'Abierto', 'TOTAL OBRAS SRL', 'LMA', 'AUTO', 'DAÑO PARCIAL', 'TR 2%', '516109137', '501032421147',
   '2026-03-18','2026-05-11','2026-06-04','2026-06-01',
   'Consultar si realizaron inspección por taller', 'Inspección 4/6', 'Cristina Maciel', 'cristina.maciel@lamercantil.com.ar',
   'Espejo — LMA vs LMA', null, true, 'PC_OFICINA_2', now() - interval '2 days'),

  ('STR-06', 6, 'Abierto', 'CORDUA MARIA HAYDEE', 'PROVINCIA', 'AUTO', 'ROBO TOTAL', 'TC', '11003464', '2452484',
   '2026-04-29','2026-04-30','2026-06-08', null,
   'Preguntar cómo viene con gestor próxima semana', 'Gestor enviado a cliente para baja', 'Santoro, Agustina', 'santoroa@pseguros.com.ar',
   'Gestor comunicado con cliente', null, true, 'PC_OFICINA_1', now() - interval '3 days'),

  ('STR-07', 7, 'Abierto', 'MESSANO JULIAN', 'LMA', 'AUTO', 'DAÑO PARCIAL', 'TR 2%', '516873306', '501032421213',
   '2026-05-27','2026-05-29','2026-06-05', null,
   'Aguardar a la asegurada', null, 'Chacón, Grace', 'grace.chacon@lamercantil.com.ar',
   'Choque aeropuerto Vrtus — espera WhatsApp 29/05', null, false, 'PC_OFICINA_2', now() - interval '0 days'),

  ('STR-08', 8, 'Abierto', 'PREZZEMOLI', 'LMA', 'AUTO', 'ROBO TOTAL', 'TR 2%', '515789745', '501032420805',
   '2026-02-04','2026-02-05','2026-06-09', null,
   'Consultar status a Richard', 'Mensaje a gestora para ayudar a Richard', 'Gisela Perdiguero', 'gisela.perdiguero@lamercantil.com.ar',
   'La demora es por los CGPS', null, true, 'PC_OFICINA_1', now() - interval '4 days'),

  ('STR-09', 9, 'Abierto', 'DIEGO ALONSO', 'ALLIANZ', 'ICO', 'CRISTAL', 'CRISTAL', '260220740624', '2260233167',
   '2026-03-26','2026-05-28','2026-06-04','2026-05-29',
   'Enviar CBU y factura a Allianz para pago', 'Mail 2/6 pedido factura y CBU a Elisa', 'Zalazar, Eliana Desirée', 'eliana.zalazar@allianz.com.ar',
   'Vidrio roto — ubicación / siniestro demorado', null, true, 'PC_OFICINA_2', now() - interval '1 days'),

  ('STR-10', 10, 'Terminado', 'ONLY GAVIOTAS', 'LMA', 'AUTO', 'DAÑO PARCIAL', 'TR 2%', '516755196', '501032421182',
   '2026-05-20','2026-05-20', null, '2026-05-28',
   null, 'Carta de franquicia enviada — cerrado', 'Chacón, Grace', 'grace.chacon@lamercantil.com.ar',
   'Lateral. Carta franquicia enviada', null, false, 'PC_OFICINA_1', now() - interval '6 days'),

  ('STR-11', 11, 'Terminado', 'SIGNALS SOLUTIONS', 'ALLIANZ', 'COMERCIO', 'DAÑO PARCIAL', 'TC', '250040510835', '2260231183',
   '2026-05-08','2026-05-10', null, '2026-05-18',
   null, 'Siniestro cerrado y conformado', 'Mesa de Allianz', 'siniestros@allianz.com.ar',
   'Cerrado', null, false, 'PC_OFICINA_2', now() - interval '10 days'),

  ('STR-12', 12, 'Terminado', 'VILLAGOIZ HERNAN', 'LMA', 'AUTO', 'DAÑO PARCIAL', 'M PLUS', '516200730', '501032421171',
   '2026-05-15','2026-05-15', null, '2026-05-22',
   null, 'Reseña pedida y recibida — cerrado', 'Coca, Julieta', 'julieta.coca@lamercantil.com.ar',
   'Reseña pedida y recibida', null, false, 'PC_OFICINA_1', now() - interval '8 days')
on conflict (codigo) do nothing;
