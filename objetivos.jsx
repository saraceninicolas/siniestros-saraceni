// objetivos.jsx — Saraceni Seguros · Módulo de Objetivos (metas con avance)
// Tipo "facturacion": el avance se calcula solo desde el módulo de Facturación.
// Tipo "manual": el avance se carga a mano (valor actual).

const TIPOS_OBJ = [
  { v: "facturacion", l: "Facturación (avance automático)" },
  { v: "manual", l: "Meta manual" },
];
const MES_OBJ = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ARS_OBJ = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function objPeriodo(o) { return o.mes ? `${MES_OBJ[o.mes]} ${o.anio}` : `Año ${o.anio}`; }
function objActual(o, facturas) {
  if (o.tipo === "facturacion") {
    return (facturas || [])
      .filter((f) => !f.eliminado && f.anio === o.anio && (o.mes ? f.mes === o.mes : true))
      .reduce((s, f) => s + (Number(f.total) || 0), 0);
  }
  return Number(o.valorActual) || 0;
}
function objFmt(o, v) {
  if (!o.unidad || o.unidad === "$") return ARS_OBJ.format(v);
  return (Math.round(v * 100) / 100) + " " + o.unidad;
}
function objPct(o, facturas) {
  const meta = Number(o.meta) || 0;
  if (!meta) return 0;
  return Math.round((objActual(o, facturas) / meta) * 1000) / 10;
}

// ---------- tarjeta de objetivo ----------
function ObjCard({ o, facturas, onEdit, onDelete }) {
  const actual = objActual(o, facturas);
  const pct = objPct(o, facturas);
  const done = pct >= 100;
  return (
    <div className="obj-card">
      <div className="obj-top">
        <div>
          <div className="obj-title">{o.titulo}</div>
          <div className="obj-periodo">{objPeriodo(o)} · {o.tipo === "facturacion" ? "automático (facturación)" : "manual"}</div>
        </div>
        <div className="obj-actions">
          <span className="badge" style={done ? { background: "#E6F4EA", color: "#15803D", fontSize: 11.5 } : { background: "#E8F0FE", color: "#1D4ED8", fontSize: 11.5 }}>
            {done ? "Cumplido" : "En curso"}
          </span>
          <button className="row-open" title="Editar" onClick={() => onEdit(o)}><Ico name="edit" size={14} /></button>
          <button className="row-open" title="Eliminar" onClick={() => onDelete(o)}><Ico name="trash" size={14} /></button>
        </div>
      </div>
      <div className="obj-nums">
        <span className="obj-actual">{objFmt(o, actual)}</span>
        <span className="obj-meta">de {objFmt(o, Number(o.meta) || 0)}</span>
      </div>
      <div className={"obj-bar" + (done ? " done" : "")}><span style={{ width: Math.min(100, pct) + "%" }} /></div>
      <div className="obj-pct">{pct}% de la meta{o.notas ? " · " + o.notas : ""}</div>
    </div>
  );
}

// ---------- modal + form ----------
function OModal({ title, sub, onClose, children, footer, wide }) {
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
function OField({ label, children, required, full }) {
  return (<label className={"field" + (full ? " field-full" : "")}><span className="field-label">{label}{required && <i> *</i>}</span>{children}</label>);
}
function ObjFormModal({ mode, initial, station, onClose, onSubmit }) {
  const now = new Date();
  const blank = { titulo: "", tipo: "facturacion", mes: now.getMonth() + 1, anio: now.getFullYear(), meta: "", valorActual: "", unidad: "$", notas: "" };
  const [f, setF] = React.useState(initial ? { ...blank, ...initial, mes: initial.mes == null ? "" : initial.mes } : blank);
  const [touched, setTouched] = React.useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = String(f.titulo).trim() && Number(String(f.meta).replace(",", ".")) > 0 && f.anio;
  const submit = () => { setTouched(true); if (!valid) return; onSubmit({ ...f }); };
  const esFact = f.tipo === "facturacion";
  return (
    <OModal wide title={mode === "edit" ? "Editar objetivo" : "Nuevo objetivo"}
      sub={mode === "edit" ? `${initial.id}` : "Definí la meta y el período"} onClose={onClose}
      footer={<><span className="foot-note"><Ico name="monitor" size={14} /> Como <b>{station}</b></span>
        <div className="foot-btns"><button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={!valid}><Ico name="check" size={16} />{mode === "edit" ? "Guardar" : "Crear"}</button></div></>}>
      <div className="form-grid">
        <OField label="Objetivo" required full>
          <input className={"input" + (touched && !String(f.titulo).trim() ? " err" : "")} value={f.titulo}
            onChange={(e) => set("titulo", e.target.value)} placeholder="Ej: Facturación del mes / 10 pólizas nuevas" autoFocus />
        </OField>
        <OField label="Tipo" full>
          <select className="input" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS_OBJ.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </OField>
        <OField label="Período (mes)">
          <select className="input" value={f.mes} onChange={(e) => set("mes", e.target.value)}>
            <option value="">Todo el año</option>
            {MES_OBJ.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </OField>
        <OField label="Año">
          <input className="input mono" type="number" value={f.anio} onChange={(e) => set("anio", Number(e.target.value))} />
        </OField>
        <OField label={"Meta" + (esFact ? " (monto $)" : "")} required>
          <input className={"input mono" + (touched && !(Number(String(f.meta).replace(",", ".")) > 0) ? " err" : "")}
            inputMode="decimal" value={f.meta} onChange={(e) => set("meta", e.target.value)} placeholder="Ej: 10000000" />
        </OField>
        {!esFact && (
          <>
            <OField label="Valor actual">
              <input className="input mono" inputMode="decimal" value={f.valorActual} onChange={(e) => set("valorActual", e.target.value)} placeholder="Cuánto llevás" />
            </OField>
            <OField label="Unidad">
              <input className="input" value={f.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="$, pólizas, clientes…" />
            </OField>
          </>
        )}
        <OField label="Notas" full>
          <input className="input" value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Opcional" />
        </OField>
      </div>
      {esFact && <div className="sync-note" style={{ marginTop: 12 }}><Ico name="info" size={15} /><span>El avance se calcula <b>solo</b> sumando las facturas del período elegido en el módulo de Facturación.</span></div>}
    </OModal>
  );
}
function ObjConfirmDelete({ item, station, onClose, onConfirm }) {
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm"><div className="confirm-ico"><Ico name="trash" size={22} /></div><h2>Eliminar objetivo</h2>
          <p>Vas a dar de baja el objetivo <b>{item.titulo}</b> ({objPeriodo(item)}).</p>
          <div className="confirm-note"><Ico name="monitor" size={14} /> Como <b>{station}</b></div>
          <div className="confirm-btns"><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-danger" onClick={() => onConfirm(item)}><Ico name="trash" size={15} />Sí, eliminar</button></div></div>
      </div>
    </div>
  );
}

// ---------- orquestador ----------
function ObjetivosModule({ active, station, query }) {
  const [objetivos, setObjetivos] = React.useState([]);
  const [facturas, setFacturas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [anioF, setAnioF] = React.useState("Todos");
  const [modal, setModal] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const tt = React.useRef(null);
  const flash = React.useCallback((msg) => { setToast({ msg, id: Date.now() }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2600); }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (window.DB && window.DB.configured() && window.DB.obj) {
        try {
          const [objs, facts] = await Promise.all([window.DB.obj.list(), window.DB.fact.list().catch(() => [])]);
          if (alive) { setObjetivos(objs); setFacturas(facts); setUsingDb(true); }
        } catch (e) { console.error("Objetivos:", e); if (alive) flash("No se pudieron cargar los objetivos"); }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [flash]);

  React.useEffect(() => {
    if (!usingDb || !window.DB.obj.subscribe) return;
    let timer = null, alive = true;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { try { const items = await window.DB.obj.list(); if (alive) setObjetivos(items); } catch (e) { console.error(e); } }, 400); };
    const unsub = window.DB.obj.subscribe(refresh);
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [usingDb]);

  const activos = objetivos.filter((o) => !o.eliminado);
  const anios = Array.from(new Set(activos.map((o) => o.anio))).sort();
  const list = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return activos.filter((o) => {
      if (anioF !== "Todos" && String(o.anio) !== String(anioF)) return false;
      if (q && !(o.titulo + " " + (o.notas || "")).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.anio - a.anio) || ((a.mes || 13) - (b.mes || 13)));
  }, [activos, query, anioF]);

  const cumplidos = activos.filter((o) => objPct(o, facturas) >= 100).length;
  const enCurso = activos.length - cumplidos;
  const promedio = activos.length
    ? Math.round(activos.reduce((s, o) => s + Math.min(100, objPct(o, facturas)), 0) / activos.length)
    : 0;

  const handleCreate = async (data) => {
    let n;
    if (usingDb) { try { n = (await window.DB.obj.maxN()) + 1; } catch (e) { n = activos.reduce((m, o) => Math.max(m, o.n || 0), 0) + 1; } }
    else { n = activos.reduce((m, o) => Math.max(m, o.n || 0), 0) + 1; }
    let item = { ...data, id: "OBJ-" + String(n).padStart(4, "0"), n, ultimaModPor: station, ultimaModFecha: new Date().toISOString(), eliminado: false };
    try { if (usingDb) item = await window.DB.obj.create(item); } catch (e) { console.error(e); flash("Error al guardar"); return; }
    setObjetivos((p) => [item, ...p]); setModal(null); flash("Objetivo creado");
  };
  const handleUpdate = async (data) => {
    let updated = { ...data, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    try { if (usingDb) updated = await window.DB.obj.update(updated); } catch (e) { console.error(e); flash("Error al actualizar"); return; }
    setObjetivos((p) => p.map((o) => o.id === data.id ? { ...o, ...updated } : o)); setModal(null); flash("Objetivo actualizado");
  };
  const handleDelete = async (item) => {
    try { if (usingDb) await window.DB.obj.remove(item); } catch (e) { console.error(e); flash("Error al eliminar"); return; }
    setObjetivos((p) => p.map((o) => o.id === item.id ? { ...o, eliminado: true } : o)); setModal(null); flash("Objetivo eliminado");
  };

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando objetivos…</div></div>;

  const kpis = (
    <div className="kpis" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
      {[
        { label: "Objetivos en curso", value: enCurso, hint: "sin cumplir todavía", tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "target" },
        { label: "Cumplidos", value: cumplidos, hint: "meta alcanzada", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "check" },
        { label: "Avance promedio", value: promedio + "%", hint: "de todas las metas", tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "grid" },
      ].map((c) => (
        <div className="kpi" key={c.label}>
          <span className="kpi-stripe" style={{ background: c.tone.fg }} />
          <div className="kpi-top"><span className="kpi-ico" style={{ background: c.tone.bg, color: c.tone.fg }}><Ico name={c.icon} size={17} /></span><span className="kpi-label">{c.label}</span></div>
          <div className="kpi-mid"><span className="kpi-value">{c.value}</span></div>
          <div className="kpi-foot"><span className="kpi-hint">{c.hint}</span></div>
        </div>
      ))}
    </div>
  );

  return (<>
    {kpis}
    <div className="panel" style={{ background: "transparent", border: "none", boxShadow: "none", overflow: "visible" }}>
      <div className="toolbar" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", marginBottom: 16 }}>
        <div className="toolbar-left"><span className="toolbar-title">{active === "obj-metas" ? "Metas y seguimiento" : "Objetivos"}</span><span className="toolbar-count">{list.length}</span></div>
        <div className="toolbar-right">
          <select className="select" value={anioF} onChange={(e) => setAnioF(e.target.value)}>
            <option value="Todos">Todos los años</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setModal({ type: "new" })}><Ico name="plus" size={17} />Nuevo objetivo</button>
        </div>
      </div>
      {list.length ? (
        <div className="obj-grid">
          {list.map((o) => (
            <ObjCard key={o.id} o={o} facturas={facturas}
              onEdit={(x) => setModal({ type: "edit", item: x })}
              onDelete={(x) => setModal({ type: "delete", item: x })} />
          ))}
        </div>
      ) : (
        <div className="empty"><div className="empty-ico"><Ico name="target" size={26} /></div>
          <div className="empty-title">Sin objetivos</div>
          <div className="empty-sub">Creá tu primera meta con "Nuevo objetivo".</div></div>
      )}
    </div>

    {modal?.type === "new" && <ObjFormModal mode="new" station={station} onClose={() => setModal(null)} onSubmit={handleCreate} />}
    {modal?.type === "edit" && <ObjFormModal mode="edit" initial={modal.item} station={station} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
    {modal?.type === "delete" && <ObjConfirmDelete item={modal.item} station={station} onClose={() => setModal(null)} onConfirm={handleDelete} />}
    {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
  </>);
}

Object.assign(window, { ObjetivosModule });
