// comercial.jsx — Saraceni Seguros · Módulo COMERCIAL
// Pedidos de cotización que llegan del link público /cotizar-hogar.
// Panel con KPIs + bandeja de cotizaciones para gestionar y cerrar.

const COT_ESTADO = {
  "nueva":      { fg: "#B91C1C", bg: "#FBE3E3", t: "Nueva" },
  "cotizada":   { fg: "#15803D", bg: "#E6F4EA", t: "Cotizada" },
  "descartada": { fg: "#475569", bg: "#EEF1F4", t: "Descartada" },
};
function cotBadge(estado) {
  const c = COT_ESTADO[estado] || COT_ESTADO.nueva;
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 12 }}><span className="badge-dot" style={{ background: c.fg }} />{c.t}</span>;
}
const money = (v) => (v == null || v === "" ? "" : "$ " + Number(v).toLocaleString("es-AR"));

// ---------- tarjeta de cotización ----------
function CotCard({ c, onCotizar, onDescartar, onReabrir, onNotas }) {
  const [notas, setNotas] = React.useState(c.notasInternas || "");
  const [editNotas, setEditNotas] = React.useState(false);
  const nueva = c.estado === "nueva";
  const D = ({ k, v, mono }) => (v || v === 0 ? <div><div className="sol-k">{k}</div><div className={"sol-v" + (mono ? " mono" : "")}>{v}</div></div> : null);
  const domicilio = [c.direccion, c.piso ? "Piso " + c.piso : null, c.localidad, c.codigoPostal ? "CP " + c.codigoPostal : null].filter(Boolean).join(" · ");

  return (
    <div className={"sol-card" + (nueva ? " nueva" : "")}>
      <div className="sol-head">
        <div>
          <div className="sol-name">{c.nombre}</div>
          <div className="sol-meta mono">{c.id} · ref {c.ref}{c.creado ? " · " + fmtTimeAgo(c.creado) : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="cia-pill sm">Hogar</span>
          {cotBadge(c.estado)}
        </div>
      </div>

      <div className="sol-sub">Contacto</div>
      <div className="sol-grid-datos">
        <D k="Documento" v={c.documento} mono />
        <D k="Teléfono" v={c.telefono} mono />
        <D k="Email" v={c.email} />
      </div>

      <div className="sol-sub">Vivienda</div>
      <div className="sol-grid-datos">
        <D k="Tipo" v={c.tipoVivienda} />
        <D k="Superficie" v={c.metros2 ? c.metros2 + " m²" : ""} />
        <D k="Código postal" v={c.codigoPostal} mono />
        {c.enCountry != null && (
          <div>
            <div className="sol-k">Country / barrio cerrado</div>
            <div className="sol-v" style={c.enCountry ? { color: "#15803D", fontWeight: 700 } : null}>
              {c.enCountry ? "Sí — con vallado perimetral" : "No"}
            </div>
          </div>
        )}
        {c.tienePileta != null && (
          <div>
            <div className="sol-k">Pileta</div>
            <div className="sol-v" style={c.tienePileta ? { color: "#1D4ED8", fontWeight: 700 } : null}>
              {c.tienePileta ? "Sí" : "No"}
            </div>
          </div>
        )}
      </div>
      {domicilio && <div className="sol-relato" style={{ marginTop: 8 }}>{domicilio}</div>}
      {(c.alarma || c.medidasSeguridad) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {c.alarma && <span className="cia-pill sm">Alarma</span>}
          {c.medidasSeguridad && <span className="cia-pill sm">Medidas mínimas de seguridad</span>}
        </div>
      )}

      <div className="sol-sub">Coberturas pedidas</div>
      {(c.equiposFuera || c.notebookPc || c.bicicleta || c.roboCelular) ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.equiposFuera && <span className="cia-pill sm">Equipos electrónicos fuera del domicilio</span>}
            {c.notebookPc && <span className="cia-pill sm">Notebook o PC en el domicilio</span>}
            {c.bicicleta && <span className="cia-pill sm">Bicicleta</span>}
            {c.roboCelular && <span className="cia-pill sm">Robo de celular</span>}
          </div>
          {c.bicicleta && (
            <div className="sol-relato" style={{ marginTop: 8 }}>
              <b>Bicicleta:</b> {[c.bicicletaMarca, c.bicicletaModelo].filter(Boolean).join(" ")}
              {c.bicicletaValor ? " — " + money(c.bicicletaValor) : ""}
            </div>
          )}
          {c.equiposFuera && c.equiposFueraDetalle && (
            <div className="sol-relato" style={{ marginTop: 8 }}><b>Equipos fuera del domicilio:</b> {c.equiposFueraDetalle}</div>
          )}
          {c.notebookPc && c.notebookPcDetalle && (
            <div className="sol-relato" style={{ marginTop: 8 }}><b>Notebook / PC:</b> {c.notebookPcDetalle}</div>
          )}
        </>
      ) : (
        <div className="sol-v" style={{ color: "var(--muted)" }}>Solo la cobertura base</div>
      )}
      {c.observaciones && <div className="sol-relato" style={{ marginTop: 8 }}>{c.observaciones}</div>}

      {(editNotas || c.notasInternas) && (
        <div style={{ marginTop: 12 }}>
          <div className="sol-k" style={{ marginBottom: 4 }}>Notas internas</div>
          {editNotas ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <textarea className="input" rows={2} style={{ flex: "1 1 260px" }} value={notas} autoFocus
                onChange={(e) => setNotas(e.target.value)} placeholder="Prima cotizada, compañía, seguimiento…" />
              <button className="btn-primary sm" onClick={() => { onNotas(c, notas); setEditNotas(false); }}>Guardar</button>
              <button className="btn-ghost sm" onClick={() => { setNotas(c.notasInternas || ""); setEditNotas(false); }}>Cancelar</button>
            </div>
          ) : (
            <div className="sol-v" style={{ whiteSpace: "pre-wrap" }}>{c.notasInternas}</div>
          )}
        </div>
      )}

      <div className="sol-actions">
        {!editNotas && <button className="btn-ghost sm" onClick={() => setEditNotas(true)}><Ico name="edit" size={14} />{c.notasInternas ? "Editar notas" : "Agregar notas"}</button>}
        {nueva ? (
          <>
            <button className="btn-primary" onClick={() => onCotizar(c)}><Ico name="check" size={16} />Marcar cotizada</button>
            <button className="btn-ghost danger" onClick={() => onDescartar(c)}><Ico name="close" size={15} />Descartar</button>
          </>
        ) : (
          <button className="btn-ghost sm" onClick={() => onReabrir(c)}><Ico name="refresh" size={14} />Reabrir</button>
        )}
      </div>
    </div>
  );
}

// ---------- panel de control ----------
function ComercialPanel({ data }) {
  const nuevas = data.filter((c) => c.estado === "nueva");
  const cotizadas = data.filter((c) => c.estado === "cotizada");
  const descartadas = data.filter((c) => c.estado === "descartada");
  const cerradas = cotizadas.length + descartadas.length;
  const conversion = cerradas ? Math.round((cotizadas.length / cerradas) * 100) : 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const delMes = data.filter((c) => (c.creado || "").slice(0, 7) === hoy.slice(0, 7)).length;

  const cards = [
    { label: "Pedidos sin responder", value: nuevas.length, hint: "esperando cotización", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "mail" },
    { label: "Cotizadas", value: cotizadas.length, hint: "propuesta enviada", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "check" },
    { label: "Pedidos del mes", value: delMes, hint: "entraron este mes", tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "grid" },
    { label: "Cotizadas / cerradas", value: conversion + "%", hint: cerradas + " cerradas en total", tone: { bg: "#FDF1DC", fg: "#B45309" }, icon: "target" },
  ];

  return (
    <div>
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
      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left"><span className="toolbar-title">Últimos pedidos de cotización</span><span className="toolbar-count">{data.length}</span></div>
        </div>
        {data.length === 0 ? (
          <div className="empty"><div className="empty-ico"><Ico name="mail" size={26} /></div>
            <div className="empty-title">Todavía no llegaron pedidos</div>
            <div className="empty-sub">Compartí el link de cotización con tus clientes y los pedidos aparecen acá al instante.</div></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Recibido</th><th>Interesado</th><th>Vivienda</th><th>Contacto</th><th>Estado</th><th>N°</th></tr></thead>
              <tbody>
                {data.slice(0, 25).map((c) => (
                  <tr key={c._dbId}>
                    <td className="cell-sub">{c.creado ? fmtDate(c.creado.slice(0, 10)) : "—"}</td>
                    <td><div className="cell-strong">{c.nombre}</div><div className="cell-sub mono">{c.documento}</div></td>
                    <td>
                      <div>{c.tipoVivienda}{c.metros2 ? " · " + c.metros2 + " m²" : ""}</div>
                      <div className="cell-sub">{[c.localidad, c.codigoPostal].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="mono">{c.telefono}</td>
                    <td>{cotBadge(c.estado)}</td>
                    <td className="mono cell-id">{c.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- bandeja de cotizaciones ----------
function CotizacionesView({ data, onCotizar, onDescartar, onReabrir, onNotas }) {
  const [verHist, setVerHist] = React.useState(false);
  const nuevas = data.filter((c) => c.estado === "nueva");
  const resto = data.filter((c) => c.estado !== "nueva");
  const linkPublico = window.location.origin + "/cotizar-hogar";
  const copiar = () => { try { navigator.clipboard.writeText(linkPublico); } catch (e) { /* noop */ } };

  return (
    <div className="sol-wrap">
      <div className="ag-banner">
        <span className="ag-banner-ico" style={{ background: "#fdecec", color: "var(--brand)" }}><Ico name="home" size={22} /></span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Cotizaciones de seguro de hogar</span>
          <span className="ag-banner-sub">Compartí este link con tus clientes: <b className="mono">{linkPublico}</b></span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={copiar}><Ico name="link" size={15} />Copiar link</button>
      </div>

      {nuevas.length > 0 ? (
        <div className="sol-grid">
          {nuevas.map((c) => <CotCard key={c._dbId} c={c} onCotizar={onCotizar} onDescartar={onDescartar} onReabrir={onReabrir} onNotas={onNotas} />)}
        </div>
      ) : (
        <div className="empty"><div className="empty-ico"><Ico name="check" size={26} /></div>
          <div className="empty-title">Sin pedidos pendientes</div>
          <div className="empty-sub">Cuando alguien complete el formulario de cotización, aparece acá al instante.</div></div>
      )}

      {resto.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button className="btn-ghost sm" onClick={() => setVerHist((v) => !v)}>
            <Ico name={verHist ? "chevL" : "chevR"} size={14} />{verHist ? "Ocultar gestionadas" : `Ver cotizadas y descartadas (${resto.length})`}
          </button>
          {verHist && (
            <div className="sol-grid" style={{ marginTop: 12 }}>
              {resto.map((c) => <CotCard key={c._dbId} c={c} onCotizar={onCotizar} onDescartar={onDescartar} onReabrir={onReabrir} onNotas={onNotas} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- orquestador ----------
function ComercialModule({ active, station, query }) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const timer = React.useRef(null);
  const flash = (msg, err) => {
    setToast({ msg, err: !!err, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), err ? 4000 : 2600);
  };

  const load = React.useCallback(async () => {
    if (!window.DB || !window.DB.configured() || !window.DB.cot) { setLoading(false); return; }
    try { setData(await window.DB.cot.list()); }
    catch (e) { console.error("Cotizaciones:", e); }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => {
    if (!window.DB || !window.DB.configured() || !window.DB.cot) return;
    let t = null;
    const unsub = window.DB.cot.subscribe(() => { clearTimeout(t); t = setTimeout(load, 400); });
    return () => { clearTimeout(t); if (unsub) unsub(); };
  }, [load]);

  const cambiarEstado = async (c, estado, msg) => {
    try {
      const up = await window.DB.cot.update({ _dbId: c._dbId, estado, gestionadaPor: station });
      setData((p) => p.map((x) => (x._dbId === c._dbId ? up : x)));
      flash(msg);
    } catch (e) { console.error(e); flash("No se pudo actualizar la cotización", true); }
  };
  const guardarNotas = async (c, notas) => {
    try {
      const up = await window.DB.cot.update({ _dbId: c._dbId, estado: c.estado, gestionadaPor: station, notasInternas: notas });
      setData((p) => p.map((x) => (x._dbId === c._dbId ? up : x)));
      flash("Notas guardadas");
    } catch (e) { console.error(e); flash("No se pudieron guardar las notas", true); }
  };

  const filtrada = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => [c.nombre, c.documento, c.telefono, c.email, c.direccion, c.localidad, c.codigoPostal, c.id, c.ref]
      .join(" ").toLowerCase().includes(q));
  }, [data, query]);

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando…</div></div>;

  return (
    <>
      {active === "com-panel"
        ? <ComercialPanel data={filtrada} />
        : <CotizacionesView data={filtrada}
            onCotizar={(c) => cambiarEstado(c, "cotizada", "Cotización marcada como enviada")}
            onDescartar={(c) => { if (window.confirm(`¿Descartar el pedido de ${c.nombre}?`)) cambiarEstado(c, "descartada", "Pedido descartado"); }}
            onReabrir={(c) => cambiarEstado(c, "nueva", "Pedido reabierto")}
            onNotas={guardarNotas} />}
      {toast && (
        <div className="toast">
          <span className="toast-ico" style={toast.err ? { background: "#DC2626" } : null}><Ico name={toast.err ? "alert" : "check"} size={15} /></span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

Object.assign(window, { ComercialModule, CotizacionesView, ComercialPanel });
