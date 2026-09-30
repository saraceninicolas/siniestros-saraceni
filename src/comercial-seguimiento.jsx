// comercial-seguimiento.jsx — El pipeline: qué se cotizó y qué se cerró
// ─────────────────────────────────────────────────────────────────────────────
// La bandeja de al lado (`comercial.jsx`) atiende lo que entra por el
// formulario público: un pedido llega, se marca "cotizada" y ahí moría. No
// quedaba registro de qué se cotizó, por cuánto, ni cuáles se terminaron
// cerrando; y menos todavía de quién hizo cada llamado.
//
// Esta pantalla es la otra mitad: el seguimiento. Misma tabla
// (`cotizaciones`), porque una cotización que entra por la web y una que carga
// el equipo son la misma cosa en momentos distintos. `origen` las distingue.
//
// Cada movimiento queda en `acciones` con nombre y fecha. La regla es que el
// estado no se cambia "a mano y listo": cambiarlo escribe la acción que le
// corresponde, así el historial nunca miente por olvido.
// ─────────────────────────────────────────────────────────────────────────────

const SEG_ESTADOS = {
  nueva:      { t: "Sin cotizar", fg: "var(--peligro-hondo)", bg: "var(--peligro-soft)" },
  cotizada:   { t: "Cotizada",    fg: "var(--info-2)",        bg: "var(--info-soft)" },
  cerrada:    { t: "Cerrada",     fg: "var(--ok)",            bg: "var(--ok-soft)" },
  perdida:    { t: "Perdida",     fg: "var(--ink-2)",         bg: "var(--line-2)" },
  descartada: { t: "Descartada",  fg: "var(--ink-2)",         bg: "var(--line-2)" },
};

const segMoney = (v) => (v == null || v === "" ? "—" : "$ " + Number(v).toLocaleString("es-AR"));

function segBadge(estado) {
  const e = SEG_ESTADOS[estado] || SEG_ESTADOS.nueva;
  return <span className="badge" style={{ background: e.bg, color: e.fg, fontSize: 12 }}>
    <span className="badge-dot" style={{ background: e.fg }} />{e.t}</span>;
}

// ---------- la ficha ----------
function SegFicha({ cot, acciones, station, cias, usuarios, onCerrar, onActualizar, onAccion, onBorrarAccion, puedeBorrar }) {
  const [f, setF] = React.useState({
    detalle: cot.detalle, ramo: cot.ramo, compania: cot.compania, prima: cot.prima == null ? "" : cot.prima,
    fechaCotizacion: cot.fechaCotizacion, responsable: cot.responsable || "",
    poliza: cot.poliza, fechaCierre: cot.fechaCierre, motivoPerdida: cot.motivoPerdida,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = () => onActualizar(cot, f);

  return (
    <div className="seg-ficha">
      <div className="seg-ficha-head">
        <div>
          <h3>{cot.nombre}</h3>
          <span className="seg-ficha-sub">
            {cot.id} · {RAMO_LABEL[cot.ramo] || cot.ramo}
            {cot.origen === "web" ? " · entró por la web" : " · cargada por el equipo"}
            {cot.telefono ? " · " + cot.telefono : ""}
          </span>
        </div>
        <button className="btn-ghost" onClick={onCerrar}><Ico name="close" size={15} />Cerrar</button>
      </div>

      <div className="seg-campos">
        <label><span>Qué se cotiza</span>
          <input className="input" value={f.detalle} onChange={(e) => set("detalle", e.target.value)}
            placeholder="Ej: Fiat Cronos 2021, casa en Pinamar…" /></label>
        <label><span>Ramo</span>
          <select className="input" value={f.ramo} onChange={(e) => set("ramo", e.target.value)}>
            {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
          </select></label>
        <label><span>Compañía</span>
          <select className="input" value={f.compania} onChange={(e) => set("compania", e.target.value)}>
            <option value="">—</option>
            {ciasParaElegir(cias).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
          </select></label>
        <label><span>Prima cotizada</span>
          <input className="input" type="number" value={f.prima} onChange={(e) => set("prima", e.target.value)} placeholder="0" /></label>
        <label><span>Fecha de cotización</span>
          <input className="input" type="date" value={f.fechaCotizacion} onChange={(e) => set("fechaCotizacion", e.target.value)} /></label>
        <label><span>Responsable</span>
          <select className="input" value={f.responsable} onChange={(e) => set("responsable", e.target.value)}>
            <option value="">Sin asignar</option>
            {(usuarios || []).map((u) => <option key={u.id || u.email} value={u.email}>{u.nombre || u.email}</option>)}
          </select></label>
        {cot.estado === "cerrada" && (
          <>
            <label><span>Póliza</span>
              <input className="input" value={f.poliza} onChange={(e) => set("poliza", e.target.value)} /></label>
            <label><span>Fecha de cierre</span>
              <input className="input" type="date" value={f.fechaCierre} onChange={(e) => set("fechaCierre", e.target.value)} /></label>
          </>
        )}
        {cot.estado === "perdida" && (
          <label className="seg-ancho"><span>Por qué se perdió</span>
            <input className="input" value={f.motivoPerdida} onChange={(e) => set("motivoPerdida", e.target.value)}
              placeholder="Precio, se quedó con su productor, no contesta…" /></label>
        )}
      </div>

      <div className="seg-acciones">
        <button className="btn-ghost" onClick={guardar}><Ico name="check" size={15} />Guardar datos</button>
        <div className="seg-acciones-sep" />
        {cot.estado !== "cotizada" && <button className="btn-ghost" onClick={() => onActualizar(cot, f, "cotizada")}>Marcar cotizada</button>}
        {cot.estado !== "cerrada" && <button className="btn-primary" onClick={() => onActualizar(cot, f, "cerrada")}><Ico name="check" size={15} />Se cerró</button>}
        {cot.estado !== "perdida" && <button className="btn-ghost danger" onClick={() => onActualizar(cot, f, "perdida")}>Se perdió</button>}
      </div>

      <div className="seg-hist-tit">Qué se hizo</div>
      <HistorialAcciones acciones={acciones}
        onAccion={(a) => onAccion(cot, a)} onBorrar={puedeBorrar ? onBorrarAccion : null} />
    </div>
  );
}

// ---------- alta manual ----------
function SegNueva({ cias, usuarios, station, onCerrar, onCrear }) {
  const [f, setF] = React.useState({
    nombre: "", telefono: "", email: "", ramo: "AUTO", detalle: "",
    compania: "", prima: "", fechaCotizacion: new Date().toISOString().slice(0, 10),
    responsable: station || "", localidad: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const listo = f.nombre.trim().length > 1;
  return (
    <ModalShell title="Nueva cotización" sub="La que no entró por la web: la que pediste vos."
      onClose={onCerrar}
      footer={<>
        <button className="btn-ghost" onClick={onCerrar}>Cancelar</button>
        <button className="btn-primary" disabled={!listo} onClick={() => onCrear(f)}>
          <Ico name="check" size={16} />Crear
        </button>
      </>}>
      <div className="seg-campos">
            <label className="seg-ancho"><span>Cliente *</span>
              <input className="input" value={f.nombre} autoFocus onChange={(e) => set("nombre", e.target.value)} /></label>
            <label><span>Teléfono</span><input className="input" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></label>
            <label><span>Mail</span><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
            <label><span>Ramo</span>
              <select className="input" value={f.ramo} onChange={(e) => set("ramo", e.target.value)}>
                {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
              </select></label>
            <label className="seg-ancho"><span>Qué se cotiza</span>
              <input className="input" value={f.detalle} onChange={(e) => set("detalle", e.target.value)}
                placeholder="Ej: Fiat Cronos 2021, casa en Pinamar…" /></label>
            <label><span>Compañía</span>
              <select className="input" value={f.compania} onChange={(e) => set("compania", e.target.value)}>
                <option value="">—</option>
                {ciasParaElegir(cias).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
              </select></label>
            <label><span>Prima</span><input className="input" type="number" value={f.prima} onChange={(e) => set("prima", e.target.value)} /></label>
            <label><span>Fecha de cotización</span>
              <input className="input" type="date" value={f.fechaCotizacion} onChange={(e) => set("fechaCotizacion", e.target.value)} /></label>
            <label><span>Responsable</span>
              <select className="input" value={f.responsable} onChange={(e) => set("responsable", e.target.value)}>
                <option value="">Sin asignar</option>
                {(usuarios || []).map((u) => <option key={u.id || u.email} value={u.email}>{u.nombre || u.email}</option>)}
              </select></label>
      </div>
    </ModalShell>
  );
}

// ---------- la pantalla ----------
function SeguimientoView({ data, acciones, station, usuarios, cias, query, rol, onCrear, onActualizar, onAccion, onBorrarAccion }) {
  const [foco, setFoco] = React.useState("todas");
  const [ramo, setRamo] = React.useState("Todos");
  const [quien, setQuien] = React.useState("Todos");
  const [abierta, setAbierta] = React.useState(null);
  const [nueva, setNueva] = React.useState(false);

  // Las acciones vienen todas juntas en una consulta y se agrupan acá: pedirlas
  // de a una por cotización serían veinte viajes cada vez que se abre la pantalla.
  const porCot = React.useMemo(() => {
    const m = {};
    (acciones || []).forEach((a) => {
      if (!a.cotizacionId) return;
      (m[a.cotizacionId] = m[a.cotizacionId] || []).push(a);
    });
    return m;
  }, [acciones]);

  const hoy = new Date();
  const esteMes = (iso) => {
    if (!iso) return false;
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
  };

  const cerradas = data.filter((c) => c.estado === "cerrada");
  const cotizadas = data.filter((c) => c.estado === "cotizada");
  const cerradasMes = cerradas.filter((c) => esteMes(c.fechaCierre || c.creado));
  const primaMes = cerradasMes.reduce((a, c) => a + (Number(c.prima) || 0), 0);
  const decididas = cerradas.length + data.filter((c) => c.estado === "perdida").length;
  const tasa = decididas ? Math.round((cerradas.length / decididas) * 100) : 0;

  const lista = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return data
      .filter((c) => {
        if (foco === "abiertas" && !["nueva", "cotizada"].includes(c.estado)) return false;
        if (foco === "cerradas" && c.estado !== "cerrada") return false;
        if (foco === "perdidas" && c.estado !== "perdida") return false;
        if (foco === "dormidas") {
          if (!["nueva", "cotizada"].includes(c.estado)) return false;
          const d = accDiasQuieto(porCot[c._dbId] || [], c.creado);
          if (d == null || d < 7) return false;
        }
        if (ramo !== "Todos" && c.ramo !== ramo) return false;
        if (quien !== "Todos" && (c.responsable || "") !== quien) return false;
        if (q && ![c.nombre, c.detalle, c.id, c.telefono, c.poliza].join(" ").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => String(b.fechaCotizacion || b.creado).localeCompare(String(a.fechaCotizacion || a.creado)));
  }, [data, foco, ramo, quien, query, porCot]);

  const cot = abierta ? data.find((c) => c._dbId === abierta) : null;

  return (
    <div className="seg-wrap">
      <div className="est-grid seg-kpis">
        <EstCard title="Cotizadas sin resolver" sub="esperando respuesta del cliente">
          <div className="seg-kpi-num">{cotizadas.length}</div>
        </EstCard>
        <EstCard title="Cerradas este mes" sub="las que se ganaron">
          <div className="seg-kpi-num">{cerradasMes.length}</div>
        </EstCard>
        <EstCard title="Prima cerrada del mes" sub="suma de lo que se emitió">
          <div className="seg-kpi-num">{segMoney(primaMes)}</div>
        </EstCard>
        <EstCard title="Tasa de cierre" sub="sobre las que ya se decidieron">
          <div className="seg-kpi-num">{tasa}%</div>
        </EstCard>
      </div>

      <div className="seg-barra">
        <div className="seg-chips">
          {[["todas", "Todas"], ["abiertas", "En gestión"], ["cerradas", "Cerradas"],
            ["perdidas", "Perdidas"], ["dormidas", "Sin novedades"]].map(([k, t]) => (
            <button key={k} className={"seg-chip" + (foco === k ? " is-on" : "")} onClick={() => setFoco(k)}>{t}</button>
          ))}
        </div>
        <select className="select" value={ramo} onChange={(e) => setRamo(e.target.value)}>
          <option value="Todos">Todos los ramos</option>
          {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
        </select>
        <select className="select" value={quien} onChange={(e) => setQuien(e.target.value)}>
          <option value="Todos">Cualquier responsable</option>
          {(usuarios || []).map((u) => <option key={u.id || u.email} value={u.email}>{u.nombre || u.email}</option>)}
        </select>
        <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={() => setNueva(true)}>
          <Ico name="plus" size={15} />Nueva cotización
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="empty"><div className="empty-ico"><Ico name="store" size={26} /></div>
          <div className="empty-title">Nada por acá</div>
          <div className="empty-sub">No hay cotizaciones con ese filtro.</div></div>
      ) : (
        <div className="panel seg-tabla-wrap">
          <table className="table seg-tabla">
            <thead><tr>
              <th>Cliente</th><th>Ramo</th><th>Qué se cotiza</th><th>Cotizada</th>
              <th>Prima</th><th>Compañía</th><th>Estado</th><th>Responsable</th><th>Último movimiento</th>
            </tr></thead>
            <tbody>
              {lista.map((c) => {
                const accs = porCot[c._dbId] || [];
                const ult = accs[0];
                const dias = accDiasQuieto(accs, c.creado);
                return (
                  <tr key={c._dbId} className={"seg-fila" + (abierta === c._dbId ? " is-on" : "")}
                    onClick={() => setAbierta(abierta === c._dbId ? null : c._dbId)}>
                    <td><b>{c.nombre}</b>{c.origen === "web" && <span className="seg-web" title="Entró por el formulario público">web</span>}</td>
                    <td>{RAMO_LABEL[c.ramo] || c.ramo}</td>
                    <td className="seg-detalle">{c.detalle || <span className="seg-tenue">—</span>}</td>
                    <td>{c.fechaCotizacion ? fmtDateShort(c.fechaCotizacion) : <span className="seg-tenue">—</span>}</td>
                    <td>{c.prima == null ? <span className="seg-tenue">—</span> : segMoney(c.prima)}</td>
                    <td>{c.compania ? ciaLabel(c.compania) : <span className="seg-tenue">—</span>}</td>
                    <td>{segBadge(c.estado)}</td>
                    <td>{c.responsable ? String(c.responsable).split("@")[0] : <span className="seg-tenue">sin asignar</span>}</td>
                    <td>
                      {ult
                        ? <span title={ult.nota}>{accTipo(ult.tipo).label} · {String(ult.usuario).split("@")[0]}
                            <span className={"seg-dias" + (dias >= 15 ? " is-alerta" : dias >= 7 ? " is-tibia" : "")}> · hace {dias} d</span></span>
                        : <span className="seg-tenue">sin movimientos</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cot && (
        <SegFicha cot={cot} acciones={porCot[cot._dbId] || []} station={station} cias={cias}
          usuarios={usuarios} puedeBorrar={rol === "organizador"}
          onCerrar={() => setAbierta(null)} onActualizar={onActualizar}
          onAccion={onAccion} onBorrarAccion={onBorrarAccion} />
      )}

      {nueva && <SegNueva cias={cias} usuarios={usuarios} station={station}
        onCerrar={() => setNueva(false)}
        onCrear={(f) => { onCrear(f); setNueva(false); }} />}
    </div>
  );
}

Object.assign(window, { SeguimientoView, SegFicha, SegNueva, SEG_ESTADOS, segBadge });

// Marca este archivo como modulo ES (ver el comentario de data.jsx).
export {};
