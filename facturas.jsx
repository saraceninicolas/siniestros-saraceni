// facturas.jsx — Saraceni Seguros · Facturación
// ─────────────────────────────────────────────────────────────────────────────
// Reestructurado sobre dos tablas: `fact_companias` guarda lo que nunca cambia
// (razón social, CUIT, tipo, envío) y `fact_mensual` solo los importes de cada
// mes. La pantalla principal es la CARGA MENSUAL: se elige el período y se
// completa una fila por compañía, sin volver a escribir los datos fijos.
// ─────────────────────────────────────────────────────────────────────────────

const MESES_F = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const money0 = (v) => (v == null || v === "" ? "—" : "$ " + Math.round(Number(v)).toLocaleString("es-AR"));
const moneyK = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(1).replace(".", ",") + "M";
  if (Math.abs(n) >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + Math.round(n);
};
// "1.234.567,89" o "1234567.89" → 1234567.89
const parseMonto = (v) => {
  if (v === "" || v == null) return null;
  let s = String(v).trim().replace(/[$\s]/g, "");
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
};
const IVA_PCT = 0.21;

// ============================ CARGA MENSUAL ============================
// Una fila por compañía: se ven los datos fijos y se completan los del mes.
function CargaMensual({ companias, movs, anio, mes, onAnio, onMes, onGuardar, onGuardarTodo, station }) {
  const hoy = new Date();
  const [edit, setEdit] = React.useState({});     // { companiaId: {campo: valor} }
  const [guardando, setGuardando] = React.useState(null);

  // lo cargado en la base para este período, indexado por compañía
  const delMes = React.useMemo(() => {
    const m = {};
    movs.filter((x) => x.anio === anio && x.mes === mes).forEach((x) => { m[x.companiaId] = x; });
    return m;
  }, [movs, anio, mes]);

  React.useEffect(() => { setEdit({}); }, [anio, mes]);

  const valorDe = (c, campo) => {
    const e = edit[c.id];
    if (e && e[campo] !== undefined) return e[campo];
    const g = delMes[c.id];
    if (!g) return "";
    const v = g[campo];
    return v == null ? "" : v;
  };
  const setCampo = (c, campo, valor) => {
    setEdit((p) => {
      const fila = { ...(p[c.id] || {}), [campo]: valor };
      // al cargar el neto calculamos IVA y total (para tipo A); el usuario puede corregirlos
      if (campo === "neto" && c.tipo === "A") {
        const neto = parseMonto(valor);
        if (neto != null) {
          fila.iva = (neto * IVA_PCT).toFixed(2);
          fila.total = (neto * (1 + IVA_PCT)).toFixed(2);
        }
      }
      if (campo === "neto" && c.tipo !== "A") {
        const neto = parseMonto(valor);
        if (neto != null) fila.total = String(neto);
      }
      return { ...p, [c.id]: fila };
    });
  };
  const filaSucia = (c) => !!edit[c.id] && Object.keys(edit[c.id]).length > 0;

  const guardarFila = async (c) => {
    const e = edit[c.id] || {};
    const g = delMes[c.id] || {};
    const item = {
      _dbId: g._dbId, companiaId: c.id, anio, mes,
      fecha: e.fecha !== undefined ? e.fecha : (g.fecha || ""),
      nroFactura: e.nroFactura !== undefined ? e.nroFactura : (g.nroFactura || ""),
      neto: parseMonto(e.neto !== undefined ? e.neto : g.neto),
      iva: parseMonto(e.iva !== undefined ? e.iva : g.iva),
      total: parseMonto(e.total !== undefined ? e.total : g.total),
      enviado: e.enviado !== undefined ? e.enviado : !!g.enviado,
      pago: parseMonto(e.pago !== undefined ? e.pago : g.pago),
      observaciones: e.observaciones !== undefined ? e.observaciones : (g.observaciones || ""),
      ultimaModPor: station,
    };
    setGuardando(c.id);
    await onGuardar(item);
    setEdit((p) => { const q = { ...p }; delete q[c.id]; return q; });
    setGuardando(null);
  };

  const guardarTodo = async () => {
    const pendientes = companias.filter(filaSucia);
    if (!pendientes.length) return;
    setGuardando("todo");
    for (const c of pendientes) await guardarFila(c);
    setGuardando(null);
  };

  const sucias = companias.filter(filaSucia).length;
  const cargadas = companias.filter((c) => delMes[c.id] && delMes[c.id].total != null).length;
  const totalMes = companias.reduce((s, c) => {
    const v = parseMonto(valorDe(c, "total"));
    return s + (v || 0);
  }, 0);
  const cobradoMes = companias.reduce((s, c) => {
    const v = parseMonto(valorDe(c, "pago"));
    return s + (v || 0);
  }, 0);
  const anios = [];
  for (let a = hoy.getFullYear() + 1; a >= 2025; a--) anios.push(a);

  return (
    <div>
      {/* selector de período */}
      <div className="fact-periodo">
        <div className="fact-periodo-sel">
          <span className="fact-periodo-label">Período</span>
          <div className="fact-mes-pills">
            {MESES_CORTO.map((m, i) => (
              <button key={m} className={"fact-mes-pill" + (mes === i + 1 ? " on" : "")} onClick={() => onMes(i + 1)}>{m}</button>
            ))}
          </div>
          <select className="select" value={anio} onChange={(e) => onAnio(Number(e.target.value))}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="fact-periodo-res">
          <div><span className="fact-res-k">Facturado</span><span className="fact-res-v">{money0(totalMes)}</span></div>
          <div><span className="fact-res-k">Cobrado</span><span className="fact-res-v">{money0(cobradoMes)}</span></div>
          <div><span className="fact-res-k">Cargadas</span><span className="fact-res-v">{cargadas}/{companias.length}</span></div>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <span className="toolbar-title">{MESES_F[mes - 1]} {anio}</span>
            <span className="toolbar-count">{companias.length}</span>
          </div>
          <div className="toolbar-right">
            {sucias > 0 && <span className="fact-sucias">{sucias} sin guardar</span>}
            <button className="btn-primary" disabled={!sucias || guardando === "todo"} onClick={guardarTodo}>
              <Ico name="check" size={16} />{guardando === "todo" ? "Guardando…" : "Guardar todo"}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table fact-carga">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Compañía</th>
                <th style={{ width: 108 }}>Fecha</th>
                <th style={{ width: 78 }}>N° fac</th>
                <th style={{ width: 124 }}>Neto</th>
                <th style={{ width: 116 }}>IVA</th>
                <th style={{ width: 124 }}>Total</th>
                <th style={{ width: 62 }}>Envío</th>
                <th style={{ width: 124 }}>Cobrado</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {companias.map((c) => {
                const sucia = filaSucia(c);
                const g = delMes[c.id];
                const yaCargada = g && g.total != null;
                return (
                  <tr key={c.id} className={sucia ? "fact-row-sucia" : ""}>
                    <td>
                      <div className="cell-strong">{c.razonSocial}</div>
                      <div className="cell-sub">
                        <span className="mono">{c.cuit}</span>
                        {c.tipo && <span className="fact-tag">Fac. {c.tipo}</span>}
                        {c.envio && <span className="fact-envio" title={c.envio}>{c.envio === "WEB" ? "WEB" : "mail"}</span>}
                      </div>
                    </td>
                    <td><input className="input sm" type="date" value={valorDe(c, "fecha") || ""} onChange={(e) => setCampo(c, "fecha", e.target.value)} /></td>
                    <td><input className="input sm mono" value={valorDe(c, "nroFactura")} onChange={(e) => setCampo(c, "nroFactura", e.target.value)} placeholder="—" /></td>
                    <td><input className="input sm mono num" value={valorDe(c, "neto")} onChange={(e) => setCampo(c, "neto", e.target.value)} placeholder="0" inputMode="decimal" /></td>
                    <td><input className="input sm mono num" value={valorDe(c, "iva")} onChange={(e) => setCampo(c, "iva", e.target.value)} placeholder={c.tipo === "A" ? "auto" : "—"} inputMode="decimal" /></td>
                    <td><input className="input sm mono num strong" value={valorDe(c, "total")} onChange={(e) => setCampo(c, "total", e.target.value)} placeholder="0" inputMode="decimal" /></td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" className="fact-chk" checked={!!valorDe(c, "enviado")} onChange={(e) => setCampo(c, "enviado", e.target.checked)} title="Factura enviada" />
                    </td>
                    <td><input className="input sm mono num" value={valorDe(c, "pago")} onChange={(e) => setCampo(c, "pago", e.target.value)} placeholder="—" inputMode="decimal" /></td>
                    <td>
                      {sucia ? (
                        <button className="row-open ok" title="Guardar esta fila" disabled={guardando === c.id} onClick={() => guardarFila(c)}>
                          <Ico name="check" size={16} />
                        </button>
                      ) : yaCargada ? <span className="fact-ok" title="Cargada">✓</span> : <span className="urg-none">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {companias.length === 0 && (
          <div className="empty"><div className="empty-ico"><Ico name="doc" size={26} /></div>
            <div className="empty-title">No hay compañías cargadas</div>
            <div className="empty-sub">Andá a “Compañías” y cargá las que facturás todos los meses.</div></div>
        )}
      </div>
    </div>
  );
}

// ============================ CRECIMIENTO ANUAL ============================
// Matriz compañías × meses con el total facturado y la variación contra el mes
// anterior, igual que la hoja "crecimiento" del Excel.
function CrecimientoAnual({ companias, movs, anio, onAnio }) {
  const [verPct, setVerPct] = React.useState(true);
  const hoy = new Date();
  const anios = [];
  for (let a = hoy.getFullYear() + 1; a >= 2025; a--) anios.push(a);

  const idx = React.useMemo(() => {
    const m = {};
    movs.forEach((x) => { m[x.companiaId + "-" + x.anio + "-" + x.mes] = x; });
    return m;
  }, [movs]);
  const totalDe = (cid, a, ms) => {
    const r = idx[cid + "-" + a + "-" + ms];
    return r && r.total != null ? Number(r.total) : null;
  };
  // mes anterior, cruzando el cambio de año
  const anteriorDe = (cid, ms) => (ms === 1 ? totalDe(cid, anio - 1, 12) : totalDe(cid, anio, ms - 1));
  const pct = (act, ant) => (act == null || ant == null || ant === 0 ? null : ((act - ant) / ant) * 100);

  const totalesMes = MESES_CORTO.map((_, i) =>
    companias.reduce((s, c) => s + (totalDe(c.id, anio, i + 1) || 0), 0));
  const totalAnual = totalesMes.reduce((a, b) => a + b, 0);
  const mesesConDatos = totalesMes.filter((t) => t > 0).length;

  const PctTag = ({ v }) => {
    if (v == null) return <span className="fact-pct nulo">—</span>;
    const cls = v > 0.5 ? "sube" : v < -0.5 ? "baja" : "igual";
    return <span className={"fact-pct " + cls}>{v > 0 ? "+" : ""}{v.toFixed(0)}%</span>;
  };

  return (
    <div>
      <div className="kpis">
        {[
          { label: "Facturado " + anio, value: money0(totalAnual), hint: mesesConDatos + " meses cargados", tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "doc" },
          { label: "Promedio mensual", value: money0(mesesConDatos ? totalAnual / mesesConDatos : 0), hint: "sobre meses con datos", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "grid" },
          { label: "Mejor mes", value: mesesConDatos ? MESES_F[totalesMes.indexOf(Math.max(...totalesMes))] : "—", hint: money0(Math.max(...totalesMes, 0)), tone: { bg: "#FDF1DC", fg: "#B45309" }, icon: "target" },
          { label: "Compañías", value: companias.length, hint: "en el listado", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "folder" },
        ].map((c) => (
          <div className="kpi" key={c.label}>
            <span className="kpi-stripe" style={{ background: c.tone.fg }} />
            <div className="kpi-top"><span className="kpi-ico" style={{ background: c.tone.bg, color: c.tone.fg }}><Ico name={c.icon} size={17} /></span><span className="kpi-label">{c.label}</span></div>
            <div className="kpi-mid"><span className="kpi-value" style={{ fontSize: 22 }}>{c.value}</span></div>
            <div className="kpi-foot"><span className="kpi-hint">{c.hint}</span></div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left"><span className="toolbar-title">Crecimiento {anio}</span></div>
          <div className="toolbar-right">
            <button className="btn-ghost sm" onClick={() => setVerPct((v) => !v)}>
              <Ico name="refresh" size={14} />{verPct ? "Ocultar variación" : "Ver variación"}
            </button>
            <select className="select" value={anio} onChange={(e) => onAnio(Number(e.target.value))}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table fact-matriz">
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Compañía</th>
                {MESES_CORTO.map((m) => <th key={m} style={{ textAlign: "right" }}>{m}</th>)}
                <th style={{ textAlign: "right", minWidth: 96 }}>Año</th>
              </tr>
            </thead>
            <tbody>
              {companias.map((c) => {
                const fila = MESES_CORTO.map((_, i) => totalDe(c.id, anio, i + 1));
                const anual = fila.reduce((s, v) => s + (v || 0), 0);
                return (
                  <tr key={c.id}>
                    <td><div className="cell-strong sm">{c.razonSocial}</div></td>
                    {fila.map((v, i) => (
                      <td key={i} style={{ textAlign: "right" }}>
                        <div className="mono fact-celda">{v == null ? "—" : moneyK(v)}</div>
                        {verPct && <PctTag v={pct(v, anteriorDe(c.id, i + 1))} />}
                      </td>
                    ))}
                    <td style={{ textAlign: "right" }}><b className="mono">{moneyK(anual)}</b></td>
                  </tr>
                );
              })}
              <tr className="fact-total-row">
                <td><b>TOTAL</b></td>
                {totalesMes.map((t, i) => {
                  const ant = i === 0
                    ? companias.reduce((s, c) => s + (totalDe(c.id, anio - 1, 12) || 0), 0)
                    : totalesMes[i - 1];
                  return (
                    <td key={i} style={{ textAlign: "right" }}>
                      <div className="mono fact-celda"><b>{t ? moneyK(t) : "—"}</b></div>
                      {verPct && <PctTag v={t && ant ? ((t - ant) / ant) * 100 : null} />}
                    </td>
                  );
                })}
                <td style={{ textAlign: "right" }}><b className="mono">{moneyK(totalAnual)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================ COMPAÑÍAS (datos fijos) ============================
function CompaniaForm({ initial, onClose, onSubmit }) {
  const blank = { razonSocial: "", cuit: "", tipo: "A", envio: "", banco: "", notas: "", activa: true, orden: 99 };
  const [f, setF] = React.useState(initial ? { ...blank, ...initial } : blank);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.razonSocial.trim() && f.cuit.trim();
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h2>{initial ? "Editar compañía" : "Nueva compañía"}</h2><p>Datos que se repiten todos los meses</p></div>
          <button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field field-full"><span className="field-label">Razón social <i>*</i></span>
              <input className="input" value={f.razonSocial} onChange={(e) => set("razonSocial", e.target.value.toUpperCase())} autoFocus /></label>
            <label className="field"><span className="field-label">CUIT <i>*</i></span>
              <input className="input mono" value={f.cuit} onChange={(e) => set("cuit", e.target.value.replace(/\D/g, ""))} placeholder="Sin guiones" /></label>
            <label className="field"><span className="field-label">Tipo de factura</span>
              <select className="input" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select></label>
            <label className="field field-full"><span className="field-label">Envío</span>
              <input className="input" value={f.envio} onChange={(e) => set("envio", e.target.value)} placeholder="Mail de facturación o WEB" /></label>
            <label className="field"><span className="field-label">Banco</span>
              <input className="input" value={f.banco} onChange={(e) => set("banco", e.target.value.toUpperCase())} placeholder="RIO / BBVA" /></label>
            <label className="field"><span className="field-label">Orden en el listado</span>
              <input className="input" type="number" value={f.orden} onChange={(e) => set("orden", e.target.value)} /></label>
            <label className="field field-full"><span className="field-label">Notas</span>
              <textarea className="input" rows={2} value={f.notas} onChange={(e) => set("notas", e.target.value)} placeholder="Cómo facturarle, aclaraciones…" /></label>
            <label className="field field-full" style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <input type="checkbox" checked={f.activa} onChange={(e) => set("activa", e.target.checked)} style={{ width: 17, height: 17, accentColor: "var(--brand)" }} />
              <span className="field-label" style={{ margin: 0 }}>Activa (aparece en la carga mensual)</span></label>
          </div>
        </div>
        <div className="modal-foot">
          <span className="foot-note"><Ico name="info" size={14} /> Estos datos se cargan una sola vez</span>
          <div className="foot-btns">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!valid} onClick={() => onSubmit(f)}><Ico name="check" size={16} />Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompaniasView({ companias, movs, onNueva, onEditar, onEliminar }) {
  const cuenta = (cid) => movs.filter((m) => m.companiaId === cid).length;
  return (
    <div className="panel">
      <div className="toolbar">
        <div className="toolbar-left"><span className="toolbar-title">Compañías</span><span className="toolbar-count">{companias.length}</span></div>
        <div className="toolbar-right"><button className="btn-primary" onClick={onNueva}><Ico name="plus" size={16} />Nueva compañía</button></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Razón social</th><th>CUIT</th><th>Tipo</th><th>Envío</th><th>Banco</th><th>Meses</th><th>Estado</th><th style={{ width: 90 }}></th></tr></thead>
          <tbody>
            {companias.map((c) => (
              <tr key={c.id}>
                <td><div className="cell-strong">{c.razonSocial}</div>{c.notas && <div className="cell-sub">{c.notas}</div>}</td>
                <td className="mono">{c.cuit}</td>
                <td><span className="fact-tag">{c.tipo || "—"}</span></td>
                <td className="cell-sub" style={{ maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis" }}>{c.envio || "—"}</td>
                <td className="cell-sub">{c.banco || "—"}</td>
                <td className="cell-sub">{cuenta(c.id)}</td>
                <td>{c.activa
                  ? <span className="badge" style={{ background: "#E6F4EA", color: "#15803D" }}><span className="badge-dot" style={{ background: "#15803D" }} />Activa</span>
                  : <span className="badge" style={{ background: "#EEF1F4", color: "#475569" }}><span className="badge-dot" style={{ background: "#64748B" }} />Inactiva</span>}</td>
                <td>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button className="row-open" title="Editar" onClick={() => onEditar(c)}><Ico name="edit" size={15} /></button>
                    <button className="row-open danger" title="Eliminar" onClick={() => onEliminar(c)}><Ico name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================ ORQUESTADOR ============================
function FacturacionModule({ active, station, query }) {
  const hoy = new Date();
  const [companias, setCompanias] = React.useState([]);
  const [movs, setMovs] = React.useState([]);
  const [anio, setAnio] = React.useState(hoy.getFullYear());
  const [mes, setMes] = React.useState(hoy.getMonth() + 1);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const tt = React.useRef(null);
  const flash = (msg, err) => {
    setToast({ msg, err: !!err, id: Date.now() });
    clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), err ? 4000 : 2400);
  };

  const load = React.useCallback(async () => {
    if (!window.DB || !window.DB.configured() || !window.DB.fact) { setLoading(false); return; }
    try {
      const [cs, ms] = await Promise.all([window.DB.fact.companias.list(), window.DB.fact.mensual.list()]);
      setCompanias(cs); setMovs(ms);
    } catch (e) { console.error("Facturación:", e); flash("No se pudo cargar la facturación", true); }
    setLoading(false);
  }, []);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    if (!window.DB || !window.DB.configured() || !window.DB.fact) return;
    let t = null;
    const unsub = window.DB.fact.subscribe(() => { clearTimeout(t); t = setTimeout(load, 500); });
    return () => { clearTimeout(t); if (unsub) unsub(); };
  }, [load]);

  const guardarMes = async (item) => {
    try {
      const saved = await window.DB.fact.mensual.save(item);
      setMovs((p) => {
        const i = p.findIndex((x) => x.companiaId === saved.companiaId && x.anio === saved.anio && x.mes === saved.mes);
        if (i >= 0) { const q = [...p]; q[i] = saved; return q; }
        return [...p, saved];
      });
      flash("Guardado");
    } catch (e) { console.error(e); flash("No se pudo guardar", true); }
  };
  const guardarCompania = async (f) => {
    try {
      if (f.id) {
        const up = await window.DB.fact.companias.update(f);
        setCompanias((p) => p.map((x) => (x.id === up.id ? up : x)).sort((a, b) => a.orden - b.orden));
        flash("Compañía actualizada");
      } else {
        const nu = await window.DB.fact.companias.create(f);
        setCompanias((p) => [...p, nu].sort((a, b) => a.orden - b.orden));
        flash("Compañía agregada");
      }
      setModal(null);
    } catch (e) {
      console.error(e);
      flash(String(e.message || "").indexOf("duplicate") >= 0 ? "Ya existe una compañía con ese CUIT" : "No se pudo guardar la compañía", true);
    }
  };
  const eliminarCompania = async (c) => {
    const n = movs.filter((m) => m.companiaId === c.id).length;
    const msg = n
      ? `${c.razonSocial} tiene ${n} ${n === 1 ? "mes cargado" : "meses cargados"}. Si la eliminás se borra también esa facturación. ¿Seguir?`
      : `¿Eliminar ${c.razonSocial}?`;
    if (!window.confirm(msg)) return;
    try {
      await window.DB.fact.companias.remove(c);
      setCompanias((p) => p.filter((x) => x.id !== c.id));
      setMovs((p) => p.filter((m) => m.companiaId !== c.id));
      flash("Compañía eliminada");
    } catch (e) { console.error(e); flash("No se pudo eliminar", true); }
  };

  const q = (query || "").trim().toLowerCase();
  const visibles = React.useMemo(() => {
    let cs = companias;
    if (q) cs = cs.filter((c) => (c.razonSocial + " " + c.cuit).toLowerCase().includes(q));
    return cs;
  }, [companias, q]);
  const activas = visibles.filter((c) => c.activa);

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando facturación…</div></div>;

  return (
    <>
      {active === "fact-crecimiento"
        ? <CrecimientoAnual companias={visibles} movs={movs} anio={anio} onAnio={setAnio} />
        : active === "fact-companias"
        ? <CompaniasView companias={visibles} movs={movs}
            onNueva={() => setModal({ tipo: "cia" })}
            onEditar={(c) => setModal({ tipo: "cia", item: c })}
            onEliminar={eliminarCompania} />
        : <CargaMensual companias={activas} movs={movs} anio={anio} mes={mes}
            onAnio={setAnio} onMes={setMes} onGuardar={guardarMes} station={station} />}

      {modal?.tipo === "cia" && (
        <CompaniaForm initial={modal.item} onClose={() => setModal(null)} onSubmit={guardarCompania} />
      )}
      {toast && (
        <div className="toast">
          <span className="toast-ico" style={toast.err ? { background: "#DC2626" } : null}><Ico name={toast.err ? "alert" : "check"} size={15} /></span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

Object.assign(window, { FacturacionModule, CargaMensual, CrecimientoAnual, CompaniasView });
