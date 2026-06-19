// facturas.jsx — Saraceni Seguros · Módulo de Facturación

// ---------- helpers ----------
const ARS0 = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const ARS2 = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n) => (n == null || n === "") ? "—" : ARS0.format(Number(n));
const money2 = (n) => (n == null || n === "") ? "—" : ARS2.format(Number(n));
const pad4 = (n) => String(n).padStart(4, "0");
const MES_NOMBRE = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MES_CORTO = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const TIPOS_FACT = ["A", "B"];
const BANCOS = ["RIO", "BBVA"];
const ESTADOS_PAGO = ["OK", "parcial"];
function fmtFechaF(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function pagoBadge(estado) {
  const map = {
    "OK": { fg: "#15803D", bg: "#E6F4EA", t: "Pagado" },
    "parcial": { fg: "#B45309", bg: "#FEF3E2", t: "Parcial" },
  };
  const c = map[estado];
  if (!c) return <span style={{ color: "var(--muted)" }}>—</span>;
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 11.5 }}><span className="badge-dot" style={{ background: c.fg }} />{c.t}</span>;
}
function tipoPill(t) {
  return <span className="cia-pill sm mono" style={{ fontWeight: 700 }}>{t || "—"}</span>;
}

// ---------- KPIs ----------
function FactKpis({ data }) {
  const total = data.reduce((s, f) => s + (Number(f.total) || 0), 0);
  const cobrado = data.reduce((s, f) => s + (Number(f.montoPagado) || 0), 0);
  const pctCob = total ? Math.round((cobrado / total) * 1000) / 10 : 0;
  const cards = [
    { label: "Facturas", value: data.length, hint: "comprobantes", tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "doc" },
    { label: "Total facturado", value: money0(total), hint: "neto + IVA", tone: { bg: "#EDEBFE", fg: "#6D28D9" }, icon: "grid", small: true },
    { label: "Cobrado (registrado)", value: money0(cobrado), hint: "pagos cargados", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "check", small: true },
    { label: "% cobrado", value: pctCob + "%", hint: "sobre lo facturado", tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "card" },
  ];
  return (
    <div className="kpis">
      {cards.map((c) => (
        <div className="kpi" key={c.label}>
          <span className="kpi-stripe" style={{ background: c.tone.fg }} />
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: c.tone.bg, color: c.tone.fg }}><Ico name={c.icon} size={17} /></span>
            <span className="kpi-label">{c.label}</span>
          </div>
          <div className="kpi-mid"><span className="kpi-value" style={c.small ? { fontSize: 21 } : null}>{c.value}</span></div>
          <div className="kpi-foot"><span className="kpi-hint">{c.hint}</span></div>
        </div>
      ))}
    </div>
  );
}

// ---------- toolbar ----------
function FactToolbar({ count, companias, anioF, onAnio, mesF, onMes, ciaF, onCia, tipoF, onTipo, anios, selected, onNew, onEdit, onDelete }) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">Comprobantes</span>
        <span className="toolbar-count">{count}</span>
      </div>
      <div className="toolbar-right">
        <select className="select" value={anioF} onChange={(e) => onAnio(e.target.value)}>
          <option value="Todos">Todos los años</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="select" value={mesF} onChange={(e) => onMes(e.target.value)}>
          <option value="Todos">Todos los meses</option>
          {MES_NOMBRE.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select className="select" value={ciaF} onChange={(e) => onCia(e.target.value)}>
          <option value="Todos">Todas las compañías</option>
          {companias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" value={tipoF} onChange={(e) => onTipo(e.target.value)}>
          <option value="Todos">Tipo A y B</option>
          {TIPOS_FACT.map((t) => <option key={t} value={t}>Tipo {t}</option>)}
        </select>
        <div className="toolbar-divider" />
        <button className="btn-ghost" disabled={!selected} onClick={onEdit}><Ico name="edit" size={15} />Editar</button>
        <button className="btn-ghost danger" disabled={!selected} onClick={onDelete}><Ico name="trash" size={15} />Eliminar</button>
        <button className="btn-primary" onClick={onNew}><Ico name="plus" size={17} />Registrar factura</button>
      </div>
    </div>
  );
}

// ---------- tabla ----------
function FacturasTable({ rows, selectedId, onSelect, onOpen }) {
  if (!rows.length) {
    return (
      <div className="empty">
        <div className="empty-ico"><Ico name="search" size={26} /></div>
        <div className="empty-title">Sin resultados</div>
        <div className="empty-sub">No hay facturas que coincidan con la búsqueda o filtros.</div>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 34 }}></th>
            <th>N° Factura</th>
            <th>Fecha</th>
            <th>Compañía</th>
            <th>Tipo</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th style={{ textAlign: "right" }}>Pagado</th>
            <th>Estado</th>
            <th>Banco</th>
            <th style={{ width: 44 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={selectedId === r.id ? "is-selected" : ""} onClick={() => onOpen(r.id)}>
              <td onClick={(e) => { e.stopPropagation(); onSelect(selectedId === r.id ? null : r.id); }}>
                <span className={"radio" + (selectedId === r.id ? " on" : "")} />
              </td>
              <td>
                <div className="mono cell-id">{r.nroFactura || "—"}</div>
                <div className="cell-sub">{MES_CORTO[r.mes]} {r.anio} · {r.id}</div>
              </td>
              <td className="mono dim">{fmtFechaF(r.fechaEmision)}</td>
              <td><div className="cell-strong">{r.razonSocial}</div></td>
              <td>{tipoPill(r.tipo)}</td>
              <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{money0(r.total)}</td>
              <td className="mono dim" style={{ textAlign: "right" }}>{money0(r.montoPagado)}</td>
              <td>{pagoBadge(r.estadoPago)}</td>
              <td><span className="cia-pill sm">{r.banco || "—"}</span></td>
              <td onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>
                <button className="row-open" title="Ver detalle"><Ico name="chevR" size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- modal genérico ----------
function FModal({ title, sub, onClose, children, footer, wide }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
function FField({ label, children, required, full }) {
  return (
    <label className={"field" + (full ? " field-full" : "")}>
      <span className="field-label">{label}{required && <i> *</i>}</span>
      {children}
    </label>
  );
}

// ---------- alta / edición ----------
function FacturaFormModal({ mode, initial, station, onClose, onSubmit }) {
  const now = new Date();
  const blank = {
    fechaEmision: "", nroFactura: "", tipo: "A", cuit: "", razonSocial: "",
    neto: "", iva: "", total: "", mailEnvio: "", estadoEnvio: "", montoPagado: "", estadoPago: "",
    banco: "RIO", observaciones: "", mes: now.getMonth() + 1, anio: now.getFullYear(),
  };
  const [f, setF] = React.useState(initial ? { ...blank, ...initial } : blank);
  const [touched, setTouched] = React.useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = String(f.razonSocial).trim() && f.anio && f.mes;
  const submit = () => { setTouched(true); if (!valid) return; onSubmit({ ...f }); };
  const autoTotal = () => {
    const n = Number(String(f.neto).replace(",", ".")) || 0;
    const i = Number(String(f.iva).replace(",", ".")) || 0;
    set("total", (n + i).toFixed(2));
  };
  return (
    <FModal wide
      title={mode === "edit" ? "Editar factura" : "Registrar factura"}
      sub={mode === "edit" ? `${initial.id} · ${initial.razonSocial}` : "Cargá los datos del comprobante"}
      onClose={onClose}
      footer={
        <>
          <span className="foot-note"><Ico name="monitor" size={14} /> Se registrará como <b>{station}</b></span>
          <div className="foot-btns">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={!valid}><Ico name="check" size={16} />{mode === "edit" ? "Guardar cambios" : "Registrar"}</button>
          </div>
        </>
      }>
      <div className="form-section">Comprobante</div>
      <div className="form-grid">
        <FField label="Compañía / Razón social" required full>
          <input className={"input" + (touched && !String(f.razonSocial).trim() ? " err" : "")} value={f.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} placeholder="Nombre de la aseguradora" />
        </FField>
        <FField label="N° de factura"><input className="input mono" value={f.nroFactura} onChange={(e) => set("nroFactura", e.target.value)} placeholder="000" /></FField>
        <FField label="Tipo">
          <select className="input" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS_FACT.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </FField>
        <FField label="CUIT"><input className="input mono" value={f.cuit} onChange={(e) => set("cuit", e.target.value)} placeholder="30xxxxxxxxx" /></FField>
        <FField label="Fecha de emisión"><input className="input" type="date" value={f.fechaEmision} onChange={(e) => set("fechaEmision", e.target.value)} /></FField>
        <FField label="Período (mes)">
          <select className="input" value={f.mes} onChange={(e) => set("mes", Number(e.target.value))}>{MES_NOMBRE.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select>
        </FField>
        <FField label="Período (año)">
          <input className="input mono" type="number" value={f.anio} onChange={(e) => set("anio", Number(e.target.value))} />
        </FField>
      </div>

      <div className="form-section">Importes</div>
      <div className="form-grid">
        <FField label="Neto gravado"><input className="input mono" inputMode="decimal" value={f.neto} onChange={(e) => set("neto", e.target.value)} onBlur={autoTotal} placeholder="0.00" /></FField>
        <FField label="IVA 21%"><input className="input mono" inputMode="decimal" value={f.iva} onChange={(e) => set("iva", e.target.value)} onBlur={autoTotal} placeholder="0.00" /></FField>
        <FField label="Total"><input className="input mono" inputMode="decimal" value={f.total} onChange={(e) => set("total", e.target.value)} placeholder="0.00" /></FField>
        <FField label="Banco">
          <input className="input" list="bancos-list" value={f.banco} onChange={(e) => set("banco", e.target.value)} />
          <datalist id="bancos-list">{BANCOS.map((b) => <option key={b} value={b} />)}</datalist>
        </FField>
      </div>

      <div className="form-section">Cobranza y envío</div>
      <div className="form-grid">
        <FField label="Monto pagado"><input className="input mono" inputMode="decimal" value={f.montoPagado} onChange={(e) => set("montoPagado", e.target.value)} placeholder="0.00" /></FField>
        <FField label="Estado de pago">
          <select className="input" value={f.estadoPago} onChange={(e) => set("estadoPago", e.target.value)}>
            <option value="">Sin registrar</option>
            <option value="OK">Pagado</option>
            <option value="parcial">Parcial</option>
          </select>
        </FField>
        <FField label="Enviar a (mail o WEB)"><input className="input" value={f.mailEnvio} onChange={(e) => set("mailEnvio", e.target.value)} placeholder="mail@compañia.com o WEB" /></FField>
        <FField label="Estado de envío"><input className="input" value={f.estadoEnvio} onChange={(e) => set("estadoEnvio", e.target.value)} placeholder="OK" /></FField>
        <FField label="Observaciones" full>
          <textarea className="input" rows={2} value={f.observaciones} onChange={(e) => set("observaciones", e.target.value)} placeholder="Notas internas…" />
        </FField>
      </div>
    </FModal>
  );
}

// ---------- ficha (detalle) ----------
function FacturaDetailModal({ item, onClose, onEdit, onDelete }) {
  const Row = ({ k, v, mono }) => (<div className="dt-row"><span className="dt-k">{k}</span><span className={"dt-v" + (mono ? " mono" : "")}>{v}</span></div>);
  const pct = item.total ? Math.round(((Number(item.montoPagado) || 0) / Number(item.total)) * 1000) / 10 : 0;
  return (
    <FModal wide title={item.razonSocial} sub={<span className="mono">{item.nroFactura ? "Factura " + item.tipo + " N° " + item.nroFactura : item.id} · {MES_NOMBRE[item.mes]} {item.anio}</span>} onClose={onClose}
      footer={
        <>
          <button className="btn-ghost danger" onClick={() => onDelete(item)}><Ico name="trash" size={15} />Eliminar</button>
          <div className="foot-btns">
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
            <button className="btn-primary" onClick={() => onEdit(item)}><Ico name="edit" size={15} />Editar</button>
          </div>
        </>
      }>
      <div className="dt-head">
        {tipoPill("Tipo " + item.tipo)}
        {pagoBadge(item.estadoPago)}
        <span className="cia-pill">{item.banco || "—"}</span>
        {item.estadoEnvio && <span className="dt-cal"><Ico name="mail" size={13} />Envío: {item.estadoEnvio}</span>}
      </div>
      <div className="dt-cols">
        <div className="dt-block">
          <span className="dt-block-title">Comprobante</span>
          <Row k="Compañía" v={item.razonSocial} />
          <Row k="CUIT" v={item.cuit || "—"} mono />
          <Row k="N° factura" v={item.nroFactura || "—"} mono />
          <Row k="Tipo" v={item.tipo || "—"} />
          <Row k="Emisión" v={fmtFechaF(item.fechaEmision)} mono />
          <Row k="Período" v={`${MES_NOMBRE[item.mes]} ${item.anio}`} />
        </div>
        <div className="dt-block">
          <span className="dt-block-title">Importes</span>
          <Row k="Neto gravado" v={money2(item.neto)} mono />
          <Row k="IVA 21%" v={money2(item.iva)} mono />
          <Row k="Total" v={money2(item.total)} mono />
          <Row k="Pagado" v={money2(item.montoPagado)} mono />
          <Row k="% cobrado" v={pct + "%"} mono />
        </div>
      </div>
      <div className="dt-block">
        <span className="dt-block-title">Envío y notas</span>
        <Row k="Enviar a" v={item.mailEnvio || "—"} />
        {item.observaciones && <p className="dt-obs" style={{ marginTop: 8 }}>{item.observaciones}</p>}
      </div>
      <div className="dt-stamp">Última modificación {item.ultimaModFecha ? new Date(item.ultimaModFecha).toLocaleString("es-AR") : "—"} · <span className="mono">{item.ultimaModPor || "—"}</span></div>
    </FModal>
  );
}

// ---------- confirmar baja ----------
function FactConfirmDelete({ item, station, onClose, onConfirm }) {
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm">
          <div className="confirm-ico"><Ico name="trash" size={22} /></div>
          <h2>Eliminar factura</h2>
          <p>Vas a dar de baja la factura <span className="mono">{item.nroFactura || item.id}</span> de <b>{item.razonSocial}</b>. Dejará de verse en el listado.</p>
          <div className="confirm-note"><Ico name="monitor" size={14} /> Acción registrada como <b>{station}</b></div>
          <div className="confirm-btns">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-danger" onClick={() => onConfirm(item)}><Ico name="trash" size={15} />Sí, eliminar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- reportes / crecimiento ----------
function ReportesFacturacion({ data }) {
  const anios = Array.from(new Set(data.map((f) => f.anio))).sort();
  // acumular por año/mes
  const acc = {};
  anios.forEach((a) => { acc[a] = {}; for (let m = 1; m <= 12; m++) acc[a][m] = { total: 0, pagado: 0, count: 0 }; });
  data.forEach((f) => { if (acc[f.anio] && acc[f.anio][f.mes]) { const c = acc[f.anio][f.mes]; c.total += Number(f.total) || 0; c.pagado += Number(f.montoPagado) || 0; c.count++; } });

  // por compañía
  const porCia = {};
  data.forEach((f) => { const k = f.razonSocial; if (!porCia[k]) porCia[k] = { total: 0, pagado: 0, count: 0 }; porCia[k].total += Number(f.total) || 0; porCia[k].pagado += Number(f.montoPagado) || 0; porCia[k].count++; });
  const ciasOrden = Object.entries(porCia).sort((a, b) => b[1].total - a[1].total);
  const maxCia = ciasOrden.length ? ciasOrden[0][1].total : 1;

  const delta = (cur, prev) => {
    if (!prev) return null;
    return Math.round(((cur - prev) / prev) * 1000) / 10;
  };
  const DeltaTag = ({ v }) => {
    if (v == null) return <span style={{ color: "var(--muted)" }}>—</span>;
    const up = v >= 0;
    return <span style={{ color: up ? "#15803D" : "#C0241D", fontWeight: 700, fontSize: 12 }}>{up ? "▲" : "▼"} {Math.abs(v)}%</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <FactKpis data={data} />

      {anios.map((a) => {
        const meses = []; let prev = null;
        for (let m = 1; m <= 12; m++) { const c = acc[a][m]; if (c.count === 0 && c.total === 0) continue; meses.push({ m, c, d: delta(c.total, prev) }); prev = c.total; }
        const totAnio = meses.reduce((s, x) => s + x.c.total, 0);
        const pagAnio = meses.reduce((s, x) => s + x.c.pagado, 0);
        return (
          <div className="panel" key={a}>
            <div className="toolbar"><div className="toolbar-left"><span className="toolbar-title">Facturación {a}</span><span className="toolbar-count">{meses.reduce((s, x) => s + x.c.count, 0)}</span></div>
              <div className="toolbar-right"><span className="kpi-hint">Total {money0(totAnio)} · Cobrado {money0(pagAnio)}</span></div></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Mes</th><th style={{ textAlign: "right" }}>Facturado</th><th style={{ textAlign: "right" }}>Cobrado</th><th>% cob.</th><th>Δ mensual</th></tr></thead>
                <tbody>
                  {meses.map((x) => (
                    <tr key={x.m} style={{ cursor: "default" }}>
                      <td className="cell-strong">{MES_NOMBRE[x.m]}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{money0(x.c.total)}</td>
                      <td className="mono dim" style={{ textAlign: "right" }}>{money0(x.c.pagado)}</td>
                      <td className="mono">{x.c.total ? Math.round((x.c.pagado / x.c.total) * 100) + "%" : "—"}</td>
                      <td><DeltaTag v={x.d} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {anios.length >= 2 && (
        <div className="panel">
          <div className="toolbar"><div className="toolbar-left"><span className="toolbar-title">Comparativo interanual</span></div>
            <div className="toolbar-right"><span className="kpi-hint">{anios[anios.length - 2]} vs {anios[anios.length - 1]}</span></div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Mes</th><th style={{ textAlign: "right" }}>{anios[anios.length - 2]}</th><th style={{ textAlign: "right" }}>{anios[anios.length - 1]}</th><th>Δ interanual</th></tr></thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const a0 = acc[anios[anios.length - 2]][m], a1 = acc[anios[anios.length - 1]][m];
                  if ((a0.count + a1.count) === 0) return null;
                  return (
                    <tr key={m} style={{ cursor: "default" }}>
                      <td className="cell-strong">{MES_NOMBRE[m]}</td>
                      <td className="mono dim" style={{ textAlign: "right" }}>{a0.total ? money0(a0.total) : "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{a1.total ? money0(a1.total) : "—"}</td>
                      <td><DeltaTag v={a0.total ? delta(a1.total, a0.total) : null} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="toolbar"><div className="toolbar-left"><span className="toolbar-title">Por compañía</span><span className="toolbar-count">{ciasOrden.length}</span></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Compañía</th><th>Participación</th><th style={{ textAlign: "right" }}>Facturado</th><th style={{ textAlign: "right" }}>Cobrado</th><th>% cob.</th></tr></thead>
            <tbody>
              {ciasOrden.map(([cia, v]) => (
                <tr key={cia} style={{ cursor: "default" }}>
                  <td className="cell-strong" style={{ maxWidth: 240 }}>{cia}</td>
                  <td style={{ minWidth: 120 }}><div className="kpi-bar"><span style={{ width: Math.max(3, (v.total / maxCia) * 100) + "%", background: "var(--brand)" }} /></div></td>
                  <td className="mono" style={{ textAlign: "right" }}>{money0(v.total)}</td>
                  <td className="mono dim" style={{ textAlign: "right" }}>{money0(v.pagado)}</td>
                  <td className="mono">{v.total ? Math.round((v.pagado / v.total) * 100) + "%" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- módulo orquestador ----------
function FacturacionModule({ active, station, query }) {
  const [facturas, setFacturas] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [anioF, setAnioF] = React.useState("Todos");
  const [mesF, setMesF] = React.useState("Todos");
  const [ciaF, setCiaF] = React.useState("Todos");
  const [tipoF, setTipoF] = React.useState("Todos");
  const [selectedId, setSelectedId] = React.useState(null);
  const [detailId, setDetailId] = React.useState(null);
  const [modal, setModal] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const tt = React.useRef(null);
  const flash = React.useCallback((msg) => { setToast({ msg, id: Date.now() }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2600); }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (window.DB && window.DB.configured() && window.DB.fact) {
        try { const items = await window.DB.fact.list(); if (alive) { setFacturas(items); setUsingDb(true); } }
        catch (e) { console.error("Facturas:", e); if (alive) { setFacturas([]); setUsingDb(false); flash("No se pudieron cargar las facturas"); } }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [flash]);

  React.useEffect(() => {
    if (!usingDb || !window.DB.fact || !window.DB.fact.subscribe) return;
    let timer = null, alive = true;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { try { const items = await window.DB.fact.list(); if (alive) setFacturas(items); } catch (e) { console.error(e); } }, 400); };
    const unsub = window.DB.fact.subscribe(refresh);
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [usingDb]);

  const activos = facturas.filter((f) => !f.eliminado);
  const anios = Array.from(new Set(activos.map((f) => f.anio))).sort();
  const companias = Array.from(new Set(activos.map((f) => f.razonSocial))).sort();

  const rows = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return activos.filter((f) => {
      if (anioF !== "Todos" && String(f.anio) !== String(anioF)) return false;
      if (mesF !== "Todos" && String(f.mes) !== String(mesF)) return false;
      if (ciaF !== "Todos" && f.razonSocial !== ciaF) return false;
      if (tipoF !== "Todos" && f.tipo !== tipoF) return false;
      if (q) { const hay = [f.razonSocial, f.nroFactura, f.cuit, f.id, f.mailEnvio].join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    }).sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes) || (a.n - b.n));
  }, [activos, query, anioF, mesF, ciaF, tipoF]);

  const selected = activos.find((f) => f.id === selectedId) || null;
  const detailItem = activos.find((f) => f.id === detailId) || null;
  const openEdit = (item) => { setDetailId(null); setModal({ type: "edit", item }); };
  const askDelete = (item) => { setDetailId(null); setModal({ type: "delete", item }); };

  const handleCreate = async (data) => {
    let n;
    if (usingDb) { try { n = (await window.DB.fact.maxN()) + 1; } catch (e) { n = activos.reduce((m, f) => Math.max(m, f.n || 0), 0) + 1; } }
    else { n = activos.reduce((m, f) => Math.max(m, f.n || 0), 0) + 1; }
    let item = { ...data, id: "FAC-" + pad4(n), n, ultimaModPor: station, ultimaModFecha: new Date().toISOString(), eliminado: false };
    if (usingDb) { try { item = await window.DB.fact.create(item); } catch (e) { console.error(e); flash("Error al guardar en Supabase"); return; } }
    setFacturas((p) => [item, ...p]); setModal(null); flash(`Factura de ${data.razonSocial} registrada`);
  };
  const handleUpdate = async (data) => {
    let updated = { ...data, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    if (usingDb) { try { updated = await window.DB.fact.update(updated); } catch (e) { console.error(e); flash("Error al actualizar en Supabase"); return; } }
    setFacturas((p) => p.map((f) => f.id === data.id ? { ...f, ...updated } : f)); setModal(null); flash(`Factura de ${data.razonSocial} actualizada`);
  };
  const handleDelete = async (item) => {
    if (usingDb) { try { await window.DB.fact.remove(item); } catch (e) { console.error(e); flash("Error al eliminar en Supabase"); return; } }
    setFacturas((p) => p.map((f) => f.id === item.id ? { ...f, eliminado: true } : f));
    if (selectedId === item.id) setSelectedId(null);
    setModal(null); flash(`Factura de ${item.razonSocial} dada de baja`);
  };

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando facturación…</div></div>;

  if (active === "fact-reportes") {
    return (
      <>
        <ReportesFacturacion data={activos} />
        {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
      </>
    );
  }

  return (
    <>
      <FactKpis data={rows} />
      <div className="panel">
        <FactToolbar count={rows.length} companias={companias} anios={anios}
          anioF={anioF} onAnio={setAnioF} mesF={mesF} onMes={setMesF} ciaF={ciaF} onCia={setCiaF} tipoF={tipoF} onTipo={setTipoF}
          selected={selected} onNew={() => setModal({ type: "new" })}
          onEdit={() => selected && openEdit(selected)} onDelete={() => selected && askDelete(selected)} />
        <FacturasTable rows={rows} selectedId={selectedId} onSelect={setSelectedId} onOpen={(id) => setDetailId(id)} />
      </div>

      {detailItem && <FacturaDetailModal item={detailItem} onClose={() => setDetailId(null)} onEdit={openEdit} onDelete={askDelete} />}
      {modal?.type === "new" && <FacturaFormModal mode="new" station={station} onClose={() => setModal(null)} onSubmit={handleCreate} />}
      {modal?.type === "edit" && <FacturaFormModal mode="edit" initial={modal.item} station={station} onClose={() => setModal(null)} onSubmit={handleUpdate} />}
      {modal?.type === "delete" && <FactConfirmDelete item={modal.item} station={station} onClose={() => setModal(null)} onConfirm={handleDelete} />}
      {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
    </>
  );
}

Object.assign(window, { FacturacionModule });
