// db.js — Capa de acceso a datos sobre Supabase (sin backend propio)
// ─────────────────────────────────────────────────────────────────────────────
// Expone window.DB con: configured(), list(), create(), update(), remove().
// Mapea entre el modelo de la app (camelCase) y las columnas de Postgres
// (snake_case) de la tabla `siniestros`. Ver supabase/schema.sql.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const cfg = () => ({
    url: window.SUPABASE_URL || "",
    key: window.SUPABASE_ANON_KEY || "",
  });

  function dbConfigured() {
    const { url, key } = cfg();
    return !!(url && key && /^https?:\/\//.test(url));
  }

  let _client = null;
  function client() {
    if (_client) return _client;
    if (!dbConfigured()) return null;
    if (!window.supabase || !window.supabase.createClient) {
      console.warn("supabase-js no está cargado todavía.");
      return null;
    }
    const { url, key } = cfg();
    _client = window.supabase.createClient(url, key);
    return _client;
  }

  // ---- mapeo fila (DB) -> item (app) ----
  function fromRow(r) {
    return {
      _dbId: r.id,
      id: r.codigo,
      n: r.n,
      estado: r.estado,
      cliente: r.cliente,
      clienteDoc: r.cliente_doc || "",
      aseguradoId: r.asegurado_id || null,
      dominio: r.dominio || "",
      referencia: r.referencia || "",
      cia: r.cia,
      ramo: r.ramo,
      hecho: r.hecho,
      cobertura: r.cobertura || "",
      poliza: r.poliza || "",
      nroSiniestro: r.nro_siniestro || "",
      fechaOcurrido: r.fecha_ocurrido || "",
      fechaDenuncia: r.fecha_denuncia || "",
      fechaLimite: r.fecha_limite || "",
      fechaInspeccion: r.fecha_inspeccion || "",
      gestionAR: r.gestion_ar || "",
      gestionReal: r.gestion_real || "",
      gestor: r.gestor || "",
      gestorEmail: r.gestor_email || "",
      gestorTel: r.gestor_tel || "",
      obs: r.obs || "",
      ticket: r.ticket || "",
      franquiciaPct: r.franquicia_pct || "",
      franquiciaMonto: r.franquicia_monto || "",
      gestiones: Array.isArray(r.gestiones) ? r.gestiones : [],
      adjuntos: Array.isArray(r.adjuntos) ? r.adjuntos : [],
      enCalendario: !!r.en_calendario,
      asignadoA: r.asignado_a || null,
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      creado: r.created_at || null,
      eliminado: !!r.eliminado,
    };
  }

  // ---- mapeo item (app) -> fila (DB) para insert/update ----
  const orNull = (v) => (v === "" || v === undefined ? null : v);
  // Convierte a número lo que viene de un input; texto no numérico queda en null.
  const numOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  function toRow(it) {
    return {
      codigo: it.id,
      n: it.n,
      estado: it.estado,
      cliente: it.cliente,
      cliente_doc: orNull(it.clienteDoc),
      asegurado_id: it.aseguradoId || null,
      dominio: orNull(it.dominio),
      referencia: orNull(it.referencia),
      cia: it.cia,
      ramo: it.ramo,
      hecho: it.hecho,
      cobertura: orNull(it.cobertura),
      poliza: orNull(it.poliza),
      nro_siniestro: orNull(it.nroSiniestro),
      fecha_ocurrido: orNull(it.fechaOcurrido),
      fecha_denuncia: orNull(it.fechaDenuncia),
      fecha_limite: orNull(it.fechaLimite),
      fecha_inspeccion: orNull(it.fechaInspeccion),
      gestion_ar: orNull(it.gestionAR),
      gestion_real: orNull(it.gestionReal),
      gestor: orNull(it.gestor),
      gestor_email: orNull(it.gestorEmail),
      gestor_tel: orNull(it.gestorTel),
      obs: orNull(it.obs),
      ticket: orNull(it.ticket),
      franquicia_pct: orNull(it.franquiciaPct),
      franquicia_monto: orNull(it.franquiciaMonto),
      gestiones: Array.isArray(it.gestiones) ? it.gestiones : [],
      adjuntos: Array.isArray(it.adjuntos) ? it.adjuntos : [],
      en_calendario: !!it.enCalendario,
      asignado_a: orNull(it.asignadoA),
      ultima_mod_por: orNull(it.ultimaModPor),
      ultima_mod_fecha: it.ultimaModFecha || new Date().toISOString(),
      eliminado: !!it.eliminado,
    };
  }

  async function dbList() {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c
      .from("siniestros")
      .select("*")
      .eq("eliminado", false)
      .order("n", { ascending: true });
    if (error) throw error;
    return (data || []).map(fromRow);
  }

  async function dbCreate(item) {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c
      .from("siniestros")
      .insert(toRow(item))
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  }

  async function dbUpdate(item) {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c
      .from("siniestros")
      .update(toRow(item))
      .eq("id", item._dbId)
      .select()
      .single();
    if (error) throw error;
    return fromRow(data);
  }

  async function dbRemove(item) {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    const { error } = await c
      .from("siniestros")
      .update({
        eliminado: true,
        ultima_mod_por: orNull(item.ultimaModPor),
        ultima_mod_fecha: new Date().toISOString(),
      })
      .eq("id", item._dbId);
    if (error) throw error;
  }

  // Suscripción en tiempo real: llama onChange ante cualquier INSERT/UPDATE/DELETE.
  // Devuelve una función para cancelar la suscripción.
  function dbSubscribe(onChange) {
    const c = client();
    if (!c) return null;
    const ch = c
      .channel("siniestros-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "siniestros" }, (payload) => {
        try { onChange(payload); } catch (e) { console.error(e); }
      })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ---- autenticación ----
  async function authSession() {
    const c = client();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data ? data.session : null;
  }
  async function authSignIn(email, password) {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }
  async function authSignOut() {
    const c = client();
    if (c) { try { await c.auth.signOut(); } catch (e) { /* noop */ } }
  }
  function authOnChange(cb) {
    const c = client();
    if (!c) return null;
    const { data } = c.auth.onAuthStateChange((_event, session) => cb(session));
    return () => { try { data.subscription.unsubscribe(); } catch (e) { /* noop */ } };
  }
  async function authUpdatePassword(newPassword) {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }
  // Registro con email real. Si el proyecto exige verificación, data.session
  // viene null y el usuario debe confirmar desde su casilla.
  async function authSignUp(email, password, nombre) {
    const c = client();
    if (!c) throw new Error("Supabase no configurado");
    // `org_slug` viaja en los datos del usuario porque el trigger de alta lo lee
    // para crear la membresía: sin empresa, el organizador no ve la cuenta nueva
    // para aprobarla. Si no viene, la base la manda a la empresa original.
    const { data, error } = await c.auth.signUp({
      email, password,
      options: {
        data: { nombre: nombre || "", org_slug: window.ORG_SLUG || "" },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  }
async function dbMaxN() {
  const c = client();
  if (!c) return 0;
  const { data, error } = await c
    .from("siniestros")
    .select("n")
    .order("n", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0].n : 0;
}
  // ============================ FACTURACIÓN ============================
  // Modelo en dos partes: `fact_companias` guarda lo que nunca cambia (razón
  // social, CUIT, tipo, envío) y `fact_mensual` solo los importes de cada mes.
  function fromRowFC(r) {
    return {
      id: r.id, razonSocial: r.razon_social || "", cuit: r.cuit || "",
      tipo: r.tipo || "", envio: r.envio || "", banco: r.banco || "",
      notas: r.notas || "", activa: r.activa !== false, orden: r.orden || 0,
    };
  }
  function toRowFC(it) {
    return {
      razon_social: it.razonSocial, cuit: it.cuit,
      tipo: orNull(it.tipo), envio: orNull(it.envio), banco: orNull(it.banco),
      notas: orNull(it.notas), activa: it.activa !== false,
      orden: Number(it.orden) || 0,
    };
  }
  function fromRowFM(r) {
    return {
      _dbId: r.id, companiaId: r.compania_id, anio: r.anio, mes: r.mes,
      fecha: r.fecha || "", nroFactura: r.nro_factura || "",
      neto: r.neto, iva: r.iva, total: r.total,
      enviado: !!r.enviado, pago: r.pago,
      observaciones: r.observaciones || "",
      ultimaModPor: r.ultima_mod_por || "",
    };
  }
  function toRowFM(it) {
    return {
      compania_id: it.companiaId, anio: Number(it.anio), mes: Number(it.mes),
      fecha: orNull(it.fecha), nro_factura: orNull(it.nroFactura),
      neto: numOrNull(it.neto), iva: numOrNull(it.iva), total: numOrNull(it.total),
      enviado: !!it.enviado, pago: numOrNull(it.pago),
      observaciones: orNull(it.observaciones),
      ultima_mod_por: orNull(it.ultimaModPor),
      ultima_mod_fecha: new Date().toISOString(),
    };
  }
  // --- compañías (datos fijos) ---
  async function fcList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("fact_companias").select("*").order("orden", { ascending: true });
    if (error) throw error; return (data || []).map(fromRowFC);
  }
  async function fcCreate(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("fact_companias").insert(toRowFC(it)).select().single();
    if (error) throw error; return fromRowFC(data);
  }
  async function fcUpdate(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("fact_companias").update(toRowFC(it)).eq("id", it.id).select().single();
    if (error) throw error; return fromRowFC(data);
  }
  async function fcRemove(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.from("fact_companias").delete().eq("id", it.id);
    if (error) throw error;
  }
  // --- movimientos mensuales (datos variables) ---
  // Sin filtro trae todo (para las estadísticas anuales); con año, solo ese año.
  async function fmList(anio) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    let q = c.from("fact_mensual").select("*");
    if (anio) q = q.eq("anio", anio);
    const { data, error } = await q.order("anio").order("mes");
    if (error) throw error; return (data || []).map(fromRowFM);
  }
  // Alta o actualización de la fila del mes de una compañía (una sola por período)
  async function fmSave(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("fact_mensual")
      .upsert(toRowFM(it), { onConflict: "compania_id,anio,mes" })
      .select().single();
    if (error) throw error; return fromRowFM(data);
  }
  async function fmRemove(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.from("fact_mensual").delete().eq("id", it._dbId);
    if (error) throw error;
  }
  function fmSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("fact-realtime-" + Math.random().toString(36).slice(2, 8))
      .on("postgres_changes", { event: "*", schema: "public", table: "fact_mensual" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .on("postgres_changes", { event: "*", schema: "public", table: "fact_companias" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ RENOVACIONES ============================
  function fromRowR(r) {
    return {
      _dbId: r.id, id: r.codigo, n: r.n,
      poliza: r.poliza || "", cliente: r.cliente || "",
      aseguradora: r.aseguradora || "", seccion: r.seccion || "",
      inicioVig: r.inicio_vig || "", finVig: r.fin_vig || "",
      estado: r.estado || "Pendiente", observaciones: r.observaciones || "",
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      creado: r.created_at || null, eliminado: !!r.eliminado,
    };
  }
  function toRowR(it) {
    return {
      codigo: it.id, n: it.n,
      poliza: orNull(it.poliza), cliente: it.cliente,
      aseguradora: orNull(it.aseguradora), seccion: orNull(it.seccion),
      inicio_vig: orNull(it.inicioVig), fin_vig: orNull(it.finVig),
      estado: orNull(it.estado) || "Pendiente", observaciones: orNull(it.observaciones),
      ultima_mod_por: orNull(it.ultimaModPor),
      ultima_mod_fecha: it.ultimaModFecha || new Date().toISOString(),
      eliminado: !!it.eliminado,
    };
  }
  async function renovList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("renovaciones").select("*").eq("eliminado", false).order("fin_vig", { ascending: true });
    if (error) throw error; return (data || []).map(fromRowR);
  }
  async function renovCreate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("renovaciones").insert(toRowR(item)).select().single();
    if (error) throw error; return fromRowR(data);
  }
  async function renovUpdate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("renovaciones").update(toRowR(item)).eq("id", item._dbId).select().single();
    if (error) throw error; return fromRowR(data);
  }
  async function renovRemove(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.from("renovaciones").update({ eliminado: true, ultima_mod_por: orNull(item.ultimaModPor), ultima_mod_fecha: new Date().toISOString() }).eq("id", item._dbId);
    if (error) throw error;
  }
  async function renovMaxN() {
    const c = client(); if (!c) return 0;
    const { data, error } = await c.from("renovaciones").select("n").order("n", { ascending: false }).limit(1);
    if (error) throw error; return data && data.length ? data[0].n : 0;
  }
  function renovSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("renovaciones-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "renovaciones" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ PENDIENTES ============================
  function fromRowP(r) {
    return {
      _dbId: r.id, id: r.codigo, n: r.n,
      titulo: r.titulo || "", descripcion: r.descripcion || "",
      cliente: r.cliente || "", categoria: r.categoria || "Otro",
      prioridad: r.prioridad || "Media", fechaLimite: r.fecha_limite || "",
      estado: r.estado || "Pendiente", asignado: r.asignado || "",
      asignadoA: r.asignado_a || null,
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      creado: r.created_at || null, eliminado: !!r.eliminado,
    };
  }
  function toRowP(it) {
    return {
      codigo: it.id, n: it.n,
      titulo: it.titulo, descripcion: orNull(it.descripcion),
      cliente: orNull(it.cliente), categoria: orNull(it.categoria),
      prioridad: orNull(it.prioridad), fecha_limite: orNull(it.fechaLimite),
      estado: orNull(it.estado) || "Pendiente", asignado: orNull(it.asignado),
      asignado_a: orNull(it.asignadoA),
      ultima_mod_por: orNull(it.ultimaModPor),
      ultima_mod_fecha: it.ultimaModFecha || new Date().toISOString(),
      eliminado: !!it.eliminado,
    };
  }
  async function pendList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("pendientes").select("*").eq("eliminado", false).order("n", { ascending: true });
    if (error) throw error; return (data || []).map(fromRowP);
  }
  async function pendCreate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("pendientes").insert(toRowP(item)).select().single();
    if (error) throw error; return fromRowP(data);
  }
  async function pendUpdate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("pendientes").update(toRowP(item)).eq("id", item._dbId).select().single();
    if (error) throw error; return fromRowP(data);
  }
  async function pendRemove(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.from("pendientes").update({ eliminado: true, ultima_mod_por: orNull(item.ultimaModPor), ultima_mod_fecha: new Date().toISOString() }).eq("id", item._dbId);
    if (error) throw error;
  }
  async function pendMaxN() {
    const c = client(); if (!c) return 0;
    const { data, error } = await c.from("pendientes").select("n").order("n", { ascending: false }).limit(1);
    if (error) throw error; return data && data.length ? data[0].n : 0;
  }
  function pendSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("pendientes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pendientes" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ OBJETIVOS ============================
  // Los objetivos ganaron área, periodicidad, rango de fechas y responsables.
  // `mes`/`anio`/`tipo` se siguen leyendo y escribiendo: son las columnas que usa
  // la versión anterior del módulo, y las dos conviven sobre la misma tabla.
  const finDeMes = (anio, mes) => new Date(anio, mes, 0).getDate();
  function fromRowO(r) {
    const periodicidad = r.periodicidad || (r.mes == null ? "anual" : "mensual");
    const desde = r.fecha_desde || (r.mes == null
      ? r.anio + "-01-01"
      : r.anio + "-" + String(r.mes).padStart(2, "0") + "-01");
    const hasta = r.fecha_hasta || (r.mes == null
      ? r.anio + "-12-31"
      : r.anio + "-" + String(r.mes).padStart(2, "0") + "-" + String(finDeMes(r.anio, r.mes)).padStart(2, "0"));
    return {
      _dbId: r.id, id: r.codigo, n: r.n,
      titulo: r.titulo || "", tipo: r.tipo || "manual",
      descripcion: r.descripcion || "",
      area: r.area || (r.tipo === "facturacion" ? "facturacion" : "otro"),
      periodicidad, fechaDesde: desde, fechaHasta: hasta,
      mes: r.mes, anio: r.anio,
      meta: r.meta, valorActual: r.valor_actual,
      unidad: r.unidad || "$", notas: r.notas || "",
      responsable: r.responsable || "", equipo: r.equipo || "",
      colaboradores: Array.isArray(r.colaboradores) ? r.colaboradores : [],
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      eliminado: !!r.eliminado,
    };
  }
  function toRowO(it) {
    return {
      codigo: it.id, n: it.n,
      titulo: it.titulo, tipo: it.tipo || "manual",
      descripcion: orNull(it.descripcion),
      area: orNull(it.area) || "otro",
      periodicidad: orNull(it.periodicidad) || "mensual",
      fecha_desde: orNull(it.fechaDesde), fecha_hasta: orNull(it.fechaHasta),
      mes: it.mes === "" || it.mes == null ? null : Number(it.mes),
      anio: Number(it.anio),
      meta: numOrNull(it.meta) || 0,
      valor_actual: numOrNull(it.valorActual),
      unidad: orNull(it.unidad) || "$", notas: orNull(it.notas),
      responsable: orNull(it.responsable), equipo: orNull(it.equipo),
      colaboradores: Array.isArray(it.colaboradores) ? it.colaboradores : [],
      ultima_mod_por: orNull(it.ultimaModPor),
      ultima_mod_fecha: it.ultimaModFecha || new Date().toISOString(),
      eliminado: !!it.eliminado,
    };
  }
  async function objList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("objetivos").select("*").eq("eliminado", false).order("n", { ascending: true });
    if (error) throw error; return (data || []).map(fromRowO);
  }
  async function objCreate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("objetivos").insert(toRowO(item)).select().single();
    if (error) throw error; return fromRowO(data);
  }
  async function objUpdate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("objetivos").update(toRowO(item)).eq("id", item._dbId).select().single();
    if (error) throw error; return fromRowO(data);
  }
  async function objRemove(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.from("objetivos").update({ eliminado: true, ultima_mod_por: orNull(item.ultimaModPor), ultima_mod_fecha: new Date().toISOString() }).eq("id", item._dbId);
    if (error) throw error;
  }
  async function objMaxN() {
    const c = client(); if (!c) return 0;
    const { data, error } = await c.from("objetivos").select("n").order("n", { ascending: false }).limit(1);
    if (error) throw error; return data && data.length ? data[0].n : 0;
  }
  function objSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("objetivos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "objetivos" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ SOLICITUDES (buzón público) ============================
  function fromRowS(r) {
    return {
      _dbId: r.id, id: "SOL-" + String(r.id).padStart(4, "0"),
      ref: r.ref || "", nombre: r.nombre || "",
      dniCuit: r.dni_cuit || "", telefono: r.telefono || "", email: r.email || "",
      cia: r.cia || "", poliza: r.poliza || "", dominio: r.dominio || "", ramo: r.ramo || "",
      tipoSiniestro: r.tipo_siniestro || "",
      terceroNombre: r.tercero_nombre || "", terceroDni: r.tercero_dni || "", terceroCelular: r.tercero_celular || "",
      terceroDominio: r.tercero_dominio || "", terceroCia: r.tercero_cia || "", terceroPoliza: r.tercero_poliza || "",
      // Columnas nuevas: las solicitudes cargadas antes de la migración no las
      // traen, de ahí los valores por defecto.
      tercerosExtra: Array.isArray(r.terceros_extra) ? r.terceros_extra : [],
      conductorDistinto: !!r.conductor_distinto,
      conductorNombre: r.conductor_nombre || "", conductorDni: r.conductor_dni || "",
      fechaHecho: r.fecha_hecho || "", horaHecho: r.hora_hecho || "",
      ubicacion: r.ubicacion || "", localidad: r.localidad || "",
      lesionados: r.lesionados || "", relato: r.relato || "",
      adjuntos: Array.isArray(r.adjuntos) ? r.adjuntos : [],
      estado: r.estado || "nueva", siniestroCodigo: r.siniestro_codigo || "",
      creado: r.created_at || null,
    };
  }
  async function solList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("solicitudes").select("*").order("id", { ascending: false });
    if (error) throw error; return (data || []).map(fromRowS);
  }
  async function solUpdate(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("solicitudes")
      .update({ estado: it.estado, siniestro_codigo: orNull(it.siniestroCodigo), procesada_por: orNull(it.procesadaPor) })
      .eq("id", it._dbId).select().single();
    if (error) throw error; return fromRowS(data);
  }
  function solSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("solicitudes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ COTIZACIONES (comercial) ============================
  function fromRowC(r) {
    return {
      _dbId: r.id, id: "COT-" + String(r.id).padStart(4, "0"),
      ref: r.ref || "", ramo: r.ramo || "HOGAR",
      nombre: r.nombre || "", documento: r.documento || "",
      telefono: r.telefono || "", email: r.email || "",
      direccion: r.direccion || "", localidad: r.localidad || "", codigoPostal: r.codigo_postal || "",
      tipoVivienda: r.tipo_vivienda || "", piso: r.piso || "", enCountry: r.en_country,
      tienePileta: r.tiene_pileta, metros2: r.metros2,
      alarma: !!r.alarma, medidasSeguridad: !!r.medidas_seguridad,
      equiposFuera: r.equipos_fuera, equiposFueraDetalle: r.equipos_fuera_detalle || "",
      equiposFueraObjeto: r.equipos_fuera_objeto || "", equiposFueraMarca: r.equipos_fuera_marca || "",
      equiposFueraModelo: r.equipos_fuera_modelo || "", equiposFueraValor: r.equipos_fuera_valor,
      notebookPc: !!r.notebook_pc, notebookPcDetalle: r.notebook_pc_detalle || "",
      notebookPcMarca: r.notebook_pc_marca || "", notebookPcModelo: r.notebook_pc_modelo || "",
      notebookPcValor: r.notebook_pc_valor,
      bicicleta: r.bicicleta, bicicletaMarca: r.bicicleta_marca || "",
      bicicletaModelo: r.bicicleta_modelo || "", bicicletaValor: r.bicicleta_valor,
      roboCelular: !!r.robo_celular, celularValor: r.celular_valor,
      observaciones: r.observaciones || "",
      estado: r.estado || "nueva", notasInternas: r.notas_internas || "",
      gestionadaPor: r.gestionada_por || "",
      creado: r.created_at || null,
    };
  }
  async function cotList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("cotizaciones").select("*").order("id", { ascending: false });
    if (error) throw error; return (data || []).map(fromRowC);
  }
  async function cotUpdate(it) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const row = { estado: it.estado, gestionada_por: orNull(it.gestionadaPor) };
    if (it.notasInternas !== undefined) row.notas_internas = orNull(it.notasInternas);
    const { data, error } = await c.from("cotizaciones").update(row).eq("id", it._dbId).select().single();
    if (error) throw error; return fromRowC(data);
  }
  function cotSubscribe(onChange) {
    const c = client(); if (!c) return null;
    // Nombre único por suscriptor: el badge del menú y la bandeja escuchan a la vez
    // y Supabase no admite dos suscripciones sobre el mismo canal.
    const ch = c.channel("cotizaciones-realtime-" + Math.random().toString(36).slice(2, 8))
      .on("postgres_changes", { event: "*", schema: "public", table: "cotizaciones" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ PERFILES (usuarios y roles) ============================
  function fromRowU(r) {
    return {
      id: r.id, email: r.email || "", nombre: r.nombre || "",
      rol: r.rol || "empleado", estado: r.estado || "pendiente",
      creado: r.created_at || null,
    };
  }
  // Perfil del usuario logueado (rol y estado). Null si todavía no existe.
  async function perfMe() {
    const c = client(); if (!c) return null;
    const { data: s } = await c.auth.getSession();
    const uid = s && s.session && s.session.user ? s.session.user.id : null;
    if (!uid) return null;
    const { data, error } = await c.from("perfiles").select("*").eq("id", uid).maybeSingle();
    if (error) throw error;
    return data ? fromRowU(data) : null;
  }
  async function perfList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("perfiles").select("*").order("created_at", { ascending: true });
    if (error) throw error; return (data || []).map(fromRowU);
  }
  async function perfUpdate(id, patch) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const row = {};
    if (patch.rol) row.rol = patch.rol;
    if (patch.estado) row.estado = patch.estado;
    if (patch.nombre !== undefined) row.nombre = patch.nombre;
    row.updated_at = new Date().toISOString();
    const { data, error } = await c.from("perfiles").update(row).eq("id", id).select().single();
    if (error) throw error; return fromRowU(data);
  }
  function perfSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("perfiles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "perfiles" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ NOTIFICACIONES ============================
  function fromRowN(r) {
    return {
      _dbId: r.id, tipo: r.tipo || "sistema",
      titulo: r.titulo || "", cuerpo: r.cuerpo || "",
      modulo: r.modulo || "", referencia: r.referencia || "",
      leida: !!r.leida, creado: r.created_at || null,
    };
  }
  async function notifList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("notificaciones").select("*")
      .order("id", { ascending: false }).limit(60);
    if (error) throw error; return (data || []).map(fromRowN);
  }
  async function notifMarkRead(id) {
    const c = client(); if (!c) return;
    const { error } = await c.from("notificaciones").update({ leida: true }).eq("id", id);
    if (error) console.error(error);
  }
  async function notifMarkAll() {
    const c = client(); if (!c) return;
    const { error } = await c.from("notificaciones").update({ leida: true }).eq("leida", false);
    if (error) console.error(error);
  }
  function notifSubscribe(uid, onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("notif-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones", filter: "usuario_id=eq." + uid }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
      .subscribe();
    return () => { try { c.removeChannel(ch); } catch (e) { /* noop */ } };
  }

  // ============================ ASEGURADOS ============================
  // Una ficha por persona. El duplicado lo impide la base con un índice único
  // sobre el documento normalizado (ver supabase/migrations/…_asegurados.sql),
  // así que acá no hace falta ninguna precaución extra: si el documento ya
  // existe, `asegBuscarOCrear` devuelve el id de la ficha que ya estaba.
  function fromRowA(r) {
    return {
      id: r.id, nombre: r.nombre || "", documento: r.documento || "",
      documentoNorm: r.documento_norm || "", nombreNorm: r.nombre_norm || "",
      email: r.email || "", telefono: r.telefono || "", notas: r.notas || "",
      creado: r.created_at || null,
    };
  }

  async function asegList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("asegurados").select("*").order("nombre");
    if (error) throw error;
    return (data || []).map(fromRowA);
  }

  // Busca por documento o por nombre para el autocompletado del formulario.
  // El documento va primero y exacto: es el que identifica sin ambigüedad.
  async function asegBuscar(texto) {
    const c = client(); if (!c) return [];
    const q = String(texto || "").trim();
    if (q.length < 2) return [];
    const soloDigitos = q.replace(/[^0-9]/g, "");
    // PostgREST separa las condiciones de `.or()` con comas, así que un nombre
    // como "Fernandez, Marta Elena" le parte la consulta al medio y devuelve
    // error 400. Hay que entrecomillar el valor. Y `%` y `_` son comodines de
    // LIKE: si no se escapan, buscar "100%" trae cualquier cosa.
    const seguro = (v) => '"' + String(v).replace(/["\\]/g, "").replace(/[%_]/g, "\\$&") + '"';
    const partes = [`nombre.ilike.${seguro("%" + q + "%")}`];
    if (soloDigitos.length >= 4) partes.push(`documento.ilike.${seguro("%" + soloDigitos + "%")}`);
    const { data, error } = await c.from("asegurados").select("*").or(partes.join(",")).limit(8);
    if (error) { console.error(error); return []; }
    return (data || []).map(fromRowA);
  }

  // Coincidencia exacta por documento: es lo que dispara el autocompletado.
  async function asegPorDocumento(doc) {
    const c = client(); if (!c) return null;
    const norm = String(doc || "").replace(/[oO]/g, "0").replace(/[iIlL]/g, "1").replace(/[^0-9]/g, "");
    if (norm.length < 6) return null;
    // Mismo criterio que doc_normalizado() en Postgres: de un CUIT sale el DNI.
    const buscado = norm.length === 11 ? norm.slice(2, 10).replace(/^0+/, "") : norm.replace(/^0+/, "");
    const { data, error } = await c.from("asegurados").select("*").eq("documento_norm", buscado).maybeSingle();
    if (error) { console.error(error); return null; }
    return data ? fromRowA(data) : null;
  }

  // Cuántos siniestros tiene: es lo que hace útil mostrar que "ya existe".
  async function asegSiniestros(aseguradoId) {
    const c = client(); if (!c) return [];
    const { data, error } = await c.from("siniestros")
      .select("codigo,cliente,ramo,hecho,estado,fecha_denuncia,cia,nro_siniestro")
      .eq("asegurado_id", aseguradoId).eq("eliminado", false)
      .order("fecha_denuncia", { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async function asegBuscarOCrear({ nombre, documento, email, telefono }) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.rpc("asegurado_buscar_o_crear", {
      p_nombre: nombre || null, p_documento: documento || null,
      p_email: email || null, p_telefono: telefono || null,
    });
    if (error) throw error;
    return data;   // id del asegurado
  }

  // La ficha elegida de la lista puede no tener documento (las que salieron de
  // los siniestros viejos no tienen). Si en el siniestro se cargó uno, la ficha
  // lo aprende. Devuelve la ficha a la que va el siniestro: si el documento ya
  // era de otra, es esa otra (ver migración 0008).
  async function asegCompletarDocumento(id, documento) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.rpc("asegurado_completar_documento", {
      p_id: id, p_documento: documento || null });
    if (error) throw error;
    return data;
  }

  // ============================ LA EMPRESA DE QUIEN ENTRA ====================
  // `organizaciones` puede no existir todavía en una base sin la 0009. Por eso
  // `orgMia` devuelve null en vez de romper: sin empresa, el portal usa la
  // marca por defecto.
  //
  // La policy ya limita la consulta a la empresa propia, así que un `limit 1`
  // alcanza: no hay forma de que devuelva la de otro broker.
  let _orgCache = null;
  async function orgMia() {
    const c = client(); if (!c) return null;
    const { data, error } = await c.from("organizaciones").select("*").limit(1).maybeSingle();
    if (error) return null;
    _orgCache = data ? { id: data.id, nombre: data.nombre || "", slug: data.slug || "",
                         estado: data.estado || "", marca: data.marca || {} } : null;
    return _orgCache;
  }

  // El id de la empresa, para armar la carpeta donde van sus archivos. Se
  // recuerda entre llamadas: subir tres fotos no puede ser tres consultas más.
  async function orgId() {
    if (_orgCache) return _orgCache.id;
    const o = await orgMia();
    return o ? o.id : null;
  }

  // La empresa a la que corresponde esta pantalla ANTES de que alguien entre:
  // el login de un broker tiene que mostrar su marca, no la del vecino. Se
  // resuelve por el slug de la dirección y es lo único que se puede leer de
  // `organizaciones` sin sesión: nombre, slug y marca, nada más.
  async function orgPublica(slug) {
    const c = client(); if (!c) return null;
    const { data, error } = await c.rpc("org_publica", { p_slug: slug || null });
    if (error || !data || !data.length) return null;
    const o = data[0];
    return { id: o.id, nombre: o.nombre || "", slug: o.slug || "", marca: o.marca || {} };
  }

  // Los módulos contratados, para el menú. Que estén escondidos es comodidad;
  // lo que de verdad los bloquea son las policies.
  async function orgModulos() {
    const c = client(); if (!c) return null;
    const { data, error } = await c.rpc("mis_modulos");
    if (error) return null;               // base vieja: el portal muestra todo
    return Array.isArray(data) ? data : null;
  }

  async function orgGuardarMarca(id, marca) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("organizaciones")
      .update({ marca, updated_at: new Date().toISOString() })
      .eq("id", id).select("marca").single();
    if (error) throw error;
    return data.marca;
  }

  // Cada subida estrena nombre de archivo: si se pisara el mismo, el navegador
  // seguiría mostrando el logo viejo hasta que se le venza la caché.
  async function orgSubirLogo(id, file) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const ext = String(file.name || "logo.png").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = id + "/logo-" + Date.now() + "." + ext;
    const { error } = await c.storage.from("marcas")
      .upload(path, file, { contentType: file.type || undefined });
    if (error) throw error;
    return c.storage.from("marcas").getPublicUrl(path).data.publicUrl;
  }

  // ---- posibles duplicados ----
  // La lista trae las dos fichas con sus datos y cuántos siniestros tiene cada
  // una: sin eso no se puede decidir cuál conservar.
  async function dupList() {
    const c = client(); if (!c) return [];
    const { data, error } = await c.from("asegurados_duplicados")
      .select("*, a:a_id(id,nombre,documento,email,telefono,created_at), b:b_id(id,nombre,documento,email,telefono,created_at)")
      .eq("estado", "pendiente")
      .order("parecido", { ascending: false });
    if (error) { console.error(error); return []; }
    const filas = data || [];
    // Cuántos siniestros tiene cada ficha involucrada, en una sola consulta.
    const ids = [...new Set(filas.flatMap((f) => [f.a_id, f.b_id]))];
    const cuenta = {};
    if (ids.length) {
      const { data: ss } = await c.from("siniestros")
        .select("asegurado_id").in("asegurado_id", ids).eq("eliminado", false);
      (ss || []).forEach((s) => { cuenta[s.asegurado_id] = (cuenta[s.asegurado_id] || 0) + 1; });
    }
    return filas.map((f) => ({
      id: f.id, parecido: Number(f.parecido), creado: f.created_at,
      a: { ...f.a, siniestros: cuenta[f.a_id] || 0 },
      b: { ...f.b, siniestros: cuenta[f.b_id] || 0 },
    }));
  }

  async function dupBuscar(umbral) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.rpc("asegurados_buscar_parecidos", { umbral: umbral || 0.7 });
    if (error) throw error;
    return data;   // cuántos pares nuevos encontró
  }

  async function dupUnificar(idFinal, idAbsorbido, quien) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.rpc("asegurados_unificar", {
      id_final: idFinal, id_absorbido: idAbsorbido, p_quien: quien || null });
    if (error) throw error;
    return data;
  }

  async function dupDistintos(a, b, quien) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.rpc("asegurados_no_son_duplicados", { a, b, p_quien: quien || null });
    if (error) throw error;
  }

  // Engancha los siniestros viejos, que no tienen documento. Con `simular` en
  // true no escribe nada: devuelve qué agruparía.
  async function asegEnganchar(simular) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.rpc("asegurados_enganchar_siniestros", { solo_simular: simular !== false });
    if (error) throw error;
    return data || [];
  }

  async function asegUpdate(a) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("asegurados")
      .update({ nombre: a.nombre, documento: orNull(a.documento), email: orNull(a.email),
                telefono: orNull(a.telefono), notas: orNull(a.notas), updated_at: new Date().toISOString() })
      .eq("id", a.id).select().single();
    if (error) throw error;
    return fromRowA(data);
  }

  // ============================ ARCHIVOS (Storage) ============================
  const BUCKET = "adjuntos";
  async function fileUpload(file) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    // Único punto por donde el portal sube archivos: se achica acá para que
    // ninguna pantalla se olvide de hacerlo. Los PDF pasan intactos.
    const original = file;
    if (window.achicarImagen) file = await window.achicarImagen(file);
    const safe = (file.name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_");
    // Cada archivo va en la carpeta de su empresa: es lo que mira la policy del
    // bucket. En una base sin multiempresa no hay empresa que preguntar y se
    // sube como siempre, a la raíz; si la base sí la tiene, es ella la que
    // rechaza el archivo sin carpeta, con su propio mensaje.
    const org = await orgId();
    const carpeta = org ? org + "/" : "";
    const path = `${carpeta}${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await c.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    // El nombre que ve el usuario es el que eligió, aunque el archivo guardado
    // haya cambiado de extensión al convertirse a WebP.
    return { name: original.name || safe, path, tipo: file.type || "", size: file.size || 0 };
  }
  async function fileSignedUrl(path, secs, bucket) {
    const c = client(); if (!c) return null;
    const { data, error } = await c.storage.from(bucket || BUCKET).createSignedUrl(path, secs || 3600);
    if (error) { console.error(error); return null; }
    return data ? data.signedUrl : null;
  }
  async function fileRemove(path, bucket) {
    const c = client(); if (!c) return;
    const { error } = await c.storage.from(bucket || BUCKET).remove([path]);
    if (error) console.error(error);
  }

  window.DB = { maxN: dbMaxN,
    configured: dbConfigured,
    list: dbList,
    create: dbCreate,
    update: dbUpdate,
    remove: dbRemove,
    subscribe: dbSubscribe,
    auth: {
      session: authSession,
      signIn: authSignIn,
      signOut: authSignOut,
      onChange: authOnChange,
      updatePassword: authUpdatePassword,
      signUp: authSignUp,
    },
    perfiles: { me: perfMe, list: perfList, update: perfUpdate, subscribe: perfSubscribe },
    notif: { list: notifList, markRead: notifMarkRead, markAll: notifMarkAll, subscribe: notifSubscribe },
    fact: {
      // datos fijos de cada compañía
      companias: { list: fcList, create: fcCreate, update: fcUpdate, remove: fcRemove },
      // importes de cada mes
      mensual: { list: fmList, save: fmSave, remove: fmRemove },
      subscribe: fmSubscribe,
    },
    renov: {
      list: renovList, create: renovCreate, update: renovUpdate,
      remove: renovRemove, maxN: renovMaxN, subscribe: renovSubscribe,
    },
    pend: {
      list: pendList, create: pendCreate, update: pendUpdate,
      remove: pendRemove, maxN: pendMaxN, subscribe: pendSubscribe,
    },
    obj: {
      list: objList, create: objCreate, update: objUpdate,
      remove: objRemove, maxN: objMaxN, subscribe: objSubscribe,
    },
    aseg: {
      list: asegList, buscar: asegBuscar, porDocumento: asegPorDocumento,
      buscarOCrear: asegBuscarOCrear, update: asegUpdate, siniestros: asegSiniestros,
      completarDocumento: asegCompletarDocumento,
      enganchar: asegEnganchar,
      dup: { list: dupList, buscar: dupBuscar, unificar: dupUnificar, distintos: dupDistintos },
    },
    org: { mia: orgMia, id: orgId, modulos: orgModulos, publica: orgPublica, guardarMarca: orgGuardarMarca, subirLogo: orgSubirLogo },
    sol: { list: solList, update: solUpdate, subscribe: solSubscribe },
    cot: { list: cotList, update: cotUpdate, subscribe: cotSubscribe },
    files: { upload: fileUpload, signedUrl: fileSignedUrl, remove: fileRemove },
  };
})();
