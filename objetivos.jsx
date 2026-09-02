// objetivos.jsx — Módulo de Objetivos (tablero + tabla)
// ─────────────────────────────────────────────────────────────────────────────
// Dos pantallas, con las mismas piezas del resto del portal (KPIs, panel,
// toolbar, tabla ordenable, badges):
//   · Tablero  → KPIs, cumplimiento por área, próximos a vencer y últimos cargados
//   · Objetivos → tabla completa con búsqueda, filtros, orden y paginación
// El alta y la edición viven en objetivos-form.jsx; el cálculo, en
// objetivos-datos.jsx. Acá solo queda la interfaz y el manejo de estado.
// ─────────────────────────────────────────────────────────────────────────────

const OBJ_POR_PAGINA = 10;

// ---------- piezas chicas ----------
function ObjBadge({ estado }) {
  return (
    <span className="badge" style={{ background: estado.bg, color: estado.fg, fontSize: 11.5 }}>
      <Ico name={estado.icono} size={12} />{estado.label}
    </span>
  );
}
function ObjTendenciaChip({ v, sufijo }) {
  if (v == null) return <span className="obj-tend nula" title="Todavía no hay período anterior con datos para comparar">—</span>;
  const cls = v > 0.5 ? "sube" : v < -0.5 ? "baja" : "igual";
  return (
    <span className={"obj-tend " + cls} title={"Variación contra el período anterior"}>
      {v > 0 ? "↑" : v < 0 ? "↓" : "→"} {(v > 0 ? "+" : "") + objPctTxt(v)}{sufijo ? " " + sufijo : ""}
    </span>
  );
}
function ObjBarra({ pct, color, alto }) {
  return (
    <span className="obj-barra" style={alto ? { height: alto } : null}>
      <span style={{ width: Math.min(100, Math.max(0, pct)) + "%", background: color }} />
    </span>
  );
}
function ObjAreaChip({ area }) {
  const a = objArea(area);
  return (
    <span className="obj-area-chip">
      <span className="obj-area-ico" style={{ background: a.bg, color: a.color }}><Ico name={a.icono} size={13} /></span>
      {a.label}
    </span>
  );
}
// Esqueleto de carga: mismas medidas que el contenido real, para que no salte
function ObjSkeleton() {
  return (
    <div className="obj-skel" aria-busy="true" aria-label="Cargando objetivos">
      <div className="kpis">{[0, 1, 2, 3].map((i) => <div className="kpi sk" key={i}><span className="sk-linea corta" /><span className="sk-linea grande" /><span className="sk-linea" /></div>)}</div>
      <div className="obj-dash-grid">
        <div className="est-card"><span className="sk-linea corta" />{[0, 1, 2, 3].map((i) => <span className="sk-fila" key={i} />)}</div>
        <div className="est-card"><span className="sk-linea corta" />{[0, 1, 2].map((i) => <span className="sk-fila" key={i} />)}</div>
      </div>
    </div>
  );
}
function ObjVacio({ titulo, sub, accion }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Ico name="target" size={26} /></div>
      <div className="empty-title">{titulo}</div>
      <div className="empty-sub">{sub}</div>
      {accion}
    </div>
  );
}

// ---------- KPIs ----------
function ObjKpis({ lista, fuentes }) {
  const n = lista.length;
  const cumplidos = lista.filter((o) => objEstado(o, fuentes).k === "cumplido");
  const atrasados = lista.filter((o) => objEstado(o, fuentes).k === "atrasado");
  const enCurso = n - cumplidos.length - atrasados.length;
  const promedio = n ? Math.round(lista.reduce((s, o) => s + Math.min(100, objPct(o, fuentes)), 0) / n) : 0;

  // El monto solo suma los objetivos medidos en pesos: mezclar pólizas con plata no diría nada
  const enPesos = lista.filter(objEsPlata);
  const alcanzado = enPesos.reduce((s, o) => s + objAvance(o, fuentes), 0);
  const metaTotal = enPesos.reduce((s, o) => s + (Number(o.meta) || 0), 0);

  const tendencias = lista.map((o) => objTendencia(o, fuentes)).filter((t) => t != null);
  const tendencia = tendencias.length ? Math.round((tendencias.reduce((a, b) => a + b, 0) / tendencias.length) * 10) / 10 : null;

  const pctDe = (x) => (n ? Math.round((x / n) * 100) : 0);
  const tarjetas = [
    { k: "cumplidos", label: "Objetivos cumplidos", valor: cumplidos.length, hint: `${pctDe(cumplidos.length)}% del total`, tono: OBJ_ESTADOS.cumplido, icono: "check" },
    { k: "curso", label: "En progreso", valor: enCurso, hint: `${pctDe(enCurso)}% del total`, tono: OBJ_ESTADOS.curso, icono: "clock" },
    { k: "atrasados", label: "Atrasados", valor: atrasados.length, hint: `${pctDe(atrasados.length)}% del total`, tono: OBJ_ESTADOS.atrasado, icono: "alert" },
  ];

  return (
    <div className="obj-kpis">
      <div className="kpi obj-kpi-total">
        <span className="kpi-stripe" style={{ background: "var(--brand)" }} />
        <div className="kpi-top"><span className="kpi-label">Cumplimiento total</span></div>
        <div className="obj-kpi-total-body">
          <ChAnillo pct={promedio} size={92} grosor={11}
            color={promedio >= 80 ? "#16A34A" : promedio >= 50 ? "#2563EB" : "#EA580C"} />
          <div className="obj-kpi-total-txt">
            <span className="obj-kpi-monto" title="Suma de los objetivos medidos en pesos">{OBJ_ARS.format(alcanzado)}</span>
            <span className="obj-kpi-meta">de {OBJ_ARS.format(metaTotal)}</span>
            <ObjTendenciaChip v={tendencia} sufijo="vs período anterior" />
          </div>
        </div>
        <div className="kpi-foot"><span className="kpi-hint">{n} {n === 1 ? "objetivo" : "objetivos"} · el anillo es el promedio de avance</span></div>
      </div>

      {tarjetas.map((c) => (
        <div className="kpi" key={c.k}>
          <span className="kpi-stripe" style={{ background: c.tono.color }} />
          <div className="kpi-top">
            <span className="kpi-ico" style={{ background: c.tono.bg, color: c.tono.fg }}><Ico name={c.icono} size={17} /></span>
            <span className="kpi-label">{c.label}</span>
          </div>
          <div className="kpi-mid"><span className="kpi-value">{c.valor}</span><span className="obj-kpi-de">de {n}</span></div>
          <div className="kpi-foot"><span className="kpi-hint">{c.hint}</span></div>
        </div>
      ))}
    </div>
  );
}

// ---------- cumplimiento por área ----------
function ObjPorArea({ lista, fuentes, onArea }) {
  const filas = OBJ_AREAS.map((a) => {
    const del = lista.filter((o) => o.area === a.k);
    if (!del.length) return null;
    const actual = del.reduce((s, o) => s + objAvance(o, fuentes), 0);
    const meta = del.reduce((s, o) => s + (Number(o.meta) || 0), 0);
    const pct = meta ? Math.round((actual / meta) * 100) : 0;
    return { a, del, actual, meta, pct, muestra: del[0] };
  }).filter(Boolean).sort((x, y) => y.pct - x.pct);

  if (!filas.length) return <div className="ch-vacio">Todavía no hay objetivos para mostrar por área.</div>;
  return (
    <div className="obj-areas">
      {filas.map(({ a, del, actual, meta, pct, muestra }) => (
        <button className="obj-area-fila" key={a.k} onClick={() => onArea && onArea(a.k)}
          title={`Ver los ${del.length} objetivos de ${a.label}`}>
          <span className="obj-area-ico lg" style={{ background: a.bg, color: a.color }}><Ico name={a.icono} size={18} /></span>
          <div className="obj-area-body">
            <div className="obj-area-top">
              <span className="obj-area-nom">{a.label}</span>
              <span className="obj-area-nums mono">{objFmt(muestra, actual)} <i>de</i> {objFmt(muestra, meta)}</span>
            </div>
            <ObjBarra pct={pct} color={a.color} />
          </div>
          <span className="obj-area-pct" style={{ color: a.color }}>{pct}%</span>
          <Ico name="chevR" size={16} />
        </button>
      ))}
    </div>
  );
}

// ---------- próximos a vencer ----------
function ObjProximos({ lista, fuentes, onAbrir }) {
  const prox = lista
    .filter((o) => objEstado(o, fuentes).k !== "cumplido" && !objVencido(o))
    .sort((a, b) => (a.fechaHasta || "").localeCompare(b.fechaHasta || ""))
    .slice(0, 5);
  if (!prox.length) return <div className="ch-vacio">No hay objetivos por vencer. Todo cumplido o sin fecha próxima.</div>;
  return (
    <div className="obj-prox">
      {prox.map((o) => {
        const a = objArea(o.area);
        const pct = objPct(o, fuentes);
        const dias = objDiasRestantes(o);
        const h = objDia(o.fechaHasta);
        return (
          <button className="obj-prox-fila" key={o.id} onClick={() => onAbrir && onAbrir(o)}>
            <span className="obj-prox-fecha" title={dias === 0 ? "Vence hoy" : `Quedan ${dias} días`}>
              <b>{String(h.getDate()).padStart(2, "0")}</b>
              <i>{OBJ_MESES_CORTO[h.getMonth()].toUpperCase()}</i>
            </span>
            <div className="obj-prox-body">
              <div className="obj-prox-top">
                <span className="obj-prox-nom">{o.titulo}</span>
                <span className="obj-prox-nums mono">{objFmt(o, objAvance(o, fuentes))} <i>de</i> {objFmt(o, o.meta)}</span>
              </div>
              <ObjBarra pct={pct} color={a.color} />
              <span className="obj-prox-meta">{objPeriodoTexto(o)}{dias != null && dias <= 7 ? ` · ${dias === 0 ? "vence hoy" : "quedan " + dias + " días"}` : ""}</span>
            </div>
            <span className="obj-prox-pct" style={{ color: a.color }}>{Math.round(pct)}%</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- tabla ----------
function ObjTabla({ lista, fuentes, compacta, onEditar, onEliminar, onAvance }) {
  const [orden, setOrden] = React.useState({ k: "fecha", dir: "asc" });
  const [pagina, setPagina] = React.useState(1);
  const [editando, setEditando] = React.useState(null);   // id del objetivo con el avance abierto
  const [borrando, setBorrando] = React.useState(null);
  const [valor, setValor] = React.useState("");

  React.useEffect(() => { setPagina(1); }, [lista.length]);

  const val = (o) => ({
    objetivo: (o.titulo || "").toLowerCase(),
    area: objArea(o.area).label,
    responsable: (o.responsable || "zzz").toLowerCase(),
    fecha: o.fechaHasta || "",
    meta: Number(o.meta) || 0,
    avance: objAvance(o, fuentes),
    pct: objPct(o, fuentes),
    estado: objEstado(o, fuentes).label,
  }[orden.k]);
  const ordenada = React.useMemo(() => {
    const arr = [...lista].sort((a, b) => {
      const x = val(a), y = val(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return orden.dir === "desc" ? arr.reverse() : arr;
  }, [lista, orden, fuentes]);

  const paginas = Math.max(1, Math.ceil(ordenada.length / OBJ_POR_PAGINA));
  const visibles = compacta ? ordenada.slice(0, 5) : ordenada.slice((pagina - 1) * OBJ_POR_PAGINA, pagina * OBJ_POR_PAGINA);

  const Th = ({ k, children, right }) => (
    <th className="th-sort" style={right ? { textAlign: "right" } : null} title="Clic para ordenar"
      aria-sort={orden.k === k ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}
      onClick={() => setOrden((s) => ({ k, dir: s.k === k && s.dir === "asc" ? "desc" : "asc" }))}>
      {children}{orden.k === k ? (orden.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  if (!lista.length) {
    return <ObjVacio titulo="Ningún objetivo con estos filtros" sub="Probá con otra área, otro estado o limpiá la búsqueda." />;
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table obj-tabla">
          <thead>
            <tr>
              <Th k="objetivo">Objetivo</Th>
              <Th k="area">Área</Th>
              {!compacta && <Th k="responsable">Responsable</Th>}
              <Th k="fecha">Período</Th>
              <Th k="meta" right>Meta</Th>
              <Th k="avance" right>Avance</Th>
              <Th k="pct">%</Th>
              <Th k="estado">Estado</Th>
              <th style={{ width: 92 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((o) => {
              const a = objArea(o.area);
              const est = objEstado(o, fuentes);
              const pct = objPct(o, fuentes);
              const auto = objEsAuto(o);
              return (
                <tr key={o.id}>
                  <td>
                    <div className="cell-strong">{o.titulo}</div>
                    <div className="cell-sub">
                      {auto ? <span className="obj-auto" title="El avance lo calcula el sistema"><Ico name="refresh" size={11} />Automático</span>
                            : <span className="obj-manual" title="El avance se carga a mano">Manual</span>}
                      {o.descripcion ? " · " + o.descripcion : ""}
                    </div>
                  </td>
                  <td><ObjAreaChip area={o.area} /></td>
                  {!compacta && <td className="cell-sub">{o.responsable || "—"}{o.equipo ? <div className="cell-sub">{o.equipo}</div> : null}</td>}
                  <td className="cell-sub">{objPeriodoTexto(o)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{objFmt(o, o.meta)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {editando === o.id ? (
                      <span className="obj-inline">
                        <input className="input sm mono" autoFocus value={valor} inputMode="decimal"
                          onChange={(e) => setValor(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { onAvance(o, objNum(valor)); setEditando(null); }
                            if (e.key === "Escape") setEditando(null);
                          }} />
                        <button className="row-open ok" title="Guardar" onClick={() => { onAvance(o, objNum(valor)); setEditando(null); }}><Ico name="check" size={15} /></button>
                      </span>
                    ) : objFmt(o, objAvance(o, fuentes))}
                  </td>
                  <td>
                    <div className="obj-pct-celda">
                      <ObjBarra pct={pct} color={a.color} alto={7} />
                      <b style={{ color: a.color }}>{Math.round(pct)}%</b>
                    </div>
                  </td>
                  <td><ObjBadge estado={est} /></td>
                  <td>
                    {borrando === o.id ? (
                      <div className="obj-confirm">
                        <button className="btn-danger sm" onClick={() => onEliminar(o)}>Sí</button>
                        <button className="btn-ghost sm" onClick={() => setBorrando(null)}>No</button>
                      </div>
                    ) : (
                      <div className="obj-acciones">
                        {!auto && (
                          <button className="row-open" title="Actualizar avance" aria-label="Actualizar avance"
                            onClick={() => { setEditando(o.id); setValor(String(objAvance(o, fuentes))); }}>
                            <Ico name="target" size={15} />
                          </button>
                        )}
                        <button className="row-open" title="Editar objetivo" aria-label="Editar objetivo" onClick={() => onEditar(o)}><Ico name="edit" size={15} /></button>
                        <button className="row-open danger" title="Eliminar objetivo" aria-label="Eliminar objetivo" onClick={() => setBorrando(o.id)}><Ico name="trash" size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!compacta && paginas > 1 && (
        <nav className="obj-paginacion" aria-label="Paginación">
          <button className="btn-ghost sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
            <Ico name="chevL" size={14} />Anterior
          </button>
          <span className="obj-paginas">
            {Array.from({ length: paginas }, (_, i) => i + 1).map((p) => (
              <button key={p} className={"obj-pag" + (p === pagina ? " on" : "")} aria-current={p === pagina ? "page" : undefined}
                onClick={() => setPagina(p)}>{p}</button>
            ))}
          </span>
          <button className="btn-ghost sm" disabled={pagina === paginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente<Ico name="chevR" size={14} />
          </button>
        </nav>
      )}
    </>
  );
}

// ---------- filtros ----------
function ObjFiltros({ f, setF, usuarios, anios, resultados }) {
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const limpiar = () => setF({ area: "Todas", periodicidad: "Todos", estado: "Todos", responsable: "Todos", anio: "Todos", q: "" });
  const activos = ["area", "periodicidad", "estado", "responsable", "anio"].filter((k) => f[k] !== "Todas" && f[k] !== "Todos").length + (f.q ? 1 : 0);
  return (
    <div className="obj-filtros">
      <div className="obj-buscar">
        <Ico name="search" size={16} style={{ color: "var(--muted)" }} />
        <input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Buscar objetivo, responsable o descripción…" aria-label="Buscar objetivos" />
        {f.q && <button className="tb-search-clear" onClick={() => set("q", "")} aria-label="Limpiar búsqueda"><Ico name="close" size={13} /></button>}
      </div>
      <select className="select" value={f.area} onChange={(e) => set("area", e.target.value)} aria-label="Filtrar por área">
        <option value="Todas">Todas las áreas</option>
        {OBJ_AREAS.map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}
      </select>
      <select className="select" value={f.periodicidad} onChange={(e) => set("periodicidad", e.target.value)} aria-label="Filtrar por período">
        <option value="Todos">Todos los períodos</option>
        {OBJ_PERIODOS.map((p) => <option key={p.k} value={p.k}>{p.label}</option>)}
      </select>
      <select className="select" value={f.estado} onChange={(e) => set("estado", e.target.value)} aria-label="Filtrar por estado">
        <option value="Todos">Todos los estados</option>
        {Object.values(OBJ_ESTADOS).map((e2) => <option key={e2.k} value={e2.k}>{e2.label}</option>)}
      </select>
      <select className="select" value={f.responsable} onChange={(e) => set("responsable", e.target.value)} aria-label="Filtrar por responsable">
        <option value="Todos">Todos los responsables</option>
        {(usuarios || []).map((u) => <option key={u.id} value={u.nombre || u.email}>{u.nombre || u.email}</option>)}
      </select>
      <select className="select" value={f.anio} onChange={(e) => set("anio", e.target.value)} aria-label="Filtrar por año">
        <option value="Todos">Todos los años</option>
        {anios.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      {activos > 0 && (
        <button className="btn-ghost sm" onClick={limpiar}>
          <Ico name="close" size={13} />Limpiar ({resultados})
        </button>
      )}
    </div>
  );
}

// ---------- orquestador ----------
function ObjetivosModule({ active, station, query, usuarios, onNav }) {
  const [objetivos, setObjetivos] = React.useState([]);
  const [movs, setMovs] = React.useState([]);
  const [renovaciones, setRenovaciones] = React.useState([]);
  const [cargando, setCargando] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [form, setForm] = React.useState(null);           // null | { item }
  const [toast, setToast] = React.useState(null);
  const [f, setF] = React.useState({ area: "Todas", periodicidad: "Todos", estado: "Todos", responsable: "Todos", anio: "Todos", q: "" });
  const tt = React.useRef(null);
  const topeRef = React.useRef(null);
  const flash = React.useCallback((msg, err) => {
    setToast({ msg, err: !!err, id: Date.now() });
    clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), err ? 4000 : 2600);
  }, []);

  const esTablero = active !== "obj-metas";
  const fuentes = React.useMemo(() => ({ movs, renovaciones }), [movs, renovaciones]);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      if (window.DB && window.DB.configured() && window.DB.obj) {
        try {
          const [objs, ms, rs] = await Promise.all([
            window.DB.obj.list(),
            window.DB.fact ? window.DB.fact.mensual.list().catch(() => []) : Promise.resolve([]),
            window.DB.renov ? window.DB.renov.list().catch(() => []) : Promise.resolve([]),
          ]);
          if (vivo) { setObjetivos(objs); setMovs(ms); setRenovaciones(rs); setUsingDb(true); }
        } catch (e) { console.error("Objetivos:", e); if (vivo) flash("No se pudieron cargar los objetivos", true); }
      }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [flash]);

  React.useEffect(() => {
    if (!usingDb || !window.DB.obj.subscribe) return;
    let t = null, vivo = true;
    const refrescar = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        try { const items = await window.DB.obj.list(); if (vivo) setObjetivos(items); } catch (e) { console.error(e); }
      }, 400);
    };
    const unsub = window.DB.obj.subscribe(refrescar);
    return () => { vivo = false; clearTimeout(t); if (unsub) unsub(); };
  }, [usingDb]);

  const activos = objetivos.filter((o) => !o.eliminado);
  const anios = React.useMemo(() => {
    const s = new Set(activos.map((o) => (o.fechaDesde || "").slice(0, 4)).filter(Boolean));
    s.add(String(new Date().getFullYear()));
    return Array.from(s).sort((a, b) => b - a);
  }, [activos]);

  const lista = React.useMemo(() => {
    const q = ((f.q || "") + " " + (query || "")).trim().toLowerCase();
    return activos.filter((o) => {
      if (f.area !== "Todas" && o.area !== f.area) return false;
      if (f.periodicidad !== "Todos" && o.periodicidad !== f.periodicidad) return false;
      if (f.estado !== "Todos" && objEstado(o, fuentes).k !== f.estado) return false;
      if (f.responsable !== "Todos" && (o.responsable || "") !== f.responsable) return false;
      if (f.anio !== "Todos" && (o.fechaDesde || "").slice(0, 4) !== String(f.anio)) return false;
      if (q && !((o.titulo || "") + " " + (o.descripcion || "") + " " + (o.responsable || "") + " " + objArea(o.area).label).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activos, f, query, fuentes]);

  // ---- guardado ----
  const guardar = async (data) => {
    const d = objDia(data.fechaDesde) || new Date();
    // `mes`/`anio` y `tipo` se siguen escribiendo para que la vista anterior del
    // portal (la que está en producción) siga leyendo estos objetivos sin romperse.
    const compat = {
      mes: data.periodicidad === "anual" ? null : d.getMonth() + 1,
      anio: d.getFullYear(),
      tipo: data.area === "facturacion" && (data.periodicidad === "mensual" || data.periodicidad === "anual") ? "facturacion" : "manual",
    };
    if (data.id) {
      let up = { ...data, ...compat, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
      try { if (usingDb) up = await window.DB.obj.update(up); }
      catch (e) { console.error(e); flash("No se pudo actualizar", true); return; }
      setObjetivos((p) => p.map((o) => (o.id === data.id ? { ...o, ...up } : o)));
      setForm(null); flash("Objetivo actualizado");
      return;
    }
    let n;
    if (usingDb) { try { n = (await window.DB.obj.maxN()) + 1; } catch (e) { n = activos.reduce((m, o) => Math.max(m, o.n || 0), 0) + 1; } }
    else { n = activos.reduce((m, o) => Math.max(m, o.n || 0), 0) + 1; }
    let item = { ...data, ...compat, id: "OBJ-" + String(n).padStart(4, "0"), n, ultimaModPor: station, ultimaModFecha: new Date().toISOString(), eliminado: false };
    try { if (usingDb) item = await window.DB.obj.create(item); }
    catch (e) { console.error(e); flash("No se pudo guardar", true); return; }
    setObjetivos((p) => [item, ...p]);
    setForm(null); flash("Objetivo creado");
  };
  const actualizarAvance = async (o, valor) => {
    const up = { ...o, valorActual: valor, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    setObjetivos((p) => p.map((x) => (x.id === o.id ? up : x)));
    try { if (usingDb) await window.DB.obj.update(up); }
    catch (e) { console.error(e); flash("No se pudo guardar el avance", true); }
  };
  const eliminar = async (o) => {
    try { if (usingDb) await window.DB.obj.remove(o); }
    catch (e) { console.error(e); flash("No se pudo eliminar", true); return; }
    setObjetivos((p) => p.map((x) => (x.id === o.id ? { ...x, eliminado: true } : x)));
    flash("Objetivo eliminado");
  };
  const abrirForm = (item) => {
    setForm({ item: item || null });
    if (topeRef.current) topeRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const barraToast = toast && (
    <div className="toast">
      <span className="toast-ico" style={toast.err ? { background: "#DC2626" } : null}><Ico name={toast.err ? "alert" : "check"} size={15} /></span>
      <span>{toast.msg}</span>
    </div>
  );

  if (cargando) return <ObjSkeleton />;

  if (form) {
    return (<>
      <div ref={topeRef} />
      <ObjetivoForm inicial={form.item} usuarios={usuarios} station={station} fuentes={fuentes}
        objetivos={activos} onCancelar={() => setForm(null)} onGuardar={guardar} />
      {barraToast}
    </>);
  }

  const cabecera = (
    <div className="obj-cab" ref={topeRef}>
      <div className="obj-tabs" role="tablist">
        <button role="tab" aria-selected={esTablero} className={"obj-tab" + (esTablero ? " on" : "")}
          onClick={() => onNav && onNav("obj-panel")}>Tablero</button>
        <button role="tab" aria-selected={!esTablero} className={"obj-tab" + (!esTablero ? " on" : "")}
          onClick={() => onNav && onNav("obj-metas")}>Objetivos<span className="obj-tab-n">{activos.length}</span></button>
      </div>
      <button className="btn-primary" onClick={() => abrirForm(null)}><Ico name="plus" size={17} />Nuevo objetivo</button>
    </div>
  );

  if (!activos.length) {
    return (<>
      {cabecera}
      <ObjVacio titulo="Todavía no hay objetivos"
        sub="Definí una meta de facturación, de ventas o de lo que quieras seguir. El avance de facturación y renovaciones se calcula solo."
        accion={<button className="btn-primary" style={{ marginTop: 14 }} onClick={() => abrirForm(null)}><Ico name="plus" size={16} />Crear el primero</button>} />
      {barraToast}
    </>);
  }

  return (<>
    {cabecera}
    <ObjFiltros f={f} setF={setF} usuarios={usuarios} anios={anios} resultados={lista.length} />

    {esTablero ? (
      <div className="obj-tablero">
        <ObjKpis lista={lista} fuentes={fuentes} />
        <div className="obj-dash-grid">
          <section className="est-card">
            <div className="est-card-head"><div><h3>Cumplimiento por área</h3><p>suma de las metas de cada área</p></div></div>
            <ObjPorArea lista={lista} fuentes={fuentes} onArea={(k) => { setF((p) => ({ ...p, area: k })); onNav && onNav("obj-metas"); }} />
          </section>
          <section className="est-card">
            <div className="est-card-head"><div><h3>Próximos a vencer</h3><p>los que cierran antes</p></div></div>
            <ObjProximos lista={lista} fuentes={fuentes} onAbrir={abrirForm} />
          </section>
        </div>
        <section className="est-card">
          <div className="est-card-head">
            <div><h3>Últimos objetivos</h3><p>los {Math.min(5, lista.length)} más próximos a cerrar</p></div>
            <button className="btn-ghost sm" onClick={() => onNav && onNav("obj-metas")}>Ver todos<Ico name="arrowR" size={14} /></button>
          </div>
          <ObjTabla lista={lista} fuentes={fuentes} compacta onEditar={abrirForm} onEliminar={eliminar} onAvance={actualizarAvance} />
        </section>
      </div>
    ) : (
      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <span className="toolbar-title">Objetivos</span>
            <span className="toolbar-count">{lista.length}</span>
          </div>
        </div>
        <ObjTabla lista={lista} fuentes={fuentes} onEditar={abrirForm} onEliminar={eliminar} onAvance={actualizarAvance} />
      </div>
    )}
    {barraToast}
  </>);
}

Object.assign(window, {
  ObjetivosModule, ObjKpis, ObjPorArea, ObjProximos, ObjTabla, ObjFiltros, ObjBadge, ObjBarra, ObjSkeleton,
});
