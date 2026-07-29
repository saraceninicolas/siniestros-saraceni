-- ============================================================================
-- Saraceni Seguros · RBAC + Notificaciones (referencia de lo aplicado en la BD)
-- ----------------------------------------------------------------------------
-- ROLES
--   organizador → administra todo: Facturación, Objetivos, Usuarios y roles,
--                 baja definitiva de registros.
--   empleado    → opera Siniestros, Solicitudes y Pendientes.
-- ALTAS
--   El registro es abierto (email real + contraseña o confirmación por email),
--   pero toda cuenta nueva queda estado='pendiente' SIN acceso a ningún dato
--   hasta que un organizador la apruebe desde Administración → Usuarios.
-- NOTIFICACIONES
--   In-app (campana del topbar, tiempo real) + email vía Edge Function
--   `enviar-notificaciones` (Resend). Sin RESEND_API_KEY configurada, los
--   emails se marcan 'omitido' y queda solo la notificación in-app.
--   Eventos: asignación de siniestro/tarea, nueva denuncia web (organizadores),
--   vencimientos del día (cron 09:00 AR).
-- ============================================================================

-- ─── PERFILES ───────────────────────────────────────────────────────────────
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  nombre     text,
  rol        text not null default 'empleado'  check (rol in ('organizador','empleado')),
  estado     text not null default 'pendiente' check (estado in ('pendiente','activo','suspendido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.perfiles enable row level security;

-- Alta automática al registrarse (queda pendiente de aprobación)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'nombre',''), initcap(replace(split_part(new.email,'@',1),'.',' '))))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de rol (security definer: sin recursión de RLS)
create or replace function public.es_activo() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfiles where id = auth.uid() and estado = 'activo') $$;
create or replace function public.es_organizador() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.perfiles where id = auth.uid() and estado = 'activo' and rol = 'organizador') $$;

-- RLS perfiles
create policy "perfiles_select"     on public.perfiles for select to authenticated using (id = auth.uid() or public.es_activo());
create policy "perfiles_org_update" on public.perfiles for update to authenticated using (public.es_organizador()) with check (public.es_organizador());
create policy "perfiles_org_delete" on public.perfiles for delete to authenticated using (public.es_organizador());

-- ─── ASIGNACIÓN ─────────────────────────────────────────────────────────────
alter table public.siniestros add column if not exists asignado_a uuid references public.perfiles(id) on delete set null;
alter table public.pendientes add column if not exists asignado_a uuid references public.perfiles(id) on delete set null;

-- ─── RLS POR ROL ────────────────────────────────────────────────────────────
-- Operativas: select/insert/update para activos, delete solo organizador.
--   siniestros_activo_select / _insert / _update + siniestros_org_delete
--   pendientes_activo_select / _insert / _update + pendientes_org_delete
--   solicitudes_activo_select / _update + solicitudes_org_delete (+ anon insert)
-- Administrativas: for all solo organizador.
--   facturas_org_all · objetivos_org_all · renovaciones_org_all
-- Storage: adjuntos_activo_all (bucket adjuntos) · solicitudes_files_activo_all
--   (bucket solicitudes) — ambos exigen es_activo().

-- ─── NOTIFICACIONES ─────────────────────────────────────────────────────────
create table if not exists public.notificaciones (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null references public.perfiles(id) on delete cascade,
  tipo         text not null,                    -- asignacion | vencimiento | solicitud | sistema
  titulo       text not null,
  cuerpo       text,
  modulo       text,                             -- key de navegación del portal
  referencia   text,                             -- STR-xx / PEN-xx / SOL-xx
  leida        boolean not null default false,
  email_estado text not null default 'pendiente',-- pendiente | enviado | omitido | error
  created_at   timestamptz not null default now()
);
alter table public.notificaciones enable row level security;
-- Cada usuario lee y marca solo las suyas; las crean únicamente los triggers.
create policy "notif_own_select" on public.notificaciones for select to authenticated using (usuario_id = auth.uid() and public.es_activo());
create policy "notif_own_update" on public.notificaciones for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Triggers (security definer):
--   notif_siniestro_asignado  → aviso al asignado cuando cambia asignado_a
--   notif_pendiente_asignado  → ídem para tareas
--   notif_solicitud_nueva     → nueva denuncia web avisa a los organizadores
-- Función public.generar_avisos_vencimientos() → avisos de gestiones/tareas
--   vencidas o que vencen hoy (al asignado, o a todos los activos si no hay).

-- ─── CRON (pg_cron + pg_net) ────────────────────────────────────────────────
-- 'avisos-vencimientos-diario'  0 12 * * *   → generar_avisos_vencimientos()
-- 'despacho-emails'             */10 * * * * → despachar_emails(): si hay
--   notificaciones con email pendiente, invoca la Edge Function
--   enviar-notificaciones (envía por Resend y marca enviado/omitido/error).
--
-- Para activar los emails reales: Supabase → Edge Functions → Secrets →
--   RESEND_API_KEY = (clave de resend.com)
--   EMAIL_FROM     = "Portal Saraceni <avisos@tudominio.com>"  (opcional)

-- ─── TIEMPO REAL ────────────────────────────────────────────────────────────
-- supabase_realtime incluye: perfiles, notificaciones (además de las previas).
