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
      obs: r.obs || "",
      ticket: r.ticket || "",
      enCalendario: !!r.en_calendario,
      ultimaModPor: r.ultima_mod_por || "",
      ultimaModFecha: r.ultima_mod_fecha || new Date().toISOString(),
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
      obs: orNull(it.obs),
      ticket: orNull(it.ticket),
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

  window.DB = {
    configured: dbConfigured,
    list: dbList,
    create: dbCreate,
    update: dbUpdate,
    remove: dbRemove,
    subscribe: dbSubscribe,
  };
})();
