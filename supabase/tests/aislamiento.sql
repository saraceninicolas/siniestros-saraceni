-- Prueba de aislamiento entre empresas — correr en TEST, nunca en producción
-- ============================================================================
-- El riesgo número uno del multiempresa es que un broker vea datos de otro.
-- No alcanza con leer las policies: ya se nos escapó una vez leyendo el SQL
-- (`solicitudes` quedó sin INSERT y nadie se enteró hasta que un cliente no
-- pudo denunciar). Esto se ejecuta.
--
-- Cómo se usa: pegarlo en el editor SQL de la base de TEST. Termina SIEMPRE
-- con un error a propósito, que es el informe: así, además, no deja nada
-- escrito aunque alguien agregue pasos que inserten.
--
-- Qué simula: `set local role authenticated` + el token que arma PostgREST con
-- el `org_id` adentro. Es exactamente lo que ve la base cuando entra alguien
-- del portal, sin necesidad de contraseñas.
--
-- Desde la 0011 las tablas del portal tienen dueño, así que acá se prueba lo
-- que de verdad importa: que un broker no vea NI un siniestro del otro.
-- ============================================================================

do $$
declare
  v_aic uuid := (select id from public.organizaciones where slug = 'aicardi');
  v_sar uuid := (select id from public.organizaciones where slug = 'saraceni');
  v_uid  uuid := (select m.usuario_id from public.membresias m
                    join public.perfiles p on p.id = m.usuario_id
                   where p.estado = 'activo' order by m.created_at limit 1);
  fallas text := '';
  ok     text := '';
  ver    text;
  n      bigint;
begin
  if v_aic is null or v_sar is null then
    raise exception 'Faltan las empresas de prueba (saraceni y aicardi) en esta base';
  end if;
  if v_uid is null then
    raise exception 'No hay ningún usuario activo con membresía para simular';
  end if;

  -- ── Como usuario de AICARDI ───────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_uid, 'app_metadata',
                      json_build_object('org_id', v_aic))::text, true);
  set local role authenticated;

  select string_agg(slug, ',') into ver from public.organizaciones;
  if ver is distinct from 'aicardi' then
    fallas := fallas || format('· Aicardi ve estas empresas: [%s]; solo debería verse a sí misma. ', coalesce(ver, 'ninguna'));
  else ok := ok || '· Aicardi solo se ve a sí misma. '; end if;

  select count(*) into n from public.suscripciones where org_id <> v_aic;
  if n > 0 then fallas := fallas || format('· Aicardi ve %s contratos ajenos. ', n);
  else ok := ok || '· No ve contratos ajenos. '; end if;

  select count(*) into n from public.membresias where org_id <> v_aic;
  if n > 0 then fallas := fallas || format('· Aicardi ve %s usuarios ajenos. ', n);
  else ok := ok || '· No ve usuarios ajenos. '; end if;

  select count(*) into n from public.cobros;
  if n > 0 then fallas := fallas || format('· Aicardi ve %s cobros; no debería ver ninguno. ', n);
  else ok := ok || '· No ve la facturación del SaaS. '; end if;

  -- Compró solo siniestros: el resto de los módulos tiene que dar falso.
  if not public.tiene_modulo('siniestros') then
    fallas := fallas || '· Aicardi NO tiene habilitado siniestros, que es lo que compró. ';
  else ok := ok || '· Tiene siniestros. '; end if;
  if public.tiene_modulo('renovaciones') or public.tiene_modulo('facturacion')
     or public.tiene_modulo('objetivos') or public.tiene_modulo('comercial') then
    fallas := fallas || '· Aicardi tiene habilitado un módulo que no compró. ';
  else ok := ok || '· No tiene los módulos que no compró. '; end if;

  -- ── Las tablas del portal: lo que de verdad importa ───────────────────────
  select count(*) into n from public.siniestros;
  if n > 0 then fallas := fallas || format('· Aicardi ve %s siniestros ajenos. ', n);
  else ok := ok || '· No ve ni un siniestro ajeno. '; end if;

  select count(*) into n from public.asegurados;
  if n > 0 then fallas := fallas || format('· Aicardi ve %s fichas de asegurado ajenas. ', n);
  else ok := ok || '· No ve fichas ajenas. '; end if;

  select count(*) into n from public.solicitudes;
  if n > 0 then fallas := fallas || format('· Aicardi ve %s denuncias web ajenas. ', n);
  else ok := ok || '· No ve denuncias ajenas. '; end if;

  -- Del otro broker no tiene que ver ni los nombres del equipo. La fila propia
  -- (la del usuario que estamos simulando) sí: cada uno se ve a sí mismo.
  select count(*) into n from public.perfiles;
  if n > 1 then fallas := fallas || format('· Aicardi ve %s usuarios; debería ver solo el suyo. ', n);
  else ok := ok || '· No ve la guía de usuarios del otro broker. '; end if;

  -- Lo que carga queda a su nombre sin que el portal tenga que acordarse: el
  -- dueño lo pone la base (default org_actual()).
  insert into public.siniestros (codigo, n, cliente)
  values ('AIC-PRUEBA', 999999, 'CLIENTE DE AICARDI');
  select count(*) into n from public.siniestros;
  if n <> 1 then fallas := fallas || format('· Aicardi cargó un siniestro y ahora ve %s. ', n);
  else ok := ok || '· Lo que carga queda a su nombre, y solo lo ve ella. '; end if;

  -- Un módulo que no compró tiene que rebotar EN LA BASE, no solo en el menú.
  begin
    insert into public.renovaciones (codigo, n, cliente) values ('AIC-REN', 999999, 'X');
    fallas := fallas || '· Aicardi pudo cargar una renovación sin haber comprado el módulo. ';
  exception
    when insufficient_privilege then
      ok := ok || '· La base le rebota el módulo que no compró. ';
    when others then
      fallas := fallas || format('· La prueba del módulo no concluyó (%s). ', sqlerrm);
  end;
  reset role;

  -- ── Como usuario de SARACENI (plan Full) ──────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', v_uid, 'app_metadata',
                      json_build_object('org_id', v_sar))::text, true);
  set local role authenticated;

  select string_agg(slug, ',') into ver from public.organizaciones;
  if ver is distinct from 'saraceni' then
    fallas := fallas || format('· Saraceni ve estas empresas: [%s]. ', coalesce(ver, 'ninguna'));
  else ok := ok || '· Saraceni solo se ve a sí misma. '; end if;

  if not (public.tiene_modulo('siniestros') and public.tiene_modulo('facturacion')
          and public.tiene_modulo('objetivos')) then
    fallas := fallas || '· Saraceni tiene plan Full pero le falta algún módulo. ';
  else ok := ok || '· Saraceni tiene todo el Full. '; end if;

  -- Sigue viendo lo suyo: aislar no puede significar romperle el portal al dueño.
  select count(*) into n from public.siniestros;
  if n = 0 then fallas := fallas || '· Saraceni no ve NINGUN siniestro propio. ';
  else ok := ok || format('· Saraceni ve sus %s siniestros. ', n); end if;

  select count(*) into n from public.siniestros where codigo = 'AIC-PRUEBA';
  if n > 0 then fallas := fallas || '· Saraceni ve el siniestro que cargó Aicardi. ';
  else ok := ok || '· No ve lo que cargó el otro broker. '; end if;

  select count(*) into n from public.asegurados;
  if n = 0 then fallas := fallas || '· Saraceni no ve ninguna ficha propia. ';
  else ok := ok || '· Ve sus fichas de asegurado. '; end if;
  reset role;

  -- ── Sin sesión ────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '', true);
  set local role authenticated;
  select string_agg(slug, ',') into ver from public.organizaciones;
  if ver is not null then fallas := fallas || format('· Sin sesión se ven empresas: [%s]. ', ver);
  else ok := ok || '· Sin sesión no se ve ninguna empresa. '; end if;
  if public.tiene_modulo('siniestros') then
    fallas := fallas || '· Sin sesión da por habilitado un módulo. ';
  else ok := ok || '· Sin sesión no hay módulos. '; end if;
  select count(*) into n from public.siniestros;
  if n > 0 then fallas := fallas || format('· Sin sesión se ven %s siniestros. ', n);
  else ok := ok || '· Sin sesión no se ve ningún siniestro. '; end if;
  reset role;

  if fallas = '' then
    raise exception 'AISLAMIENTO OK. %', ok;
  else
    raise exception 'AISLAMIENTO ROTO >>> %', fallas;
  end if;
end $$;
