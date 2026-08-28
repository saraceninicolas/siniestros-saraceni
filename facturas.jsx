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

// ============================ ESTADÍSTICAS (panel) ============================
// Tablero del mes: KPIs contra el mes anterior, resumen por compañía, evolución,
// estado de cobro y alertas. Todo sale de `fact_mensual`, no se carga nada acá.
const money2 = (v) => (v == null || v === "" ? "—" : "$" + Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct1 = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + (Math.round(v * 100) / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%");
// Mes anterior, cruzando el cambio de año
const mesAnterior = (anio, mes) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
// Color del monograma de la compañía (mientras no haya logos)
const FACT_TONOS = ["#1D4ED8", "#B45309", "#15803D", "#7C3AED", "#0891B2", "#C0241D", "#475569"];
const tonoCia = (nombre) => {
  let h = 0;
  for (let i = 0; i < (nombre || "").length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 997;
  return FACT_TONOS[h % FACT_TONOS.length];
};
function CiaMarca({ nombre }) {
  const tono = tonoCia(nombre);
  return <span className="fact-marca" style={{ background: tono + "1A", color: tono }}>{(nombre || "?").trim().charAt(0)}</span>;
}
function FactDelta({ v, sub }) {
  if (v == null) return <span className="fact-delta nulo">{sub || "sin comparación"}</span>;
  const cls = v > 0.5 ? "sube" : v < -0.5 ? "baja" : "igual";
  return (
    <span className={"fact-delta " + cls}>
      {sub && <span className="fact-delta-sub">{sub}</span>}
      <b>{v > 0 ? "↑" : v < 0 ? "↓" : "→"} {pct1(v)}</b>
    </span>
  );
}
function EstadoCobro({ facturado, cobrado }) {
  if (!facturado) return <span className="badge" style={{ background: "#EEF1F4", color: "#475569" }}>Sin cargar</span>;
  if (cobrado >= facturado) return <span className="badge" style={{ background: "#E6F4EA", color: "#15803D" }}>Cobrado</span>;
  if (cobrado > 0) return <span className="badge" style={{ background: "#FEF3E2", color: "#B45309" }}>Parcial</span>;
  return <span className="badge" style={{ background: "#FBE3E3", color: "#C0241D" }}>Pendiente</span>;
}

// Detalle anual de una compañía (se abre desde "Ver detalle")
function FactDetalleCia({ cia, movs, anio, onClose }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const filas = MESES_CORTO.map((m, i) => {
    const r = movs.find((x) => x.companiaId === cia.id && x.anio === anio && x.mes === i + 1);
    return { mes: m, facturado: r && r.total != null ? Number(r.total) : null, cobrado: r && r.pago != null ? Number(r.pago) : null, nro: r ? r.nroFactura : "" };
  });
  const totF = filas.reduce((s, f) => s + (f.facturado || 0), 0);
  const totC = filas.reduce((s, f) => s + (f.cobrado || 0), 0);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h2>{cia.razonSocial}</h2><p>Facturación {anio} · CUIT {cia.cuit}</p></div>
          <button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="fact-det-res">
            <div><span className="fact-res-k">Facturado {anio}</span><span className="fact-res-v">{money0(totF)}</span></div>
            <div><span className="fact-res-k">Cobrado</span><span className="fact-res-v">{money0(totC)}</span></div>
            <div><span className="fact-res-k">Pendiente</span><span className="fact-res-v" style={{ color: totF - totC > 0 ? "#C0241D" : "#15803D" }}>{money0(totF - totC)}</span></div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table fact-det-tabla">
              <thead><tr><th>Mes</th><th>N° factura</th><th style={{ textAlign: "right" }}>Facturado</th><th style={{ textAlign: "right" }}>Cobrado</th><th style={{ textAlign: "right" }}>Pendiente</th><th>Estado</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.mes}>
                    <td><b>{f.mes}</b></td>
                    <td className="mono cell-sub">{f.nro || "—"}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{f.facturado == null ? "—" : money0(f.facturado)}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{f.cobrado == null ? "—" : money0(f.cobrado)}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{f.facturado == null ? "—" : money0((f.facturado || 0) - (f.cobrado || 0))}</td>
                    <td><EstadoCobro facturado={f.facturado || 0} cobrado={f.cobrado || 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function FactEstadisticas({ companias, movs, anio, mes, onAnio, onMes, onNav }) {
  const hoy = new Date();
  const [verTodas, setVerTodas] = React.useState(false);
  const [rango, setRango] = React.useState(6);
  const [detalle, setDetalle] = React.useState(null);
  const anios = [];
  for (let a = hoy.getFullYear() + 1; a >= 2025; a--) anios.push(a);

  const idx = React.useMemo(() => {
    const m = {};
    movs.forEach((x) => { m[x.companiaId + "-" + x.anio + "-" + x.mes] = x; });
    return m;
  }, [movs]);
  const facDe = (cid, a, ms) => { const r = idx[cid + "-" + a + "-" + ms]; return r && r.total != null ? Number(r.total) : 0; };
  const cobDe = (cid, a, ms) => { const r = idx[cid + "-" + a + "-" + ms]; return r && r.pago != null ? Number(r.pago) : 0; };
  const cargada = (cid, a, ms) => { const r = idx[cid + "-" + a + "-" + ms]; return !!(r && r.total != null); };

  const prev = mesAnterior(anio, mes);
  const filas = React.useMemo(() => companias.map((c) => {
    const facturado = facDe(c.id, anio, mes);
    const cobrado = cobDe(c.id, anio, mes);
    const antes = facDe(c.id, prev.anio, prev.mes);
    return {
      cia: c, facturado, cobrado, pendiente: facturado - cobrado,
      pctCobro: facturado > 0 ? (cobrado / facturado) * 100 : null,
      crecimiento: antes > 0 ? ((facturado - antes) / antes) * 100 : null,
      antes, cargada: cargada(c.id, anio, mes),
    };
  }).sort((a, b) => b.facturado - a.facturado), [companias, idx, anio, mes]);

  const conMovimiento = filas.filter((f) => f.facturado > 0);
  const facturado = conMovimiento.reduce((s, f) => s + f.facturado, 0);
  const cobrado = conMovimiento.reduce((s, f) => s + f.cobrado, 0);
  const pendiente = facturado - cobrado;
  const facturadoPrev = filas.reduce((s, f) => s + f.antes, 0);
  const cobradoPrev = companias.reduce((s, c) => s + cobDe(c.id, prev.anio, prev.mes), 0);
  const pendientePrev = facturadoPrev - cobradoPrev;
  const varTotal = facturadoPrev > 0 ? ((facturado - facturadoPrev) / facturadoPrev) * 100 : null;
  const varCobrado = cobradoPrev > 0 ? ((cobrado - cobradoPrev) / cobradoPrev) * 100 : null;
  const varPendiente = pendientePrev > 0 ? ((pendiente - pendientePrev) / pendientePrev) * 100 : null;
  const conSaldo = conMovimiento.filter((f) => f.pendiente > 0);
  const sinCargar = companias.filter((c) => c.activa && !cargada(c.id, anio, mes));
  const mesPrevLabel = MESES_F[prev.mes - 1] + " " + prev.anio;

  // evolución de los últimos N meses terminando en el período elegido
  const evolucion = React.useMemo(() => {
    const cols = [];
    for (let i = rango - 1; i >= 0; i--) {
      const d = new Date(anio, mes - 1 - i, 1);
      const a = d.getFullYear(), ms = d.getMonth() + 1;
      cols.push({
        label: MESES_CORTO[ms - 1] + " " + String(a).slice(2),
        valores: [
          companias.reduce((s, c) => s + facDe(c.id, a, ms), 0),
          companias.reduce((s, c) => s + cobDe(c.id, a, ms), 0),
        ],
      });
    }
    return cols;
  }, [companias, idx, anio, mes, rango]);

  // estado de cobro por importe facturado
  const dona = [
    { label: "Cobrado", color: CH_COLOR.verde, valor: conMovimiento.filter((f) => f.cobrado >= f.facturado).reduce((s, f) => s + f.facturado, 0) },
    { label: "Parcial", color: CH_COLOR.ambar, valor: conMovimiento.filter((f) => f.cobrado > 0 && f.cobrado < f.facturado).reduce((s, f) => s + f.facturado, 0) },
    { label: "Pendiente", color: CH_COLOR.rojo, valor: conMovimiento.filter((f) => f.cobrado <= 0).reduce((s, f) => s + f.facturado, 0) },
  ];
  const donaTotal = dona.reduce((s, d) => s + d.valor, 0);

  // alertas
  const alertas = [];
  conMovimiento.filter((f) => f.cobrado <= 0).forEach((f) => alertas.push({
    tono: "alta", titulo: f.cia.razonSocial, txt: "No registra pagos en el período. Pendiente " + money0(f.pendiente),
  }));
  conMovimiento.filter((f) => f.crecimiento != null && f.crecimiento <= -15).forEach((f) => alertas.push({
    tono: "media", titulo: f.cia.razonSocial, txt: `Caída del ${Math.abs(Math.round(f.crecimiento))}% en facturación respecto a ${mesPrevLabel}.`,
  }));
  if (sinCargar.length) alertas.push({
    tono: "media", titulo: `${sinCargar.length} ${sinCargar.length === 1 ? "compañía activa sin cargar" : "compañías activas sin cargar"}`,
    txt: sinCargar.map((c) => c.razonSocial).join(", "), accion: { label: "Ir a la carga", key: "fact-carga" },
  });
  if (conSaldo.length) alertas.push({
    tono: "baja", titulo: `${conSaldo.length} ${conSaldo.length === 1 ? "compañía con saldo pendiente" : "compañías con saldos pendientes"}`,
    txt: "Total a cobrar del período: " + money0(pendiente),
  });

  const ranking = filas.filter((f) => f.crecimiento != null || f.facturado > 0)
    .sort((a, b) => (b.crecimiento == null ? -Infinity : b.crecimiento) - (a.crecimiento == null ? -Infinity : a.crecimiento));

  const kpis = [
    { label: "Facturado total", value: money2(facturado), delta: varTotal, tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "doc" },
    { label: "Cobrado total", value: money2(cobrado), delta: varCobrado, tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "card" },
    { label: "Pendiente de cobro", value: money2(pendiente), delta: varPendiente, invertir: true, tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "clock" },
    { label: "Compañías con saldo", value: conSaldo.length + " de " + conMovimiento.length, hint: "facturaron y deben algo", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "folder" },
  ];
  const visiblesTabla = verTodas ? filas : filas.slice(0, 6);

  return (
    <div className="fact-dash">
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
          <div><span className="fact-res-k">Mostrando</span><span className="fact-res-v" style={{ fontFamily: "inherit", fontSize: 15 }}>{MESES_F[mes - 1]} {anio}</span></div>
        </div>
      </div>

      <div className="kpis fact-kpis">
        {kpis.map((c) => (
          <div className="kpi" key={c.label}>
            <span className="kpi-stripe" style={{ background: c.tone.fg }} />
            <div className="kpi-top"><span className="kpi-ico" style={{ background: c.tone.bg, color: c.tone.fg }}><Ico name={c.icon} size={17} /></span><span className="kpi-label">{c.label}</span></div>
            <div className="kpi-mid"><span className="kpi-value fact-kpi-v">{c.value}</span></div>
            <div className="kpi-foot">
              {c.hint ? <span className="kpi-hint">{c.hint}</span>
                : <><span className="kpi-hint">vs {mesPrevLabel}</span>
                  <FactDelta v={c.invertir && c.delta != null ? -c.delta : c.delta} /></>}
            </div>
          </div>
        ))}
      </div>

      <div className="fact-dash-grid">
        <div className="fact-dash-main">
          <section className="est-card">
            <div className="est-card-head">
              <div><h3>Resumen por compañía</h3><p>{MESES_F[mes - 1]} {anio}</p></div>
            </div>
            <div className="table-wrap">
              <table className="table fact-resumen">
                <thead>
                  <tr>
                    <th style={{ minWidth: 180 }}>Compañía</th>
                    <th style={{ textAlign: "right" }}>Facturado</th>
                    <th style={{ textAlign: "right" }}>Cobrado</th>
                    <th style={{ minWidth: 120 }}>% Cobro</th>
                    <th style={{ textAlign: "right" }}>Pendiente</th>
                    <th>Estado</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {visiblesTabla.map((f) => (
                    <tr key={f.cia.id}>
                      <td>
                        <div className="fact-cia-cell">
                          <CiaMarca nombre={f.cia.razonSocial} />
                          <div><div className="cell-strong sm">{f.cia.razonSocial}</div><div className="cell-sub mono">{f.cia.cuit}</div></div>
                        </div>
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>{f.facturado ? money0(f.facturado) : "—"}</td>
                      <td className="mono" style={{ textAlign: "right", color: f.cobrado > 0 ? "#15803D" : "var(--muted)" }}>{f.cobrado ? money0(f.cobrado) : "$ 0"}</td>
                      <td>
                        <div className="fact-cobro">
                          <span className="fact-cobro-track">
                            <span style={{
                              width: Math.min(100, Math.max(0, f.pctCobro || 0)) + "%",
                              background: (f.pctCobro || 0) >= 100 ? "#16A34A" : (f.pctCobro || 0) >= 50 ? "#F59E0B" : "#EA580C",
                            }} />
                          </span>
                          <b className="mono">{f.pctCobro == null ? "—" : Math.round(f.pctCobro) + "%"}</b>
                        </div>
                      </td>
                      <td className="mono" style={{ textAlign: "right", color: f.pendiente > 0 ? "#C0241D" : "var(--ink-2)" }}>{f.facturado ? money0(f.pendiente) : "—"}</td>
                      <td><EstadoCobro facturado={f.facturado} cobrado={f.cobrado} /></td>
                      <td>
                        <button className="row-open" title="Ver el año de esta compañía" onClick={() => setDetalle(f.cia)}><Ico name="chevR" size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filas.length > 6 && (
              <div className="fact-vertodas">
                <button className="btn-ghost sm" onClick={() => setVerTodas((v) => !v)}>
                  {verTodas ? "Ver solo las principales" : `Ver todas las compañías (${filas.length})`}
                </button>
              </div>
            )}
          </section>

          <div className="fact-dash-duo">
            <section className="est-card">
              <div className="est-card-head"><div><h3>Alertas</h3><p>lo que conviene mirar de este mes</p></div></div>
              {alertas.length ? (
                <div className="fact-alertas">
                  {alertas.slice(0, 6).map((a, i) => (
                    <div className={"fact-alerta " + a.tono} key={i}>
                      <span className="fact-alerta-ico"><Ico name={a.tono === "alta" ? "alert" : a.tono === "media" ? "info" : "clock"} size={15} /></span>
                      <div className="fact-alerta-txt">
                        <b>{a.titulo}</b>
                        <span>{a.txt}</span>
                      </div>
                      {a.accion && onNav && <button className="fact-alerta-link" onClick={() => onNav(a.accion.key)}>{a.accion.label}</button>}
                    </div>
                  ))}
                </div>
              ) : <div className="ch-vacio">Sin alertas: el mes está cargado y cobrado.</div>}
            </section>

            <section className="est-card">
              <div className="est-card-head"><div><h3>Ranking de crecimiento</h3><p>vs {mesPrevLabel}</p></div></div>
              {ranking.length ? (
                <ol className="fact-rank">
                  {ranking.slice(0, 8).map((f, i) => (
                    <li key={f.cia.id}>
                      <span className="fact-rank-n">{i + 1}</span>
                      <CiaMarca nombre={f.cia.razonSocial} />
                      <span className="fact-rank-name" title={f.cia.razonSocial}>{f.cia.razonSocial}</span>
                      <FactDelta v={f.crecimiento} />
                    </li>
                  ))}
                </ol>
              ) : <div className="ch-vacio">Sin datos para comparar</div>}
            </section>
          </div>
        </div>

        <div className="fact-dash-side">
          <section className="est-card">
            <div className="est-card-head">
              <div><h3>Evolución de facturación</h3><ChLeyenda series={[{ nombre: "Facturado", color: CH_COLOR.azul }, { nombre: "Cobrado", color: CH_COLOR.verde }]} /></div>
              <select className="select sm" value={rango} onChange={(e) => setRango(Number(e.target.value))}>
                <option value={6}>Últimos 6 meses</option>
                <option value={12}>Últimos 12 meses</option>
              </select>
            </div>
            <ChBarras data={evolucion}
              series={[{ nombre: "Facturado", color: CH_COLOR.azul }, { nombre: "Cobrado", color: CH_COLOR.verde }]}
              fmtEje={moneyK} fmtValor={money0} alto={240} />
          </section>

          <section className="est-card">
            <div className="est-card-head"><div><h3>Estado de cobro</h3><p>por importe facturado</p></div></div>
            {donaTotal > 0 ? (
              <div className="fact-dona-wrap">
                <ChDona items={dona} centro={{ valor: Math.round((cobrado / (facturado || 1)) * 100) + "%", label: "cobrado" }} />
                <div className="fact-dona-leg">
                  {dona.map((d) => (
                    <div className="fact-dona-item" key={d.label}>
                      <span className="ch-leyenda-dot" style={{ background: d.color }} />
                      <div>
                        <b>{d.label}</b>
                        <span className="mono">{money0(d.valor)} ({(Math.round((d.valor / donaTotal) * 1000) / 10).toLocaleString("es-AR")}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="ch-vacio">Todavía no hay facturación cargada en {MESES_F[mes - 1]}.</div>}
          </section>

          {onNav && (
            <section className="est-card">
              <div className="est-card-head"><div><h3>Acciones rápidas</h3></div></div>
              <div className="fact-acciones">
                {[
                  { k: "fact-carga", ico: "edit", t: "Cargar el mes", s: "Completar la grilla de " + MESES_F[mes - 1] },
                  { k: "fact-crecimiento", ico: "target", t: "Crecimiento anual", s: "Matriz de compañías por mes" },
                  { k: "fact-companias", ico: "folder", t: "Compañías", s: "Datos fijos y alta de compañías" },
                ].map((a) => (
                  <button className="fact-accion" key={a.k} onClick={() => onNav(a.k)}>
                    <span className="fact-accion-ico"><Ico name={a.ico} size={17} /></span>
                    <span className="fact-accion-txt"><b>{a.t}</b><span>{a.s}</span></span>
                    <Ico name="chevR" size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {detalle && <FactDetalleCia cia={detalle} movs={movs} anio={anio} onClose={() => setDetalle(null)} />}
    </div>
  );
}

// ============================ ORQUESTADOR ============================
function FacturacionModule({ active, station, query, onNav }) {
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
      {active === "fact-estadisticas"
        ? <FactEstadisticas companias={visibles} movs={movs} anio={anio} mes={mes}
            onAnio={setAnio} onMes={setMes} onNav={onNav} />
        : active === "fact-crecimiento"
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

Object.assign(window, { FacturacionModule, CargaMensual, CrecimientoAnual, CompaniasView, FactEstadisticas });
