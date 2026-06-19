// app.jsx — Saraceni Seguros · Portal de Siniestros (modelo real + Supabase)

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brand": "#DD0909",
  "density": "regular",
  "fontScale": 100,
  "sidebar": "charcoal"
}/*EDITMODE-END*/;

function darken(hex, amt = 0.12) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 - amt)); g = Math.round(g * (1 - amt)); b = Math.round(b * (1 - amt));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

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
  const [modal, setModal] = React.useState(null);
  const [active, setActive] = React.useState("dashboard");
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);

  const flash = React.useCallback((msg) => {
    setToast({ msg, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--brand", t.brand);
    r.style.setProperty("--brand-d", darken(t.brand, 0.14));
    r.style.setProperty("--font-scale", (t.fontScale / 100).toString());
    r.dataset.density = t.density;
    r.dataset.sidebar = t.sidebar;
  }, [t.brand, t.fontScale, t.density, t.sidebar]);

  // ---- sesión: ¿hay alguien logueado? ----
  React.useEffect(() => {
    if (!window.DB || !window.DB.configured()) { setAuthChecked(true); return; }
    let alive = true;
    (async () => {
      try { const s = await window.DB.auth.session(); if (alive) setSession(s); }
      catch (e) { console.error("Auth:", e); }
      if (alive) setAuthChecked(true);
    })();
    const unsub = window.DB.auth.onChange((s) => { if (alive) setSession(s); });
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
          flash("No se pudo conectar a Supabase — modo demo");
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
        const hay = [s.cliente, s.poliza, s.nroSiniestro, s.id, s.cia, s.gestor, s.gestionAR].join(" ").toLowerCase();
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
    return activos.filter((s) => [s.cliente, s.gestor, s.gestionAR, s.cia].join(" ").toLowerCase().includes(q));
  }, [activos, query]);

  const selected = activos.find((s) => s.id === selectedId) || null;

  const handleCreate = async (data) => {
  let n;
  if (usingDb) {
    try { n = (await window.DB.maxN()) + 1; }
    catch (e) { console.error(e); n = siniestros.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1; }
  } else {
    n = siniestros.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
  }
  let item = { ...data, id: sinId(n), n, ultimaModPor: station, ultimaModFecha: nowIso(), eliminado: false };
  if (usingDb) {
    try { item = await window.DB.create(item); }
    catch (e) { console.error(e); flash("Error al guardar en Supabase"); return; }
  }
  setSiniestros((p) => [item, ...p]);
  setModal(null);
  flash(`Siniestro ${data.nroSiniestro} registrado`);
};
  const handleUpdate = async (data) => {
    let updated = { ...data, ultimaModPor: station, ultimaModFecha: nowIso() };
    if (usingDb) {
      try { updated = await window.DB.update(updated); }
      catch (e) { console.error(e); flash("Error al actualizar en Supabase"); return; }
    }
    setSiniestros((p) => p.map((s) => s.id === data.id ? { ...s, ...updated } : s));
    setModal(null);
    flash(`Siniestro ${data.nroSiniestro} actualizado`);
  };
  const handleDelete = async (item) => {
    if (usingDb) {
      try { await window.DB.remove(item); }
      catch (e) { console.error(e); flash("Error al eliminar en Supabase"); return; }
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
      <Sidebar active={active} onNav={(k) => { setActive(k); setDetailId(null); }} station={station}
        counts={{ abiertos: abiertos.length, porVencer }} />

      <main className="main">
        <Topbar active={active} query={query} onQuery={setQuery} station={station}
          onSwitchStation={switchStation} onNew={() => setModal({ type: "new" })}
          onOpenSync={() => setModal({ type: "sync" })} onLogout={configured ? logout : undefined}
          isSiniestros={isSiniestros} />

        {!isSiniestros ? (
          <div className="content">
            {FACTURACION_KEYS.includes(active)
              ? <FacturacionModule active={active} station={station} query={query} />
              : <ModuleScreen info={NAV_LOOKUP[active]} />}
          </div>
        ) : detailItem ? (
          <div className="content">
            <DetailScreen item={detailItem} onBack={() => setDetailId(null)}
              onEdit={openEdit} onDelete={askDelete} onGcal={agendarGcal} onIcs={descargarIcs} />
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
              <ClaimsTable rows={rows} selectedId={selectedId} onSelect={setSelectedId} onOpen={openDetail} />
            </div>
          </div>
        )}
      </main>

      {modal?.type === "new" && <ClaimFormModal mode="new" station={station} onClose={() => setModal(null)} onSubmit={handleCreate} />}
      {modal?.type === "edit" && <ClaimFormModal mode="edit" initial={modal.item} station={station} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
      {modal?.type === "delete" && <ConfirmDelete item={modal.item} station={station} onClose={() => setModal(null)} onConfirm={handleDelete} />}
      {modal?.type === "sync" && <CalendarSync data={activos} onClose={() => setModal(null)} onAgendar={marcarAgendado} />}

      <Toast toast={toast} />

      <TweaksPanel>
        <TweakSection label="Marca" />
        <TweakColor label="Color de marca" value={t.brand}
          options={["#DD0909", "#B91C1C", "#1D4ED8", "#0F766E", "#C2410C"]}
          onChange={(v) => setTweak("brand", v)} />
        <TweakRadio label="Sidebar" value={t.sidebar} options={["charcoal", "rojo", "claro"]}
          onChange={(v) => setTweak("sidebar", v)} />
        <TweakSection label="Densidad y texto" />
        <TweakRadio label="Densidad tabla" value={t.density} options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="Escala de texto" value={t.fontScale} min={90} max={115} step={5} unit="%"
          onChange={(v) => setTweak("fontScale", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
