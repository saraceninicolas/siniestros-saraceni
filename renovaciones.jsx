// renovaciones.jsx — Saraceni Seguros · Módulo de Renovaciones

const ESTADOS_RENOV = ["Pendiente", "En gestión", "Renovada", "No renueva"];
const ESTADO_RENOV_COLOR = {
  "Pendiente": { fg: "#B45309", bg: "#FEF3E2" },
  "En gestión": { fg: "#1D4ED8", bg: "#E8F0FE" },
  "Renovada": { fg: "#15803D", bg: "#E6F4EA" },
  "No renueva": { fg: "#475569", bg: "#EEF1F4" },
};
const MESES_R = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_R_CORTO = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const RESUELTOS = ["Renovada", "No renueva"];

function fmtF(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function fmtFShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function addYearISO(iso, y) {
  if (!iso) return iso;
  const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return iso;
  d.setFullYear(d.getFullYear() + y);
  return d.toISOString().slice(0, 10);
}
function urgenciaR(finVig) {
  const du = daysUntil(finVig);
  if (du == null) return "adelante";
  if (du < 0) return "vencido";
  if (du <= 30) return "pronto";
  if (du <= 60) return "proximo";
  return "adelante";
}
function faltanTexto(finVig) {
  const du = daysUntil(finVig);
  if (du == null) return "—";
  if (du < 0) return "venció hace " + Math.abs(du) + " d";
  if (du === 0) return "vence hoy";
  if (du === 1) return "vence mañana";
  return "faltan " + du + " d";
}
function estadoBadgeR(estado) {
  const c = ESTADO_RENOV_COLOR[estado] || { fg: "#475569", bg: "#EEF1F4" };
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 11.5 }}><span className="badge-dot" style={{ background: c.fg }} />{estado}</span>;
}

const BUCKETS_R = [
  { key: "vencido", label: "Vencidas", icon: "alert", head: "ag-vencido", rail: "ag-rail-vencido" },
  { key: "pronto", label: "Vencen en ≤ 30 días", icon: "clock", head: "ag-hoy", rail: "ag-rail-hoy" },
  { key: "proximo", label: "En 31 – 60 días", icon: "clock", head: "ag-proximo", rail: "ag-rail-proximo" },
  { key: "adelante", label: "Más adelante", icon: "agenda", head: "ag-normal", rail: "ag-rail-normal" },
];

// ---------- KPIs ----------
function RenovKpis({ data }) {
  const pend = data.filter((r) => RESUELTOS.indexOf(r.estado) < 0);
  const vencidas = pend.filter((r) => urgenciaR(r.finVig) === "vencido").length;
  const esteMes = pend.filter((r) => urgenciaR(r.finVig) === "pronto").length;
  const renovadas = data.filter((r) => r.estado === "Renovada").length;
  const cards = [
    { label: "Pólizas a renovar", value: pend.length, hint: "pendientes", tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "refresh" },
    { label: "Vencen ≤ 30 días", value: esteMes, hint: "próximas", tone: { bg: "#FEF3E2", fg: "#D97706" }, icon: "clock" },
    { label: "Vencidas", value: vencidas, hint: "requieren acción", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "alert" },
    { label: "Renovadas", value: renovadas, hint: "cerradas", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "check" },
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

// ---------- próximas a vencer (worklist) ----------
function RenovProximas({ data, onOpen, onRenovar, onNew }) {
  const pend = data.filter((r) => RESUELTOS.indexOf(r.estado) < 0 && r.finVig);
  const groups = {};
  BUCKETS_R.forEach((b) => (groups[b.key] = []));
  pend.forEach((r) => groups[urgenciaR(r.finVig)].push(r));
  Object.values(groups).forEach((arr) => arr.sort((a, b) => (daysUntil(a.finVig) - daysUntil(b.finVig))));
  const total = pend.length;
  return (
    <div className="agenda">
      <div className="ag-banner">
        <span className="ag-banner-ico"><Ico name="refresh" size={22} /></span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Renovaciones próximas</span>
          <span className="ag-banner-sub">{total} pólizas pendientes de renovar</span>
        </div>
        <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={onNew}><Ico name="plus" size={16} />Registrar renovación</button>
      </div>
      {BUCKETS_R.map((b) => groups[b.key].length > 0 && (
        <section className="ag-group" key={b.key}>
          <div className={"ag-head " + b.head}><Ico name={b.icon} size={16} /><span>{b.label}</span><span className="ag-count">{groups[b.key].length}</span></div>
          <div className="ag-list">
            {groups[b.key].map((r) => (
              <button className="ag-card" key={r.id} onClick={() => onOpen(r.id)}>
                <span className={"ag-rail " + b.rail} />
                <div className="ag-card-main">
                  <div className="ag-card-top">
                    <span className="ag-client">{r.cliente}</span>
                    {estadoBadgeR(r.estado)}
                  </div>
                  <div className="ag-gestion">Póliza <span className="mono">{r.poliza || "—"}</span> · {r.seccion || "—"}</div>
                  <div className="ag-meta">
                    <span className="cia-pill sm">{r.aseguradora || "—"}</span>
                    <span className="ag-dot">·</span>
                    <span className="ag-gestor"><Ico name="clock" size={12} />{faltanTexto(r.finVig)}</span>
                  </div>
                </div>
                <div className="ag-card-right">
                  <span className="ag-vence-label">Vence</span>
                  <span className="ag-vence-date mono">{fmtFShort(r.finVig)}</span>
                  <span className="ag-vence-rel">{r.finVig ? new Date(r.finVig + "T00:00:00").getFullYear() : ""}</span>
                  <span className="btn-gcal xs" style={{ background: "#15803D", borderColor: "#15803D" }} onClick={(e) => { e.stopPropagation(); onRenovar(r); }}><Ico name="refresh" size={13} />Renovar</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {total === 0 && (
        <div className="empty"><div className="empty-ico"><Ico name="check" size={26} /></div>
          <div className="empty-title">Sin renovaciones pendientes</div>
          <div className="empty-sub">No hay pólizas por renovar cargadas.</div></div>
      )}
    </div>
  );
}

// ---------- historial (tabla) ----------
function RenovToolbar({ count, aseguradoras, secciones, anios, asegF, onAseg, seccF, onSecc, estadoF, onEstado, anioF, onAnio, selected, onNew, onEdit, onDelete }) {
  return (
    <div className="toolbar">
      <div className="toolbar-left"><span className="toolbar-title">Renovaciones</span><span className="toolbar-count">{count}</span></div>
      <div className="toolbar-right">
        <div className="seg">
          {["Todos", ...ESTADOS_RENOV].map((s) => (
            <button key={s} className={"seg-btn" + (estadoF === s ? " is-on" : "")} onClick={() => onEstado(s)}>{s}</button>
          ))}
        </div>
        <select className="select" value={anioF} onChange={(e) => onAnio(e.target.value)}>
          <option value="Todos">Todos los años</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select" value={asegF} onChange={(e) => onAseg(e.target.value)}>
          <option value="Todos">Todas las aseguradoras</option>
          {aseguradoras.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select" value={seccF} onChange={(e) => onSecc(e.target.value)}>
          <option value="Todos">Todas las secciones</option>
          {secciones.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="toolbar-divider" />
        <button className="btn-ghost" disabled={!selected} onClick={onEdit}><Ico name="edit" size={15} />Editar</button>
        <button className="btn-ghost danger" disabled={!selected} onClick={onDelete}><Ico name="trash" size={15} />Eliminar</button>
        <button className="btn-primary" onClick={onNew}><Ico name="plus" size={17} />Registrar</button>
      </div>
    </div>
  );
}
function RenovTable({ rows, selectedId, onSelect, onOpen }) {
  if (!rows.length) {
    return (<div className="empty"><div className="empty-ico"><Ico name="search" size={26} /></div><div className="empty-title">Sin resultados</div><div className="empty-sub">No hay renovaciones que coincidan.</div></div>);
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          <th style={{ width: 34 }}></th><th>Vence</th><th>Estado</th><th>Cliente</th><th>Aseguradora</th><th>Sección</th><th>Póliza</th><th style={{ width: 44 }}></th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={selectedId === r.id ? "is-selected" : ""} onClick={() => onOpen(r.id)}>
              <td onClick={(e) => { e.stopPropagation(); onSelect(selectedId === r.id ? null : r.id); }}><span className={"radio" + (selectedId === r.id ? " on" : "")} /></td>
              <td><div className="vence"><span className="vence-date mono">{fmtF(r.finVig)}</span><span className="cell-sub">{faltanTexto(r.finVig)}</span></div></td>
              <td>{estadoBadgeR(r.estado)}</td>
              <td><div className="cell-strong">{r.cliente}</div></td>
              <td><span className="cia-pill">{r.aseguradora || "—"}</span></td>
              <td className="dim">{r.seccion || "—"}</td>
              <td><div className="mono cell-id">{r.poliza || "—"}</div><div className="cell-sub">{r.id}</div></td>
              <td onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}><button className="row-open" title="Ver detalle"><Ico name="chevR" size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- modal + form ----------
function RModal({ title, sub, onClose, children, footer, wide }) {
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
function RField({ label, children, required, full }) {
  return (<label className={"field" + (full ? " field-full" : "")}><span className="field-label">{label}{required && <i> *</i>}</span>{children}</label>);
}
function RenovFormModal({ mode, initial, station, onClose, onSubmit }) {
  const blank = { poliza: "", cliente: "", aseguradora: "", seccion: "", inicioVig: "", finVig: "", estado: "Pendiente", observaciones: "" };
  const [f, setF] = React.useState(initial ? { ...blank, ...initial } : blank);
  const [touched, setTouched] = React.useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = String(f.cliente).trim() && f.finVig;
  const submit = () => { setTouched(true); if (!valid) return; onSubmit({ ...f }); };
  return (
    <RModal wide title={mode === "edit" ? "Editar renovación" : "Registrar renovación"}
      sub={mode === "edit" ? `${initial.id} · ${initial.cliente}` : "Cargá la póliza a renovar"} onClose={onClose}
      footer={<><span className="foot-note"><Ico name="monitor" size={14} /> Como <b>{station}</b></span>
        <div className="foot-btns"><button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={!valid}><Ico name="check" size={16} />{mode === "edit" ? "Guardar" : "Registrar"}</button></div></>}>
      <div className="form-grid">
        <RField label="Cliente" required full><input className={"input" + (touched && !String(f.cliente).trim() ? " err" : "")} value={f.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nombre / razón social" /></RField>
        <RField label="N° de póliza"><input className="input mono" value={f.poliza} onChange={(e) => set("poliza", e.target.value)} placeholder="000000" /></RField>
        <RField label="Aseguradora"><input className="input" value={f.aseguradora} onChange={(e) => set("aseguradora", e.target.value)} placeholder="Allianz, Mercantil Andina…" /></RField>
        <RField label="Sección / Ramo"><input className="input" value={f.seccion} onChange={(e) => set("seccion", e.target.value)} placeholder="AUTOS, INT.COMERC…" /></RField>
        <RField label="Estado">
          <select className="input" value={f.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS_RENOV.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </RField>
        <RField label="Inicio de vigencia"><input className="input" type="date" value={f.inicioVig} onChange={(e) => set("inicioVig", e.target.value)} /></RField>
        <RField label="Fin de vigencia (vence)" required><input className={"input" + (touched && !f.finVig ? " err" : "")} type="date" value={f.finVig} onChange={(e) => set("finVig", e.target.value)} /></RField>
        <RField label="Observaciones" full><textarea className="input" rows={2} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} placeholder="Notas…" /></RField>
      </div>
    </RModal>
  );
}
function RenovDetailModal({ item, onClose, onEdit, onDelete, onRenovar }) {
  const Row = ({ k, v, mono }) => (<div className="dt-row"><span className="dt-k">{k}</span><span className={"dt-v" + (mono ? " mono" : "")}>{v || "—"}</span></div>);
  return (
    <RModal wide title={item.cliente} sub={<span className="mono">Póliza {item.poliza || "—"} · {item.id}</span>} onClose={onClose}
      footer={<><button className="btn-ghost danger" onClick={() => onDelete(item)}><Ico name="trash" size={15} />Eliminar</button>
        <div className="foot-btns"><button className="btn-ghost" onClick={() => onEdit(item)}><Ico name="edit" size={15} />Editar</button>
          <button className="btn-primary" onClick={() => onRenovar(item)}><Ico name="refresh" size={15} />Renovar (+1 año)</button></div></>}>
      <div className="dt-head">{estadoBadgeR(item.estado)}<span className="cia-pill">{item.aseguradora || "—"}</span><span className="dt-cal"><Ico name="clock" size={13} />{faltanTexto(item.finVig)}</span></div>
      <div className="dt-action">
        <div className="dt-action-k"><Ico name="refresh" size={14} />Vencimiento de la póliza</div>
        <div className="dt-action-v">{fmtF(item.finVig)}</div>
        <div className="dt-action-deadline">Vigencia desde <b className="mono">{fmtF(item.inicioVig)}</b></div>
      </div>
      <div className="dt-cols">
        <div className="dt-block"><span className="dt-block-title">Póliza</span>
          <Row k="Cliente" v={item.cliente} /><Row k="N° póliza" v={item.poliza} mono /><Row k="Aseguradora" v={item.aseguradora} /><Row k="Sección" v={item.seccion} />
        </div>
        <div className="dt-block"><span className="dt-block-title">Vigencia</span>
          <Row k="Inicio" v={fmtF(item.inicioVig)} mono /><Row k="Fin (vence)" v={fmtF(item.finVig)} mono /><Row k="Estado" v={item.estado} />
        </div>
      </div>
      {item.observaciones && <div className="dt-block"><span className="dt-block-title">Observaciones</span><p className="dt-obs">{item.observaciones}</p></div>}
    </RModal>
  );
}
function RenovConfirmDelete({ item, station, onClose, onConfirm }) {
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm"><div className="confirm-ico"><Ico name="trash" size={22} /></div><h2>Eliminar renovación</h2>
          <p>Vas a dar de baja la renovación de <b>{item.cliente}</b> (póliza <span className="mono">{item.poliza || item.id}</span>).</p>
          <div className="confirm-note"><Ico name="monitor" size={14} /> Como <b>{station}</b></div>
          <div className="confirm-btns"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-danger" onClick={() => onConfirm(item)}><Ico name="trash" size={15} />Sí, eliminar</button></div></div>
      </div>
    </div>
  );
}

// ---------- orquestador ----------
function RenovacionesModule({ active, station, query }) {
  const [renovs, setRenovs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [estadoF, setEstadoF] = React.useState("Todos");
  const [asegF, setAsegF] = React.useState("Todos");
  const [seccF, setSeccF] = React.useState("Todos");
  const [anioF, setAnioF] = React.useState("Todos");
  const [selectedId, setSelectedId] = React.useState(null);
  const [detailId, setDetailId] = React.useState(null);
  const [modal, setModal] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const tt = React.useRef(null);
  const flash = React.useCallback((msg) => { setToast({ msg, id: Date.now() }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2600); }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (window.DB && window.DB.configured() && window.DB.renov) {
        try { const items = await window.DB.renov.list(); if (alive) { setRenovs(items); setUsingDb(true); } }
        catch (e) { console.error("Renov:", e); if (alive) { setRenovs([]); setUsingDb(false); flash("No se pudieron cargar las renovaciones"); } }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [flash]);

  React.useEffect(() => {
    if (!usingDb || !window.DB.renov || !window.DB.renov.subscribe) return;
    let timer = null, alive = true;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { try { const items = await window.DB.renov.list(); if (alive) setRenovs(items); } catch (e) { console.error(e); } }, 400); };
    const unsub = window.DB.renov.subscribe(refresh);
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [usingDb]);

  const activos = renovs.filter((r) => !r.eliminado);
  const aseguradoras = Array.from(new Set(activos.map((r) => r.aseguradora).filter(Boolean))).sort();
  const secciones = Array.from(new Set(activos.map((r) => r.seccion).filter(Boolean))).sort();
  const anios = Array.from(new Set(activos.map((r) => (r.finVig ? new Date(r.finVig + "T00:00:00").getFullYear() : null)).filter(Boolean))).sort();

  const rows = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return activos.filter((r) => {
      if (estadoF !== "Todos" && r.estado !== estadoF) return false;
      if (asegF !== "Todos" && r.aseguradora !== asegF) return false;
      if (seccF !== "Todos" && r.seccion !== seccF) return false;
      if (anioF !== "Todos" && String(r.finVig ? new Date(r.finVig + "T00:00:00").getFullYear() : "") !== String(anioF)) return false;
      if (q) { const hay = [r.cliente, r.poliza, r.aseguradora, r.seccion, r.id].join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    }).sort((a, b) => (a.finVig || "").localeCompare(b.finVig || ""));
  }, [activos, query, estadoF, asegF, seccF, anioF]);

  const selected = activos.find((r) => r.id === selectedId) || null;
  const detailItem = activos.find((r) => r.id === detailId) || null;
  const openEdit = (item) => { setDetailId(null); setModal({ type: "edit", item }); };
  const askDelete = (item) => { setDetailId(null); setModal({ type: "delete", item }); };

  const persist = async (item, isNew) => {
    if (!usingDb) return item;
    return isNew ? await window.DB.renov.create(item) : await window.DB.renov.update(item);
  };
  const handleCreate = async (data) => {
    let n;
    if (usingDb) { try { n = (await window.DB.renov.maxN()) + 1; } catch (e) { n = activos.reduce((m, r) => Math.max(m, r.n || 0), 0) + 1; } }
    else { n = activos.reduce((m, r) => Math.max(m, r.n || 0), 0) + 1; }
    let item = { ...data, id: "REN-" + String(n).padStart(4, "0"), n, ultimaModPor: station, ultimaModFecha: new Date().toISOString(), eliminado: false };
    try { if (usingDb) item = await window.DB.renov.create(item); } catch (e) { console.error(e); flash("Error al guardar"); return; }
    setRenovs((p) => [item, ...p]); setModal(null); flash(`Renovación de ${data.cliente} registrada`);
  };
  const handleUpdate = async (data) => {
    let updated = { ...data, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    try { if (usingDb) updated = await window.DB.renov.update(updated); } catch (e) { console.error(e); flash("Error al actualizar"); return; }
    setRenovs((p) => p.map((r) => r.id === data.id ? { ...r, ...updated } : r)); setModal(null); flash(`Renovación de ${data.cliente} actualizada`);
  };
  const handleDelete = async (item) => {
    try { if (usingDb) await window.DB.renov.remove(item); } catch (e) { console.error(e); flash("Error al eliminar"); return; }
    setRenovs((p) => p.map((r) => r.id === item.id ? { ...r, eliminado: true } : r));
    if (selectedId === item.id) setSelectedId(null); setModal(null); flash(`Renovación de ${item.cliente} dada de baja`);
  };
  const handleRenovar = async (item) => {
    const rolled = { ...item, inicioVig: addYearISO(item.inicioVig, 1), finVig: addYearISO(item.finVig, 1), estado: "Pendiente", ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    let updated = rolled;
    try { if (usingDb) updated = await window.DB.renov.update(rolled); } catch (e) { console.error(e); flash("Error al renovar"); return; }
    setRenovs((p) => p.map((r) => r.id === item.id ? { ...r, ...updated } : r));
    setDetailId(null); flash(`${item.cliente} renovada — vuelve el año próximo`);
  };

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando renovaciones…</div></div>;

  const modals = (
    <>
      {detailItem && <RenovDetailModal item={detailItem} onClose={() => setDetailId(null)} onEdit={openEdit} onDelete={askDelete} onRenovar={handleRenovar} />}
      {modal?.type === "new" && <RenovFormModal mode="new" station={station} onClose={() => setModal(null)} onSubmit={handleCreate} />}
      {modal?.type === "edit" && <RenovFormModal mode="edit" initial={modal.item} station={station} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
      {modal?.type === "delete" && <RenovConfirmDelete item={modal.item} station={station} onClose={() => setModal(null)} onConfirm={handleDelete} />}
      {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
    </>
  );

  if (active === "renov-proximas") {
    return (<>
      <RenovKpis data={activos} />
      <RenovProximas data={activos} onOpen={(id) => setDetailId(id)} onRenovar={handleRenovar} onNew={() => setModal({ type: "new" })} />
      {modals}
    </>);
  }
  return (<>
    <div className="panel">
      <RenovToolbar count={rows.length} aseguradoras={aseguradoras} secciones={secciones} anios={anios}
        asegF={asegF} onAseg={setAsegF} seccF={seccF} onSecc={setSeccF} estadoF={estadoF} onEstado={setEstadoF} anioF={anioF} onAnio={setAnioF}
        selected={selected} onNew={() => setModal({ type: "new" })} onEdit={() => selected && openEdit(selected)} onDelete={() => selected && askDelete(selected)} />
      <RenovTable rows={rows} selectedId={selectedId} onSelect={setSelectedId} onOpen={(id) => setDetailId(id)} />
    </div>
    {modals}
  </>);
}

Object.assign(window, { RenovacionesModule });
