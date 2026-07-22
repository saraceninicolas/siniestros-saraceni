// app.jsx — Saraceni Seguros · Portal de Siniestros (modelo real + Supabase)

function App() {
  const [station, setStation] = React.useState(STATIONS[0]);
  const [siniestros, setSiniestros] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [session, setSession] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [estadoFilter, setEstadoFilter] = React.useState("Todos");
  const [ramoFilter, setRamoFilter] = React.useState("Todos");
  const [ciaFilter, setCiaFilter] = React.useState("Todos");
  const [selectedId, setSelectedId] = React.useState(null);
  const [detailId, setDetailId] = React.useState(null);
  const [solicitudes, setSolicitudes] = React.useState([]);
  const [modal, setModal] = React.useState(null);
  const [active, setActive] = React.useState("dashboard");
  const [navOpen, setNavOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);

  const flash = React.useCallback((msg, err) => {
    setToast({ msg, err: !!err, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), err ? 4000 : 2600);
  }, []);

  // ---- sesión: ¿hay alguien logueado? ----
  React.useEffect(() => {
    if (!window.DB || !window.DB.configured()) { setAuthChecked(true); return; }
    let alive = true;
    // Solo cambia la sesión si cambia el usuario (login/logout).
    // El refresco de token (mismo usuario, p.ej. al volver de otra pestaña) se ignora
    // para no recargar y no desmontar un formulario abierto.
    const uid = (s) => (s && s.user ? s.user.id : null);
    (async () => {
      try { const s = await window.DB.auth.session(); if (alive) setSession((prev) => (uid(prev) === uid(s) ? prev : s)); }
      catch (e) { console.error("Auth:", e); }
      if (alive) setAuthChecked(true);
    })();
    const unsub = window.DB.auth.onChange((s) => { if (alive) setSession((prev) => (uid(prev) === uid(s) ? prev : s)); });
    return () => { alive = false; if (unsub) unsub(); };
  }, []);

  // ---- carga de datos: solo con sesión (o modo demo sin Supabase) ----
  React.useEffect(() => {
    const configured = window.DB && window.DB.configured();
    if (configured && !session) {
      // sin login: limpiamos y esperamos
      setSiniestros([]); setUsingDb(false); setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      if (configured) {
        try {
          const items = await window.DB.list();
          if (!alive) return;
          setSiniestros(items.length ? items : buildSeed());
          setUsingDb(true);
        } catch (e) {
          console.error("Supabase:", e);
          if (!alive) return;
          setSiniestros(buildSeed());
          setUsingDb(false);
          flash("No se pudo conectar a Supabase — modo demo", true);
        }
      } else {
        setSiniestros(buildSeed());
        setUsingDb(false);
        flash("Modo demo · cargá tus claves de Supabase para guardar cambios");
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [session, flash]);

  // ---- tiempo real: refresca cuando otro puesto carga/edita/elimina ----
  React.useEffect(() => {
    if (!usingDb || !window.DB || !window.DB.subscribe) return;
    let timer = null;
    let alive = true;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const items = await window.DB.list();
          if (alive && items.length) setSiniestros(items);
        } catch (e) { console.error("Realtime refresh:", e); }
      }, 400);
    };
    const unsub = window.DB.subscribe(refresh);
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [usingDb]);

  // ---- solicitudes públicas (denuncias online de asegurados) ----
  React.useEffect(() => {
    if (!usingDb || !window.DB.sol) return;
    let alive = true, timer = null;
    const load = async () => {
      try { const items = await window.DB.sol.list(); if (alive) setSolicitudes(items); }
      catch (e) { console.error("Solicitudes:", e); }
    };
    load();
    const unsub = window.DB.sol.subscribe((payload) => {
      if (payload && payload.eventType === "INSERT") flash("Nueva solicitud de siniestro recibida — mirá Solicitudes recibidas");
      clearTimeout(timer); timer = setTimeout(load, 400);
    });
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [usingDb, flash]);

  const activos = siniestros.filter((s) => !s.eliminado);
  const abiertos = activos.filter((s) => s.estado === "Abierto");
  const porVencer = abiertos.filter((s) => ["vencido", "hoy", "proximo"].includes(urgenciaDe(s))).length;

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return activos.filter((s) => {
      if (estadoFilter !== "Todos" && s.estado !== estadoFilter) return false;
      if (ramoFilter !== "Todos" && s.ramo !== ramoFilter) return false;
      if (ciaFilter !== "Todos" && s.cia !== ciaFilter) return false;
      if (q) {
        const hay = [s.cliente, s.poliza, s.nroSiniestro, s.id, s.cia, s.gestor, s.gestionAR, s.dominio, s.referencia].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // abiertos primero, por fecha límite; terminados al final por última mod
      if (a.estado !== b.estado) return a.estado === "Abierto" ? -1 : 1;
      if (a.estado === "Abierto") {
        const da = daysUntil(a.fechaLimite), db = daysUntil(b.fechaLimite);
        if (da == null) return 1; if (db == null) return -1;
        return da - db;
      }
      return new Date(b.ultimaModFecha) - new Date(a.ultimaModFecha);
    });
  }, [activos, query, estadoFilter, ramoFilter, ciaFilter]);

  const agendaData = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activos;
    return activos.filter((s) => [s.cliente, s.gestor, s.gestionAR, s.cia, s.dominio, s.referencia].join(" ").toLowerCase().includes(q));
  }, [activos, query]);

  const solNuevas = solicitudes.filter((s) => s.estado === "nueva").length;

  // Cantidad de siniestros abiertos por cliente (para el chip ×N)
  const clientesMulti = React.useMemo(() => {
    const m = {};
    abiertos.forEach((s) => { m[s.cliente] = (m[s.cliente] || 0) + 1; });
    return m;
  }, [abiertos]);

  const selected = activos.find((s) => s.id === selectedId) || null;
  const userEmail = session && session.user ? session.user.email : null;
  const nombreDe = (email) => {
    const p = (email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
    return p ? p.replace(/\b\w/g, (c) => c.toUpperCase()) : email;
  };
  const quien = userEmail ? nombreDe(userEmail) : station;

  const handleCreate = async (data) => {
  // Aviso si ya existe un siniestro activo con el mismo número
  const nro = (data.nroSiniestro || "").trim();
  const dup = nro && activos.find((s) => (s.nroSiniestro || "").trim() === nro);
  if (dup && !window.confirm(`Ya existe un siniestro con el N° ${nro} (${dup.cliente}). ¿Registrarlo igual?`)) return;
  let n;
  if (usingDb) {
    try { n = (await window.DB.maxN()) + 1; }
    catch (e) { console.error(e); n = siniestros.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1; }
  } else {
    n = siniestros.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
  }
  let item = { ...data, id: sinId(n), n, ultimaModPor: quien, ultimaModFecha: nowIso(), eliminado: false };
  if (usingDb) {
    try { item = await window.DB.create(item); }
    catch (e) { console.error(e); flash("Error al guardar en Supabase", true); return; }
  }
  // Si vino de una solicitud pública, marcarla como procesada
  if (modal && modal.solicitudId && usingDb && window.DB.sol) {
    try {
      await window.DB.sol.update({ _dbId: modal.solicitudId, estado: "procesada", siniestroCodigo: item.id, procesadaPor: quien });
      setSolicitudes((p) => p.map((x) => x._dbId === modal.solicitudId ? { ...x, estado: "procesada", siniestroCodigo: item.id } : x));
    } catch (e) { console.error(e); }
  }
  setSiniestros((p) => [item, ...p]);
  setModal(null);
  flash(`Siniestro ${data.nroSiniestro} registrado`);
};
  // ---- convertir / gestionar solicitudes públicas ----
  const convertirSolicitud = (s) => {
    const up = (t) => (t || "").toUpperCase();
    const ciaMap = [["MERCANTIL", "LMA"], ["PROVINCIA", "PROVINCIA"], ["ALLIANZ", "ALLIANZ"], ["SANCOR", "SANCOR"], ["FEDERA", "FEDERACION"], ["CRISTOBAL", "SAN CRISTOBAL"], ["CRISTÓBAL", "SAN CRISTOBAL"], ["ZURICH", "ZURICH"]];
    let cia = null; const cs = up(s.cia);
    for (const [k, v] of ciaMap) { if (cs.includes(k)) { cia = v; break; } }
    const lineas = [];
    if (s.relato) { lineas.push(s.relato); lineas.push(""); }
    lineas.push(`— Denuncia web ${s.id} (ref ${s.ref})`);
    const lugar = [s.ubicacion, s.localidad].filter(Boolean).join(", ");
    if (s.horaHecho) lineas.push("Hora del hecho: " + s.horaHecho);
    if (lugar) lineas.push("Lugar: " + lugar);
    if (s.lesionados) lineas.push(s.lesionados === "SI" ? "⚠ HAY LESIONADOS" : "Sin lesionados");
    const contactoAseg = [
      s.telefono ? "Tel: " + s.telefono : null,
      s.email ? "Email: " + s.email : null,
      s.dniCuit ? "DNI/CUIT: " + s.dniCuit : null,
      !cia && s.cia ? "Cía declarada: " + s.cia : null,
    ].filter(Boolean).join(" · ");
    if (contactoAseg) lineas.push("Asegurado: " + contactoAseg);
    const terc = [
      s.terceroNombre || null,
      s.terceroCelular ? "Cel " + s.terceroCelular : null,
      s.terceroDominio ? "Dominio " + s.terceroDominio : null,
      s.terceroCia ? "Cía " + s.terceroCia : null,
      s.terceroPoliza ? "Póliza " + s.terceroPoliza : null,
      s.terceroDni ? "DNI/CUIT " + s.terceroDni : null,
    ].filter(Boolean).join(" · ");
    if (terc) { lineas.push(""); lineas.push("TERCERO: " + terc); }
    const prefill = {
      cliente: up(s.nombre), dominio: up(s.dominio), poliza: s.poliza || "",
      fechaOcurrido: s.fechaHecho || "", fechaDenuncia: new Date().toISOString().slice(0, 10),
      obs: lineas.join("\n"),
      adjuntos: (s.adjuntos || []).map((a) => ({ ...a, bucket: "solicitudes" })),
      referencia: "Denuncia web",
      ...(cia ? { cia } : {}),
    };
    setModal({ type: "new", prefill, solicitudId: s._dbId });
  };
  const descartarSolicitud = async (s) => {
    if (!window.confirm(`¿Descartar la solicitud de ${s.nombre}?`)) return;
    try {
      await window.DB.sol.update({ _dbId: s._dbId, estado: "descartada", procesadaPor: quien });
      setSolicitudes((p) => p.map((x) => x._dbId === s._dbId ? { ...x, estado: "descartada" } : x));
      flash("Solicitud descartada");
    } catch (e) { console.error(e); flash("Error al descartar", true); }
  };
  const reabrirSolicitud = async (s) => {
    try {
      await window.DB.sol.update({ _dbId: s._dbId, estado: "nueva", procesadaPor: quien });
      setSolicitudes((p) => p.map((x) => x._dbId === s._dbId ? { ...x, estado: "nueva" } : x));
      flash("Solicitud reabierta");
    } catch (e) { console.error(e); flash("Error al reabrir", true); }
  };
  const handleUpdate = async (data) => {
    let updated = { ...data, ultimaModPor: quien, ultimaModFecha: nowIso() };
    if (usingDb) {
      try { updated = await window.DB.update(updated); }
      catch (e) { console.error(e); flash("Error al actualizar en Supabase", true); return; }
    }
    setSiniestros((p) => p.map((s) => s.id === data.id ? { ...s, ...updated } : s));
    setModal(null);
    flash(`Siniestro ${data.nroSiniestro} actualizado`);
  };
  // Acciones rápidas desde la pantalla de detalle
  const terminarSiniestro = (item) => handleUpdate({ ...item, estado: "Terminado" });
  const agregarGestionRapida = (item, entry) => {
    const gs = [...(item.gestiones || []), { ...entry, pc: quien }]
      .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    handleUpdate({ ...item, gestiones: gs, gestionReal: gs[gs.length - 1].texto });
  };
  const handleDelete = async (item) => {
    if (usingDb) {
      try { await window.DB.remove(item); }
      catch (e) { console.error(e); flash("Error al eliminar en Supabase", true); return; }
    }
    setSiniestros((p) => p.map((s) => s.id === item.id ? { ...s, eliminado: true } : s));
    if (selectedId === item.id) setSelectedId(null);
    if (detailId === item.id) setDetailId(null);
    setModal(null);
    flash(`Siniestro ${item.nroSiniestro} dado de baja`);
  };

  const openEdit = (item) => setModal({ type: "edit", item });
  const openDetail = (id) => { const it = activos.find((s) => s.id === id); if (it) setDetailId(id); };
  const askDelete = (item) => setModal({ type: "delete", item });
  const detailItem = activos.find((s) => s.id === detailId) || null;

  // ---- Google Calendar ----
  const marcarAgendado = (ids) => {
    const set = new Set(ids);
    setSiniestros((p) => p.map((s) => set.has(s.id) ? { ...s, enCalendario: true } : s));
    if (usingDb) {
      siniestros.filter((s) => set.has(s.id) && !s.enCalendario).forEach((s) => {
        window.DB.update({ ...s, enCalendario: true }).catch((e) => console.error(e));
      });
    }
  };
  const agendarGcal = (item) => {
    const url = gcalUrl(item);
    if (url) window.open(url, "_blank", "noopener");
    marcarAgendado([item.id]);
    flash(`Evento de ${item.cliente} abierto en Google Calendar`);
  };
  const descargarIcs = (item) => {
    downloadICS(`gestion-${item.id}.ics`, buildICS([item], 1));
    marcarAgendado([item.id]);
    flash(`Archivo .ics de ${item.cliente} descargado`);
  };

  const switchStation = () => {
    const next = station === STATIONS[0] ? STATIONS[1] : STATIONS[0];
    setStation(next);
    flash(`Puesto activo: ${next}`);
  };

  const configured = !!(window.DB && window.DB.configured());
  const isSiniestros = SINIESTROS_KEYS.includes(active);
  const logout = async () => {
    setModal(null); setDetailId(null); setSelectedId(null);
    try { await window.DB.auth.signOut(); } catch (e) { console.error(e); }
    setSession(null);
  };

  // verificando sesión
  if (configured && !authChecked) {
    return (
      <div className="boot"><div className="boot-inner"><div className="boot-spin" /></div></div>
    );
  }
  // sin login → pantalla de acceso
  if (configured && !session) {
    return <LoginScreen onSignIn={(email, password) => window.DB.auth.signIn(email, password)} />;
  }
  // cargando datos
  if (loading) {
    return (
      <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando portal…</div></div>
    );
  }

  return (
    <div className="app">
      <Sidebar active={active} onNav={(k) => { setActive(k); setDetailId(null); setNavOpen(false); }} station={quien}
        counts={{ abiertos: abiertos.length, porVencer, solicitudes: solNuevas }} open={navOpen} />
      {navOpen && <div className="sb-scrim" onClick={() => setNavOpen(false)} />}

      <main className="main">
        <Topbar active={active} query={query} onQuery={setQuery} station={quien}
          onSwitchStation={switchStation} onNew={() => setModal({ type: "new" })}
          onOpenSync={() => setModal({ type: "sync" })} onLogout={configured ? logout : undefined}
          onChangePass={configured && session ? () => setModal({ type: "pass" }) : undefined}
          onMenu={() => setNavOpen(true)} isSiniestros={isSiniestros} />

        {!isSiniestros ? (
          <div className="content">
            {FACTURACION_KEYS.includes(active)
              ? <FacturacionModule active={active} station={quien} query={query} />
              : PENDIENTES_KEYS.includes(active)
              ? <PendientesModule active={active} station={quien} query={query} />
              : OBJETIVOS_KEYS.includes(active)
              ? <ObjetivosModule active={active} station={quien} query={query} />
              : <ModuleScreen info={NAV_LOOKUP[active]} />}
          </div>
        ) : detailItem ? (
          <div className="content">
            <DetailScreen item={detailItem} onBack={() => setDetailId(null)}
              onEdit={openEdit} onDelete={askDelete} onGcal={agendarGcal} onIcs={descargarIcs}
              onTerminar={terminarSiniestro} onQuickGestion={agregarGestionRapida} />
          </div>
        ) : active === "solicitudes" ? (
          <div className="content">
            <SolicitudesView solicitudes={solicitudes} onConvertir={convertirSolicitud}
              onDescartar={descartarSolicitud} onReabrir={reabrirSolicitud} />
          </div>
        ) : active === "agenda" ? (
          <div className="content">
            <Agenda data={agendaData} onOpen={openDetail} onSync={() => setModal({ type: "sync" })} onGcal={agendarGcal} />
          </div>
        ) : (
          <div className="content">
            {active === "dashboard" && <Kpis data={activos} />}
            <div className="panel">
              <Toolbar
                title={active === "siniestros" ? "Todos los siniestros" : "Siniestros"}
                count={rows.length}
                estadoFilter={estadoFilter} onEstado={setEstadoFilter}
                ramoFilter={ramoFilter} onRamo={setRamoFilter}
                ciaFilter={ciaFilter} onCia={setCiaFilter}
                selected={selected}
                onEdit={() => selected && openEdit(selected)}
                onDelete={() => selected && askDelete(selected)} />
              <ClaimsTable rows={rows} selectedId={selectedId} onSelect={setSelectedId} onOpen={openDetail}
                multi={clientesMulti} onClientFilter={(cliente) => { setQuery(cliente); setEstadoFilter("Todos"); }} />
            </div>
          </div>
        )}
      </main>

      {modal?.type === "new" && <ClaimFormModal mode="new" initial={modal.prefill} station={quien} onClose={() => setModal(null)} onSubmit={handleCreate} />}
      {modal?.type === "edit" && <ClaimFormModal mode="edit" initial={modal.item} station={quien} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
      {modal?.type === "delete" && <ConfirmDelete item={modal.item} station={quien} onClose={() => setModal(null)} onConfirm={handleDelete} />}
      {modal?.type === "sync" && <CalendarSync data={activos} onClose={() => setModal(null)} onAgendar={marcarAgendado} />}
      {modal?.type === "pass" && <ChangePassModal onClose={() => setModal(null)} onDone={() => { setModal(null); flash("Contraseña actualizada"); }} />}

      <Toast toast={toast} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
