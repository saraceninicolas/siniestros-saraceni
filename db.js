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
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      creado: r.created_at || null,
      eliminado: !!r.eliminado,
    };
  }

  // ---- mapeo item (app) -> fila (DB) para insert/update ----
  const orNull = (v) => (v === "" || v === undefined ? null : v);
  function toRow(it) {
    return {
      codigo: it.id,
      n: it.n,
      estado: it.estado,
      cliente: it.cliente,
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
  // ============================ FACTURAS ============================
  const numOrNull = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(String(v).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  function fromRowF(r) {
    return {
      _dbId: r.id, id: r.codigo, n: r.n,
      fechaEmision: r.fecha_emision || "",
      nroFactura: r.nro_factura || "",
      tipo: r.tipo || "",
      cuit: r.cuit || "",
      razonSocial: r.razon_social || "",
      neto: r.neto_gravado, iva: r.iva, total: r.total,
      mailEnvio: r.mail_envio || "",
      estadoEnvio: r.estado_envio || "",
      montoPagado: r.monto_pagado,
      estadoPago: r.estado_pago || "",
      banco: r.banco || "",
      observaciones: r.observaciones || "",
      mes: r.mes, anio: r.anio,
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      eliminado: !!r.eliminado,
    };
  }
  function toRowF(it) {
    return {
      codigo: it.id, n: it.n,
      fecha_emision: orNull(it.fechaEmision),
      nro_factura: orNull(it.nroFactura),
      tipo: orNull(it.tipo),
      cuit: orNull(it.cuit),
      razon_social: it.razonSocial,
      neto_gravado: numOrNull(it.neto),
      iva: numOrNull(it.iva),
      total: numOrNull(it.total),
      mail_envio: orNull(it.mailEnvio),
      estado_envio: orNull(it.estadoEnvio),
      monto_pagado: numOrNull(it.montoPagado),
      estado_pago: orNull(it.estadoPago),
      banco: orNull(it.banco),
      observaciones: orNull(it.observaciones),
      mes: it.mes, anio: it.anio,
      ultima_mod_por: orNull(it.ultimaModPor),
      ultima_mod_fecha: it.ultimaModFecha || new Date().toISOString(),
      eliminado: !!it.eliminado,
    };
  }
  async function factList() {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("facturas").select("*").eq("eliminado", false).order("n", { ascending: true });
    if (error) throw error; return (data || []).map(fromRowF);
  }
  async function factCreate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("facturas").insert(toRowF(item)).select().single();
    if (error) throw error; return fromRowF(data);
  }
  async function factUpdate(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { data, error } = await c.from("facturas").update(toRowF(item)).eq("id", item._dbId).select().single();
    if (error) throw error; return fromRowF(data);
  }
  async function factRemove(item) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const { error } = await c.from("facturas").update({ eliminado: true, ultima_mod_por: orNull(item.ultimaModPor), ultima_mod_fecha: new Date().toISOString() }).eq("id", item._dbId);
    if (error) throw error;
  }
  async function factMaxN() {
    const c = client(); if (!c) return 0;
    const { data, error } = await c.from("facturas").select("n").order("n", { ascending: false }).limit(1);
    if (error) throw error; return data && data.length ? data[0].n : 0;
  }
  function factSubscribe(onChange) {
    const c = client(); if (!c) return null;
    const ch = c.channel("facturas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "facturas" }, (p) => { try { onChange(p); } catch (e) { console.error(e); } })
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
  function fromRowO(r) {
    return {
      _dbId: r.id, id: r.codigo, n: r.n,
      titulo: r.titulo || "", tipo: r.tipo || "manual",
      mes: r.mes, anio: r.anio,
      meta: r.meta, valorActual: r.valor_actual,
      unidad: r.unidad || "$", notas: r.notas || "",
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
      eliminado: !!r.eliminado,
    };
  }
  function toRowO(it) {
    return {
      codigo: it.id, n: it.n,
      titulo: it.titulo, tipo: it.tipo || "manual",
      mes: it.mes === "" || it.mes == null ? null : Number(it.mes),
      anio: Number(it.anio),
      meta: numOrNull(it.meta) || 0,
      valor_actual: numOrNull(it.valorActual),
      unidad: orNull(it.unidad) || "$", notas: orNull(it.notas),
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

  // ============================ ARCHIVOS (Storage) ============================
  const BUCKET = "adjuntos";
  async function fileUpload(file) {
    const c = client(); if (!c) throw new Error("Supabase no configurado");
    const safe = (file.name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    const { error } = await c.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    return { name: file.name || safe, path, tipo: file.type || "", size: file.size || 0 };
  }
  async function fileSignedUrl(path, secs) {
    const c = client(); if (!c) return null;
    const { data, error } = await c.storage.from(BUCKET).createSignedUrl(path, secs || 3600);
    if (error) { console.error(error); return null; }
    return data ? data.signedUrl : null;
  }
  async function fileRemove(path) {
    const c = client(); if (!c) return;
    const { error } = await c.storage.from(BUCKET).remove([path]);
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
    },
    fact: {
      list: factList, create: factCreate, update: factUpdate,
      remove: factRemove, maxN: factMaxN, subscribe: factSubscribe,
    },
    pend: {
      list: pendList, create: pendCreate, update: pendUpdate,
      remove: pendRemove, maxN: pendMaxN, subscribe: pendSubscribe,
    },
    obj: {
      list: objList, create: objCreate, update: objUpdate,
      remove: objRemove, maxN: objMaxN, subscribe: objSubscribe,
    },
    files: { upload: fileUpload, signedUrl: fileSignedUrl, remove: fileRemove },
  };
})();
