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
-- Cuando la 0010 agregue la columna de dueño a las 12 tablas del portal, los
-- pasos de siniestros, renovaciones, etc. se agregan ACÁ, tabla por tabla.
-- ============================================================================

do $$
declare
  v_aic uuid := (select id from public.organizaciones where slug = 'aicardi');
  v_sar uuid := (select id from public.organizaciones where slug = 'saraceni');
  fallas text := '';
  ok     text := '';
  ver    text;
  n      bigint;
begin
  if v_aic is null or v_sar is null then
    raise exception 'Faltan las empresas de prueba (saraceni y aicardi) en esta base';
  end if;

  -- ── Como usuario de AICARDI ───────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'app_metadata',
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
  reset role;

  -- ── Como usuario de SARACENI (plan Full) ──────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'app_metadata',
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
  reset role;

  if fallas = '' then
    raise exception 'AISLAMIENTO OK. %', ok;
  else
    raise exception 'AISLAMIENTO ROTO >>> %', fallas;
  end if;
end $$;
