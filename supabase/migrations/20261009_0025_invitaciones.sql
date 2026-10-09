-- 0025 — La invitacion: como entra el PRIMER usuario de un broker nuevo
-- ============================================================================
-- Hasta hoy una cuenta nueva nace `pendiente` y la aprueba un organizador de
-- su misma empresa. Eso funciona para el segundo empleado en adelante, pero
-- deja al primero encerrado: una empresa recien creada no tiene organizadores,
-- asi que no hay nadie con permiso para aprobarlo. Pasó con Aicardi, y va a
-- pasar con cada broker que se venda.
--
-- La salida no es relajar la aprobacion —eso abriria la puerta a cualquiera
-- que adivine el slug— sino decidir ANTES quien puede entrar: se deja anotado
-- el mail, y el que se registra con ese mail exacto nace adentro y con el rol
-- que se le dejó escrito.
--
-- Lo que hace segura a la invitacion es que el proyecto exige confirmar el
-- mail (`mailer_autoconfirm` en false, verificado en produccion el 2026-10-09):
-- sin acceso a esa casilla no hay sesion, por mas que el perfil nazca activo.
-- ⚠️ Si algun dia se desactiva esa confirmacion, una invitacion pasa a ser una
-- llave que abre con solo escribir la direccion de otro.
-- ============================================================================

-- ─── A. La tabla ────────────────────────────────────────────────────────────
create table if not exists public.invitaciones (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizaciones(id) on delete cascade,
  email        text not null,
  rol          text not null default 'empleado' check (rol in ('organizador','empleado')),
  estado       text not null default 'pendiente' check (estado in ('pendiente','usada','anulada')),
  invitado_por uuid references public.perfiles(id) on delete set null,
  usada_por    uuid references public.perfiles(id) on delete set null,
  usada_at     timestamptz,
  created_at   timestamptz not null default now()
);

comment on table public.invitaciones is
  'Quien puede entrar a una empresa y con que rol, decidido antes de que se registre. Resuelve el primer usuario de un broker nuevo, que no tiene quien lo apruebe.';

-- Dos invitaciones pendientes para el mismo mail serian dos respuestas a la
-- pregunta "a que empresa entra": el indice parcial deja que convivan la usada
-- de ayer y la pendiente de hoy, pero no dos pendientes a la vez.
create unique index if not exists invitaciones_pendiente_unica
  on public.invitaciones (lower(email))
  where estado = 'pendiente';

create index if not exists invitaciones_org_idx on public.invitaciones (org_id);

-- ─── B. RLS ─────────────────────────────────────────────────────────────────
-- Una invitacion con rol organizador es una llave de la empresa: la ve y la
-- escribe solo un organizador activo, y solo las de SU empresa.
alter table public.invitaciones enable row level security;

drop policy if exists invitaciones_select on public.invitaciones;
create policy invitaciones_select on public.invitaciones
  for select to authenticated
  using (public.es_organizador() and org_id = (select public.org_actual()));

drop policy if exists invitaciones_insert on public.invitaciones;
create policy invitaciones_insert on public.invitaciones
  for insert to authenticated
  with check (public.es_organizador() and org_id = (select public.org_actual()));

drop policy if exists invitaciones_update on public.invitaciones;
create policy invitaciones_update on public.invitaciones
  for update to authenticated
  using (public.es_organizador() and org_id = (select public.org_actual()))
  with check (public.es_organizador() and org_id = (select public.org_actual()));

drop policy if exists invitaciones_delete on public.invitaciones;
create policy invitaciones_delete on public.invitaciones
  for delete to authenticated
  using (public.es_organizador() and org_id = (select public.org_actual()));

-- ─── C. El alta de una cuenta mira la invitacion ────────────────────────────
-- Cambia respecto de la version anterior: si hay invitacion, ella decide la
-- empresa, el rol y que la cuenta nazca activa. El slug de la direccion por la
-- que entro deja de importar —si el invitado se registra por `/` en vez de
-- `/<su-empresa>`, cae igual donde lo invitaron—, porque un error de tipeo no
-- deberia mandarlo a la empresa equivocada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug   text := nullif(new.raw_user_meta_data->>'org_slug', '');
  v_org    uuid;
  v_inv    public.invitaciones%rowtype;
  v_rol    text := 'empleado';
  v_estado text := 'pendiente';
begin
  select * into v_inv
    from public.invitaciones
   where lower(email) = lower(new.email)
     and estado = 'pendiente'
   limit 1;

  if v_inv.id is not null then
    v_org    := v_inv.org_id;
    v_rol    := v_inv.rol;
    v_estado := 'activo';
  else
    select id into v_org from public.organizaciones
     where slug = lower(v_slug) and estado in ('activa','prueba');
    if v_org is null then v_org := public.org_defecto(); end if;
  end if;

  insert into public.perfiles (id, email, nombre, rol, estado)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'nombre',''),
                   initcap(replace(split_part(new.email,'@',1),'.',' '))),
          v_rol, v_estado)
  on conflict (id) do nothing;

  if v_org is not null then
    insert into public.membresias (usuario_id, org_id, rol, estado)
    values (new.id, v_org, v_rol, v_estado)
    on conflict (usuario_id, org_id) do nothing;
  end if;

  if v_inv.id is not null then
    update public.invitaciones
       set estado = 'usada', usada_por = new.id, usada_at = now()
     where id = v_inv.id;
  end if;

  return new;
end $function$;
