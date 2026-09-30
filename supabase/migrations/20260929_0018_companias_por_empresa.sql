-- 0018 — Cada broker con sus compañías
-- ============================================================================
-- La lista de compañías estaba clavada en `data.jsx`: son las siete con las que
-- trabaja Saraceni. Aicardi abre el portal, va a cargar un siniestro y el
-- desplegable le ofrece las compañías de otro broker. Es lo primero que se ve
-- al usarlo, y no hay forma de arreglarlo sin tocar el código.
--
-- `siniestros.cia` es texto libre y nunca tuvo CHECK, así que esto es un
-- maestro de conveniencia: no rompe ningún dato viejo. `ciaLabel()` ya mostraba
-- la clave cruda cuando no la conocía.
--
-- Por qué una tabla nueva y no `fact_companias`: esa es de Facturación (razón
-- social, CUIT, banco) y vive detrás del módulo de facturación, que Aicardi no
-- compró. Una lista de con quién trabajás no puede depender de si comprás el
-- módulo de facturar.
-- ============================================================================

create table if not exists public.companias (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizaciones(id) on delete restrict
             default coalesce(public.org_actual(), public.org_defecto()),
  clave      text not null,          -- lo que se guarda en siniestros.cia
  nombre     text not null,          -- cómo se muestra
  orden      int  not null default 0,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Una clave por empresa, sin importar mayúsculas: "Sancor" y "SANCOR" son la
-- misma compañía y tenerlas dos veces ensucia todos los filtros.
create unique index if not exists companias_clave_unica on public.companias (org_id, upper(clave));
create index if not exists companias_org_idx on public.companias (org_id, orden);

alter table public.companias enable row level security;

-- Leer, cualquiera activo de la empresa: sin la lista no se puede cargar un
-- siniestro. Escribir, solo el organizador: es un maestro, no un dato del día.
drop policy if exists companias_org_select on public.companias;
drop policy if exists companias_org_insert on public.companias;
drop policy if exists companias_org_update on public.companias;
drop policy if exists companias_org_delete on public.companias;
create policy companias_org_select on public.companias for select to authenticated
  using (org_id = (select public.org_actual()) and public.es_activo());
create policy companias_org_insert on public.companias for insert to authenticated
  with check (org_id = (select public.org_actual()) and public.es_organizador());
create policy companias_org_update on public.companias for update to authenticated
  using  (org_id = (select public.org_actual()) and public.es_organizador())
  with check (org_id = (select public.org_actual()) and public.es_organizador());
create policy companias_org_delete on public.companias for delete to authenticated
  using (org_id = (select public.org_actual()) and public.es_organizador());

-- ─── La lista con la que arranca un broker nuevo ────────────────────────────
-- Las compañías más comunes del mercado argentino. NO es la lista de nadie en
-- particular: es un punto de partida para que el portal sirva desde el primer
-- día, y cada broker la recorta y la completa desde Ajustes. Vive acá y no en
-- el código para que dar de alta una empresa sea una sola llamada.
create or replace function public.sembrar_companias(p_org uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_n integer := 0;
  v_lista text[][] := array[
    ['SANCOR',         'Sancor Seguros'],
    ['FEDERACION',     'Federación Patronal'],
    ['LMA',            'La Mercantil Andina'],
    ['PROVINCIA',      'Provincia Seguros'],
    ['SAN CRISTOBAL',  'San Cristóbal'],
    ['LA SEGUNDA',     'La Segunda'],
    ['RIVADAVIA',      'Rivadavia Seguros'],
    ['RUS',            'Río Uruguay Seguros'],
    ['ALLIANZ',        'Allianz'],
    ['ZURICH',         'Zurich'],
    ['MAPFRE',         'Mapfre'],
    ['BERKLEY',        'Berkley International'],
    ['CHUBB',          'Chubb'],
    ['EXPERTA',        'Experta Seguros'],
    ['INTEGRITY',      'Integrity Seguros'],
    ['TRIUNFO',        'Triunfo Seguros'],
    ['ORBIS',          'Orbis Seguros'],
    ['NACION',         'Nación Seguros']
  ];
  i integer;
begin
  if p_org is null then return 0; end if;
  for i in 1 .. array_length(v_lista, 1) loop
    insert into public.companias (org_id, clave, nombre, orden)
    values (p_org, v_lista[i][1], v_lista[i][2], i * 10)
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.sembrar_companias(uuid) from public, anon, authenticated;

-- ─── Las que ya existen ─────────────────────────────────────────────────────
do $$
declare
  v_casa uuid := public.org_defecto();
  o record;
begin
  -- La empresa de casa conserva sus siete, con las mismas claves que ya tienen
  -- escritas los siniestros cargados.
  if v_casa is not null then
    insert into public.companias (org_id, clave, nombre, orden) values
      (v_casa, 'LMA',           'La Mercantil Andina', 10),
      (v_casa, 'PROVINCIA',     'Provincia Seguros',   20),
      (v_casa, 'ALLIANZ',       'Allianz',             30),
      (v_casa, 'SANCOR',        'Sancor Seguros',      40),
      (v_casa, 'FEDERACION',    'Federación Patronal', 50),
      (v_casa, 'SAN CRISTOBAL', 'San Cristóbal',       60),
      (v_casa, 'ZURICH',        'Zurich',              70)
    on conflict do nothing;
  end if;

  -- El resto arranca con la lista del mercado, para editar.
  for o in select id from public.organizaciones where id is distinct from v_casa loop
    perform public.sembrar_companias(o.id);
  end loop;
end $$;

comment on table public.companias is 'Con que companias trabaja cada broker. Maestro de conveniencia: siniestros.cia es texto libre.';
