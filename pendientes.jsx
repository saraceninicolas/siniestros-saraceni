// pendientes.jsx — Saraceni Seguros · Módulo de Pendientes (tareas del día a día)

const ESTADOS_PEND = ["Pendiente", "En curso", "Hecho"];
const ESTADO_PEND_COLOR = {
  "Pendiente": { fg: "#B45309", bg: "#FEF3E2" },
  "En curso":  { fg: "#1D4ED8", bg: "#E8F0FE" },
  "Hecho":     { fg: "#15803D", bg: "#E6F4EA" },
};
const PRIO_PEND = ["Alta", "Media", "Baja"];
const PRIO_PEND_COLOR = {
  "Alta":  { fg: "#C0241D", bg: "#FBE3E3" },
  "Media": { fg: "#B45309", bg: "#FEF3E2" },
  "Baja":  { fg: "#475569", bg: "#EEF1F4" },
};
const CATS_PEND = ["Cotización", "Póliza", "Cobranza", "Administración", "Otro"];

function pendBadge(estado) {
  const c = ESTADO_PEND_COLOR[estado] || { fg: "#475569", bg: "#EEF1F4" };
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 12 }}><span className="badge-dot" style={{ background: c.fg }} />{estado}</span>;
}
function prioBadge(p) {
  const c = PRIO_PEND_COLOR[p] || PRIO_PEND_COLOR.Media;
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 800 }}>{p}</span>;
}
function urgPend(p) {
  if (p.estado === "Hecho") return "resuelto";
  if (!p.fechaLimite) return "sinfecha";
  const du = daysUntil(p.fechaLimite);
  if (du == null) return "sinfecha";
  if (du < 0) return "vencido";
  if (du === 0) return "hoy";
  if (du <= 3) return "proximo";
  return "normal";
}

// ---------- KPIs ----------
function PendKpis({ data }) {
  const activas = data.filter((p) => p.estado !== "Hecho");
  const vencidas = activas.filter((p) => urgPend(p) === "vencido").length;
  const porVencer = activas.filter((p) => ["hoy", "proximo"].includes(urgPend(p))).length;
  const hechas = data.filter((p) => p.estado === "Hecho").length;
  const cards = [
    { label: "Tareas activas", value: activas.length, hint: "pendientes + en curso", tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "flag" },
    { label: "Por vencer", value: porVencer, hint: "vencen en ≤ 3 días", tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "clock" },
    { label: "Vencidas", value: vencidas, hint: "requieren acción", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "alert" },
    { label: "Hechas", value: hechas, hint: "completadas", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "check" },
  ];
  return (
    <div className="kpis">
      {cards.map((c) => (
        <div className="kpi" key={c.label}>
          <span className="kpi-stripe" style={{ background: c.tone.fg }} />
          <div className="kpi-top"><span className="kpi-ico" style={{ background: c.tone.bg, color: c.tone.fg }}><Ico name={c.icon} size={17} /></span><span className="kpi-label">{c.label}</span></div>
          <div className="kpi-mid"><span className="kpi-value">{c.value}</span></div>
          <div className="kpi-foot"><span className="kpi-hint">{c.hint}</span></div>
        </div>
      ))}
    </div>
  );
}

// ---------- modal + form ----------
function PModal({ title, sub, onClose, children, footer, wide }) {
  React.useEffect(() => { const h = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div><button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
function PField({ label, children, required, full }) {
  return (<label className={"field" + (full ? " field-full" : "")}><span className="field-label">{label}{required && <i> *</i>}</span>{children}</label>);
}
function PendFormModal({ mode, initial, station, onClose, onSubmit, usuarios }) {
  const blank = { titulo: "", descripcion: "", cliente: "", categoria: "Otro", prioridad: "Media", fechaLimite: "", estado: "Pendiente", asignado: station || "", asignadoA: null };
  const [f, setF] = React.useState(initial ? { ...blank, ...initial } : blank);
  const [touched, setTouched] = React.useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = String(f.titulo).trim();
  const submit = () => { setTouched(true); if (!valid) return; onSubmit({ ...f }); };
  return (
    <PModal wide title={mode === "edit" ? "Editar pendiente" : "Nuevo pendiente"}
      sub={mode === "edit" ? `${initial.id}` : "Cargá la tarea a seguir"} onClose={onClose}
      footer={<><span className="foot-note"><Ico name="monitor" size={14} /> Como <b>{station}</b></span>
        <div className="foot-btns"><button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={!valid}><Ico name="check" size={16} />{mode === "edit" ? "Guardar" : "Registrar"}</button></div></>}>
      <div className="form-grid">
        <PField label="Tarea" required full>
          <input className={"input" + (touched && !valid ? " err" : "")} value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Qué hay que hacer" autoFocus />
        </PField>
        <PField label="Detalle" full>
          <textarea className="input" rows={2} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Notas, contexto…" />
        </PField>
        <PField label="Cliente (opcional)"><input className="input" value={f.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="A quién refiere" /></PField>
        <PField label="Categoría">
          <select className="input" value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATS_PEND.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </PField>
        <PField label="Prioridad">
          <div className="estado-pills">
            {PRIO_PEND.map((p) => (
              <button key={p} type="button" className={"epill" + (f.prioridad === p ? " on" : "")} onClick={() => set("prioridad", p)}>
                <span className="epill-dot" style={{ background: PRIO_PEND_COLOR[p].fg }} />{p}
              </button>
            ))}
          </div>
        </PField>
        <PField label="Vence"><input className="input" type="date" value={f.fechaLimite} onChange={(e) => set("fechaLimite", e.target.value)} /></PField>
        <PField label="Estado">
          <select className="input" value={f.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS_PEND.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </PField>
        <PField label="Responsable">
          {(usuarios || []).length > 0 ? (
            <select className="input" value={f.asignadoA || ""}
              onChange={(e) => {
                const id = e.target.value || null;
                const u = (usuarios || []).find((x) => x.id === id);
                setF((p) => ({ ...p, asignadoA: id, asignado: u ? (u.nombre || u.email) : "" }));
              }}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
            </select>
          ) : (
            <input className="input" value={f.asignado} onChange={(e) => set("asignado", e.target.value)} placeholder="Hernan / Nicolas" />
          )}
        </PField>
      </div>
    </PModal>
  );
}
function PendConfirmDelete({ item, station, onClose, onConfirm }) {
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm"><div className="confirm-ico"><Ico name="trash" size={22} /></div><h2>Eliminar pendiente</h2>
          <p>Vas a dar de baja la tarea <b>{item.titulo}</b>.</p>
          <div className="confirm-note"><Ico name="monitor" size={14} /> Como <b>{station}</b></div>
          <div className="confirm-btns"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-danger" onClick={() => onConfirm(item)}><Ico name="trash" size={15} />Sí, eliminar</button></div></div>
      </div>
    </div>
  );
}

// ---------- tabla ----------
function PendTable({ rows, onOpen, onToggle, onDelete }) {
  if (!rows.length) {
    return (<div className="empty"><div className="empty-ico"><Ico name="check" size={26} /></div><div className="empty-title">Sin pendientes</div><div className="empty-sub">No hay tareas que coincidan con los filtros.</div></div>);
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          <th>Vence</th><th>Tarea</th><th>Cliente</th><th>Categoría</th><th>Prioridad</th><th>Estado</th><th style={{ width: 90 }}></th>
        </tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} onClick={() => onOpen(p)}>
              <td>
                {p.fechaLimite
                  ? <div className="vence"><span className="vence-date mono">{fmtDateShort(p.fechaLimite)}</span><span className="cell-sub">{p.estado === "Hecho" ? "—" : venceTexto(p.fechaLimite)}</span></div>
                  : <span className="urg-none">—</span>}
              </td>
              <td>
                <div className="cell-strong" style={p.estado === "Hecho" ? { textDecoration: "line-through", color: "var(--muted)" } : null}>{p.titulo}</div>
                {p.descripcion && <div className="cell-sub">{p.descripcion}</div>}
              </td>
              <td className="dim">{p.cliente || "—"}</td>
              <td><span className="cia-pill sm">{p.categoria}</span></td>
              <td>{prioBadge(p.prioridad)}</td>
              <td>
                {pendBadge(p.estado)}
                {p.asignado && <div className="cell-sub">{p.asignado}</div>}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <button className="row-open" title={p.estado === "Hecho" ? "Reabrir" : "Marcar hecha"} onClick={() => onToggle(p)}>
                  <Ico name={p.estado === "Hecho" ? "refresh" : "check"} size={16} />
                </button>
                <button className="row-open" title="Eliminar" onClick={() => onDelete(p)}><Ico name="trash" size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- agenda por urgencia ----------
const BUCKETS_PEND = [
  { key: "vencido", label: "Vencidas", icon: "alert", head: "ag-vencido", rail: "ag-rail-vencido" },
  { key: "hoy", label: "Vencen hoy", icon: "clock", head: "ag-hoy", rail: "ag-rail-hoy" },
  { key: "proximo", label: "Próximos 3 días", icon: "clock", head: "ag-proximo", rail: "ag-rail-proximo" },
  { key: "normal", label: "Más adelante", icon: "agenda", head: "ag-normal", rail: "ag-rail-normal" },
  { key: "sinfecha", label: "Sin fecha", icon: "flag", head: "ag-normal", rail: "ag-rail-normal" },
];
function PendAgenda({ data, onOpen, onToggle, onNew }) {
  const activas = data.filter((p) => p.estado !== "Hecho");
  const groups = {}; BUCKETS_PEND.forEach((b) => (groups[b.key] = []));
  activas.forEach((p) => { const k = urgPend(p); if (groups[k]) groups[k].push(p); });
  Object.values(groups).forEach((arr) => arr.sort((a, b) => (a.fechaLimite || "9999").localeCompare(b.fechaLimite || "9999")));
  return (
    <div className="agenda">
      <div className="ag-banner">
        <span className="ag-banner-ico"><Ico name="flag" size={22} /></span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Pendientes por vencimiento</span>
          <span className="ag-banner-sub">{activas.length} tareas activas</span>
        </div>
        <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={onNew}><Ico name="plus" size={16} />Nuevo pendiente</button>
      </div>
      {BUCKETS_PEND.map((b) => groups[b.key].length > 0 && (
        <section className="ag-group" key={b.key}>
          <div className={"ag-head " + b.head}><Ico name={b.icon} size={16} /><span>{b.label}</span><span className="ag-count">{groups[b.key].length}</span></div>
          <div className="ag-list">
            {groups[b.key].map((p) => (
              <button className="ag-card" key={p.id} onClick={() => onOpen(p)}>
                <span className={"ag-rail " + b.rail} />
                <div className="ag-card-main">
                  <div className="ag-card-top">
                    <span className="ag-client">{p.titulo}</span>
                    {prioBadge(p.prioridad)}
                    {pendBadge(p.estado)}
                  </div>
                  {p.descripcion && <div className="ag-gestion">{p.descripcion}</div>}
                  <div className="ag-meta">
                    <span className="cia-pill sm">{p.categoria}</span>
                    {p.cliente && <><span className="ag-dot">·</span><span className="ag-gestor"><Ico name="user" size={12} />{p.cliente}</span></>}
                    {p.asignado && <><span className="ag-dot">·</span><span className="ag-gestor"><Ico name="monitor" size={12} />{p.asignado}</span></>}
                  </div>
                </div>
                <div className="ag-card-right">
                  <span className="ag-vence-label">Vence</span>
                  <span className="ag-vence-date mono">{p.fechaLimite ? fmtDateShort(p.fechaLimite) : "—"}</span>
                  <span className="ag-vence-rel">{p.fechaLimite ? venceTexto(p.fechaLimite) : "sin fecha"}</span>
                  <span className="btn-gcal xs" style={{ background: "#15803D", borderColor: "#15803D" }}
                    onClick={(e) => { e.stopPropagation(); onToggle(p); }}><Ico name="check" size={13} />Hecha</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {activas.length === 0 && (
        <div className="empty"><div className="empty-ico"><Ico name="check" size={26} /></div>
          <div className="empty-title">Todo al día</div>
          <div className="empty-sub">No hay pendientes activos. Cargá una tarea con "Nuevo pendiente".</div></div>
      )}
    </div>
  );
}

// ---------- orquestador ----------
function PendientesModule({ active, station, query, usuarios }) {
  const [tareas, setTareas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [estadoF, setEstadoF] = React.useState("Activas");
  const [prioF, setPrioF] = React.useState("Todos");
  const [catF, setCatF] = React.useState("Todos");
  const [modal, setModal] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const tt = React.useRef(null);
  const flash = React.useCallback((msg) => { setToast({ msg, id: Date.now() }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2600); }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (window.DB && window.DB.configured() && window.DB.pend) {
        try { const items = await window.DB.pend.list(); if (alive) { setTareas(items); setUsingDb(true); } }
        catch (e) { console.error("Pendientes:", e); if (alive) flash("No se pudieron cargar los pendientes"); }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [flash]);

  React.useEffect(() => {
    if (!usingDb || !window.DB.pend.subscribe) return;
    let timer = null, alive = true;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { try { const items = await window.DB.pend.list(); if (alive) setTareas(items); } catch (e) { console.error(e); } }, 400); };
    const unsub = window.DB.pend.subscribe(refresh);
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [usingDb]);

  const activos = tareas.filter((p) => !p.eliminado);
  const rows = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return activos.filter((p) => {
      if (estadoF === "Activas" && p.estado === "Hecho") return false;
      if (estadoF !== "Todos" && estadoF !== "Activas" && p.estado !== estadoF) return false;
      if (prioF !== "Todos" && p.prioridad !== prioF) return false;
      if (catF !== "Todos" && p.categoria !== catF) return false;
      if (q) { const hay = [p.titulo, p.descripcion, p.cliente, p.categoria, p.asignado].join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    }).sort((a, b) => {
      if ((a.estado === "Hecho") !== (b.estado === "Hecho")) return a.estado === "Hecho" ? 1 : -1;
      return (a.fechaLimite || "9999").localeCompare(b.fechaLimite || "9999");
    });
  }, [activos, query, estadoF, prioF, catF]);

  const handleCreate = async (data) => {
    let n;
    if (usingDb) { try { n = (await window.DB.pend.maxN()) + 1; } catch (e) { n = activos.reduce((m, p) => Math.max(m, p.n || 0), 0) + 1; } }
    else { n = activos.reduce((m, p) => Math.max(m, p.n || 0), 0) + 1; }
    let item = { ...data, id: "PEN-" + String(n).padStart(4, "0"), n, ultimaModPor: station, ultimaModFecha: new Date().toISOString(), eliminado: false };
    try { if (usingDb) item = await window.DB.pend.create(item); } catch (e) { console.error(e); flash("Error al guardar"); return; }
    setTareas((p) => [item, ...p]); setModal(null); flash("Pendiente registrado");
  };
  const handleUpdate = async (data) => {
    let updated = { ...data, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    try { if (usingDb) updated = await window.DB.pend.update(updated); } catch (e) { console.error(e); flash("Error al actualizar"); return; }
    setTareas((p) => p.map((x) => x.id === data.id ? { ...x, ...updated } : x)); setModal(null); flash("Pendiente actualizado");
  };
  const handleDelete = async (item) => {
    try { if (usingDb) await window.DB.pend.remove(item); } catch (e) { console.error(e); flash("Error al eliminar"); return; }
    setTareas((p) => p.map((x) => x.id === item.id ? { ...x, eliminado: true } : x)); setModal(null); flash("Pendiente eliminado");
  };
  const toggleHecho = (item) => handleUpdate({ ...item, estado: item.estado === "Hecho" ? "Pendiente" : "Hecho" });

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando pendientes…</div></div>;

  const modals = (
    <>
      {modal?.type === "new" && <PendFormModal mode="new" station={station} usuarios={usuarios} onClose={() => setModal(null)} onSubmit={handleCreate} />}
      {modal?.type === "edit" && <PendFormModal mode="edit" initial={modal.item} station={station} usuarios={usuarios} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
      {modal?.type === "delete" && <PendConfirmDelete item={modal.item} station={station} onClose={() => setModal(null)} onConfirm={handleDelete} />}
      {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
    </>
  );

  if (active === "pend-agenda") {
    return (<>
      <PendKpis data={activos} />
      <PendAgenda data={activos} onOpen={(p) => setModal({ type: "edit", item: p })} onToggle={toggleHecho} onNew={() => setModal({ type: "new" })} />
      {modals}
    </>);
  }
  return (<>
    <PendKpis data={activos} />
    <div className="panel">
      <div className="toolbar">
        <div className="toolbar-left"><span className="toolbar-title">Pendientes</span><span className="toolbar-count">{rows.length}</span></div>
        <div className="toolbar-right">
          <div className="seg">
            {["Activas", "Todos", ...ESTADOS_PEND].map((s) => (
              <button key={s} className={"seg-btn" + (estadoF === s ? " is-on" : "")} onClick={() => setEstadoF(s)}>{s}</button>
            ))}
          </div>
          <select className="select" value={prioF} onChange={(e) => setPrioF(e.target.value)}>
            <option value="Todos">Toda prioridad</option>
            {PRIO_PEND.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select" value={catF} onChange={(e) => setCatF(e.target.value)}>
            <option value="Todos">Toda categoría</option>
            {CATS_PEND.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="toolbar-divider" />
          <button className="btn-primary" onClick={() => setModal({ type: "new" })}><Ico name="plus" size={17} />Nuevo pendiente</button>
        </div>
      </div>
      <PendTable rows={rows} onOpen={(p) => setModal({ type: "edit", item: p })} onToggle={toggleHecho} onDelete={(p) => setModal({ type: "delete", item: p })} />
    </div>
    {modals}
  </>);
}

Object.assign(window, { PendientesModule });
