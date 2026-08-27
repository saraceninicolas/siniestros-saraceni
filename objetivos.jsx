// objetivos.jsx — Saraceni Seguros · Objetivos
// ─────────────────────────────────────────────────────────────────────────────
// Reescrito: antes se cargaba con un modal de campos, igual que un siniestro, y
// se sentía pesado para algo que es una sola frase ("facturar X en agosto").
// Ahora la carga es un CONSTRUCTOR en línea de tres pasos (qué / cuándo /
// cuánto) que arma la frase a la vista, sin modal, y las metas se muestran como
// filas con anillo de avance, edición en el lugar y ritmo del período.
//
// Tipo "facturacion": el avance sale solo de `fact_mensual` (módulo Facturación).
// Tipo "manual": el avance se sube a mano con el stepper de la propia fila.
// ─────────────────────────────────────────────────────────────────────────────

const MES_OBJ = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MES_OBJ_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ARS_OBJ = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// Atajos de carga: cada uno define qué se mide y con qué unidad.
const OBJ_PRESETS = [
  { k: "fact-mes", label: "Facturación del mes", icon: "doc", tipo: "facturacion", unidad: "$", anual: false },
  { k: "fact-anio", label: "Facturación del año", icon: "target", tipo: "facturacion", unidad: "$", anual: true },
  { k: "polizas", label: "Pólizas nuevas", icon: "folder", tipo: "manual", unidad: "pólizas", anual: false },
  { k: "clientes", label: "Clientes nuevos", icon: "user", tipo: "manual", unidad: "clientes", anual: false },
  { k: "renovaciones", label: "Renovaciones", icon: "refresh", tipo: "manual", unidad: "renovaciones", anual: false },
  { k: "otro", label: "Otro objetivo", icon: "flag", tipo: "manual", unidad: "", anual: false },
];
const presetDe = (k) => OBJ_PRESETS.find((p) => p.k === k) || OBJ_PRESETS[0];

const objNum = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace(/[$\s.]/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};
function objPeriodo(o) { return o.mes ? `${MES_OBJ[o.mes]} ${o.anio}` : `Año ${o.anio}`; }
function objEsPlata(o) { return !o.unidad || o.unidad === "$"; }
function objFmt(o, v) {
  if (objEsPlata(o)) return ARS_OBJ.format(v || 0);
  return (Math.round((v || 0) * 100) / 100).toLocaleString("es-AR") + (o.unidad ? " " + o.unidad : "");
}
// Avance real: automático desde facturación, o el valor cargado a mano.
function objActual(o, movs) {
  if (o.tipo === "facturacion") {
    return (movs || [])
      .filter((m) => Number(m.anio) === Number(o.anio) && (o.mes ? Number(m.mes) === Number(o.mes) : true))
      .reduce((s, m) => s + (Number(m.total) || 0), 0);
  }
  return Number(o.valorActual) || 0;
}
function objPct(o, movs) {
  const meta = Number(o.meta) || 0;
  if (!meta) return 0;
  return Math.round((objActual(o, movs) / meta) * 1000) / 10;
}
// Cuánto del período ya pasó (para saber si vamos a tiempo). null si no es el período en curso.
function objRitmo(o) {
  const hoy = new Date();
  if (o.mes) {
    if (Number(o.anio) !== hoy.getFullYear() || Number(o.mes) !== hoy.getMonth() + 1) return null;
    return (hoy.getDate() / new Date(o.anio, o.mes, 0).getDate()) * 100;
  }
  if (Number(o.anio) !== hoy.getFullYear()) return null;
  const ini = new Date(hoy.getFullYear(), 0, 1), fin = new Date(hoy.getFullYear() + 1, 0, 1);
  return ((hoy - ini) / (fin - ini)) * 100;
}
// El período ya terminó (sirve para marcar los que quedaron sin cumplir)
function objCerrado(o) {
  const hoy = new Date();
  if (Number(o.anio) < hoy.getFullYear()) return true;
  if (Number(o.anio) > hoy.getFullYear()) return false;
  return !!o.mes && Number(o.mes) < hoy.getMonth() + 1;
}
function objTono(o, movs) {
  const pct = objPct(o, movs);
  if (pct >= 100) return { k: "cumplido", label: "Cumplido", color: "#16A34A", bg: "#E6F4EA", fg: "#15803D" };
  if (objCerrado(o)) return { k: "vencido", label: "Sin cumplir", color: "#DC2626", bg: "#FBE3E3", fg: "#C0241D" };
  const ritmo = objRitmo(o);
  if (ritmo != null && pct < ritmo - 10) return { k: "atrasado", label: "Atrasado", color: "#EA580C", bg: "#FEF3E2", fg: "#B45309" };
  return { k: "curso", label: "En curso", color: "#2563EB", bg: "#E8F0FE", fg: "#1D4ED8" };
}

// ---------- constructor (la carga, en línea y sin modal) ----------
function ObjConstructor({ movs, editando, onCancelar, onGuardar }) {
  const hoy = new Date();
  const inicial = () => {
    if (editando) {
      const pk = editando.tipo === "facturacion" ? (editando.mes ? "fact-mes" : "fact-anio")
        : OBJ_PRESETS.find((p) => p.unidad && p.unidad === editando.unidad && p.tipo === "manual")?.k || "otro";
      return { preset: pk, titulo: editando.titulo || "", mes: editando.mes || "", anio: editando.anio || hoy.getFullYear(), meta: editando.meta || "", unidad: editando.unidad || "", notas: editando.notas || "" };
    }
    return { preset: "fact-mes", titulo: "", mes: hoy.getMonth() + 1, anio: hoy.getFullYear(), meta: "", unidad: "$", notas: "" };
  };
  const [f, setF] = React.useState(inicial);
  React.useEffect(() => { setF(inicial()); }, [editando && editando.id]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const p = presetDe(f.preset);
  const esPlata = !f.unidad || f.unidad === "$";

  const elegirPreset = (k) => {
    const np = presetDe(k);
    setF((prev) => ({
      ...prev, preset: k, unidad: np.unidad,
      mes: np.anual ? "" : (prev.mes || hoy.getMonth() + 1),
    }));
  };

  // Título automático si no se escribe uno
  const periodoTxt = f.mes ? `${MES_OBJ[f.mes]} ${f.anio}` : `${f.anio}`;
  const tituloAuto = p.k === "fact-mes" ? `Facturación de ${periodoTxt}`
    : p.k === "fact-anio" ? `Facturación ${f.anio}`
    : p.k === "otro" ? "" : `${p.label} · ${periodoTxt}`;
  const titulo = (f.titulo || "").trim() || tituloAuto;

  // Sugerencias de monto: lo que se facturó en el mismo período anterior
  const facturadoDe = (anio, mes) => (movs || [])
    .filter((m) => Number(m.anio) === Number(anio) && (mes ? Number(m.mes) === Number(mes) : true))
    .reduce((s, m) => s + (Number(m.total) || 0), 0);
  const base = React.useMemo(() => {
    if (p.tipo !== "facturacion") return 0;
    if (!f.mes) return facturadoDe(Number(f.anio) - 1, null);
    const ant = Number(f.mes) === 1 ? { a: Number(f.anio) - 1, m: 12 } : { a: Number(f.anio), m: Number(f.mes) - 1 };
    return facturadoDe(ant.a, ant.m);
  }, [movs, f.anio, f.mes, p.tipo]);
  const sugerencias = p.tipo === "facturacion" && base > 0
    ? [{ l: "Igual al período anterior", v: base }, { l: "+10%", v: base * 1.1 }, { l: "+20%", v: base * 1.2 }, { l: "+30%", v: base * 1.3 }]
    : [];
  const sugerenciasManual = p.tipo !== "facturacion" ? [5, 10, 20, 50] : [];

  const metaNum = objNum(f.meta);
  const valido = !!titulo && metaNum > 0 && f.anio;
  const frase = valido
    ? (p.tipo === "facturacion" ? "Facturar " : "Llegar a ") +
      (esPlata ? ARS_OBJ.format(metaNum) : metaNum.toLocaleString("es-AR") + (f.unidad ? " " + f.unidad : "")) +
      (f.mes ? ` en ${MES_OBJ[f.mes]} ${f.anio}` : ` durante ${f.anio}`)
    : "Elegí qué, cuándo y cuánto para armar el objetivo.";

  const anios = [];
  for (let a = hoy.getFullYear() + 1; a >= 2025; a--) anios.push(a);

  return (
    <div className={"obj-const" + (editando ? " editando" : "")}>
      <div className="obj-const-head">
        <span className="obj-const-tag"><Ico name={editando ? "edit" : "plus"} size={15} />{editando ? "Editando objetivo" : "Nuevo objetivo"}</span>
        <button className="btn-ghost sm" onClick={onCancelar}><Ico name="close" size={14} />Cerrar</button>
      </div>

      <div className="obj-paso">
        <span className="obj-paso-n">1</span>
        <div className="obj-paso-body">
          <span className="obj-paso-t">¿Qué querés lograr?</span>
          <div className="obj-chips">
            {OBJ_PRESETS.map((op) => (
              <button key={op.k} className={"obj-chip" + (f.preset === op.k ? " on" : "")} onClick={() => elegirPreset(op.k)}>
                <Ico name={op.icon} size={15} />{op.label}
              </button>
            ))}
          </div>
          <div className="obj-paso-extra">
            <input className="input" value={f.titulo} onChange={(e) => set("titulo", e.target.value)}
              placeholder={tituloAuto ? `Nombre (por defecto: ${tituloAuto})` : "Ponele un nombre al objetivo"} />
            {p.tipo === "manual" && f.preset === "otro" && (
              <input className="input obj-unidad" value={f.unidad} onChange={(e) => set("unidad", e.target.value)}
                placeholder="Unidad: $, pólizas, clientes…" />
            )}
          </div>
        </div>
      </div>

      <div className="obj-paso">
        <span className="obj-paso-n">2</span>
        <div className="obj-paso-body">
          <span className="obj-paso-t">¿Para cuándo?</span>
          <div className="obj-periodo-sel">
            <div className="fact-mes-pills">
              {MES_OBJ_CORTO.map((m, i) => (
                <button key={m} className={"fact-mes-pill" + (Number(f.mes) === i + 1 ? " on" : "")} onClick={() => set("mes", i + 1)}>{m}</button>
              ))}
              <button className={"fact-mes-pill ancho" + (!f.mes ? " on" : "")} onClick={() => set("mes", "")}>Todo el año</button>
            </div>
            <select className="select" value={f.anio} onChange={(e) => set("anio", Number(e.target.value))}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="obj-paso">
        <span className="obj-paso-n">3</span>
        <div className="obj-paso-body">
          <span className="obj-paso-t">¿Cuánto?</span>
          <div className="obj-monto-row">
            <div className="obj-monto">
              {esPlata && <span className="obj-monto-signo">$</span>}
              <input className="input mono obj-monto-input" inputMode="decimal" value={f.meta}
                onChange={(e) => set("meta", e.target.value)} placeholder="0" />
              {!esPlata && f.unidad && <span className="obj-monto-unidad">{f.unidad}</span>}
            </div>
            {sugerencias.map((s) => (
              <button key={s.l} className="obj-sug" onClick={() => set("meta", String(Math.round(s.v)))}>
                <b>{s.l}</b><span className="mono">{ARS_OBJ.format(Math.round(s.v))}</span>
              </button>
            ))}
            {sugerenciasManual.map((n) => (
              <button key={n} className="obj-sug chico" onClick={() => set("meta", String(n))}><b>{n}</b></button>
            ))}
          </div>
          {p.tipo === "facturacion" && (
            <div className="obj-nota-auto"><Ico name="info" size={14} />El avance se calcula solo, sumando lo cargado en Facturación para ese período{base > 0 ? ` (el período anterior cerró en ${ARS_OBJ.format(Math.round(base))})` : ""}.</div>
          )}
        </div>
      </div>

      <div className="obj-const-foot">
        <span className={"obj-frase" + (valido ? " ok" : "")}>{frase}</span>
        <div className="foot-btns">
          <button className="btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button className="btn-primary" disabled={!valido}
            onClick={() => onGuardar({
              ...(editando || {}),
              titulo, tipo: p.tipo, mes: f.mes === "" ? null : Number(f.mes), anio: Number(f.anio),
              meta: metaNum, unidad: f.unidad || "$", notas: f.notas || "",
            })}>
            <Ico name="check" size={16} />{editando ? "Guardar cambios" : "Crear objetivo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- fila de meta ----------
function ObjFila({ o, movs, onEditar, onGuardarRapido, onEliminar }) {
  const [editMeta, setEditMeta] = React.useState(null);
  const [editAvance, setEditAvance] = React.useState(null);
  const [confirmar, setConfirmar] = React.useState(false);
  const actual = objActual(o, movs);
  const pct = objPct(o, movs);
  const tono = objTono(o, movs);
  const ritmo = objRitmo(o);
  const falta = Math.max(0, (Number(o.meta) || 0) - actual);
  const paso = objEsPlata(o) ? Math.max(1000, Math.round((Number(o.meta) || 0) / 20)) : 1;

  const desvio = ritmo == null ? null : Math.round(pct - ritmo);
  const cuando = o.mes ? `para el día ${new Date().getDate()} del mes` : "para esta altura del año";
  const pie = pct >= 100
    ? "Meta alcanzada" + (actual > (Number(o.meta) || 0) ? ` · ${objFmt(o, actual - (Number(o.meta) || 0))} por encima` : "")
    : ritmo != null
      ? `Falta ${objFmt(o, falta)} · va ${Math.abs(desvio)}% ${desvio >= 0 ? "adelantado" : "atrasado"} ${cuando}`
      : `Falta ${objFmt(o, falta)}`;

  return (
    <div className={"obj-fila " + tono.k}>
      <div className="obj-fila-anillo">
        <ChAnillo pct={pct} color={tono.color} size={74} grosor={9} texto={Math.round(pct) + "%"} />
      </div>
      <div className="obj-fila-body">
        <div className="obj-fila-top">
          <span className="obj-fila-titulo">{o.titulo}</span>
          <span className="obj-fila-chip">{objPeriodo(o)}</span>
          <span className="obj-fila-chip suave">{o.tipo === "facturacion" ? "Automático" : "Manual"}</span>
          <span className="badge" style={{ background: tono.bg, color: tono.fg, fontSize: 11.5 }}>{tono.label}</span>
        </div>

        <div className="obj-fila-nums">
          <span className="obj-fila-actual">{objFmt(o, actual)}</span>
          <span className="obj-fila-de">de</span>
          {editMeta == null ? (
            <button className="obj-fila-meta" title="Clic para cambiar la meta" onClick={() => setEditMeta(String(o.meta || ""))}>
              {objFmt(o, Number(o.meta) || 0)}<Ico name="edit" size={13} />
            </button>
          ) : (
            <span className="obj-inline">
              <input className="input sm mono" autoFocus value={editMeta} inputMode="decimal"
                onChange={(e) => setEditMeta(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { onGuardarRapido({ ...o, meta: objNum(editMeta) }); setEditMeta(null); } if (e.key === "Escape") setEditMeta(null); }} />
              <button className="row-open ok" title="Guardar" onClick={() => { onGuardarRapido({ ...o, meta: objNum(editMeta) }); setEditMeta(null); }}><Ico name="check" size={15} /></button>
              <button className="row-open" title="Cancelar" onClick={() => setEditMeta(null)}><Ico name="close" size={15} /></button>
            </span>
          )}
        </div>

        <div className="obj-fila-barra">
          <span style={{ width: Math.min(100, Math.max(0, pct)) + "%", background: tono.color }} />
          {ritmo != null && pct < 100 && <i className="obj-fila-ritmo" style={{ left: Math.min(100, ritmo) + "%" }} title={`Ritmo esperado: ${Math.round(ritmo)}%`} />}
        </div>

        <div className="obj-fila-pie">
          <span>{pie}</span>
          {o.notas && <span className="obj-fila-nota">· {o.notas}</span>}
        </div>

        {o.tipo === "manual" && (
          <div className="obj-avance">
            <span className="obj-avance-l">Avance</span>
            <button className="obj-step" onClick={() => onGuardarRapido({ ...o, valorActual: Math.max(0, actual - paso) })}>−</button>
            {editAvance == null ? (
              <button className="obj-avance-v mono" title="Clic para escribir el valor" onClick={() => setEditAvance(String(actual))}>{objFmt(o, actual)}</button>
            ) : (
              <span className="obj-inline">
                <input className="input sm mono" autoFocus value={editAvance} inputMode="decimal"
                  onChange={(e) => setEditAvance(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { onGuardarRapido({ ...o, valorActual: objNum(editAvance) }); setEditAvance(null); } if (e.key === "Escape") setEditAvance(null); }} />
                <button className="row-open ok" onClick={() => { onGuardarRapido({ ...o, valorActual: objNum(editAvance) }); setEditAvance(null); }}><Ico name="check" size={15} /></button>
              </span>
            )}
            <button className="obj-step" onClick={() => onGuardarRapido({ ...o, valorActual: actual + paso })}>+</button>
          </div>
        )}
      </div>

      <div className="obj-fila-acciones">
        {confirmar ? (
          <div className="obj-confirm">
            <span>¿Eliminar?</span>
            <button className="btn-danger sm" onClick={() => onEliminar(o)}>Sí</button>
            <button className="btn-ghost sm" onClick={() => setConfirmar(false)}>No</button>
          </div>
        ) : (
          <>
            <button className="row-open" title="Editar el objetivo" onClick={() => onEditar(o)}><Ico name="edit" size={15} /></button>
            <button className="row-open danger" title="Eliminar" onClick={() => setConfirmar(true)}><Ico name="trash" size={15} /></button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- panel de control ----------
function ObjPanel({ objetivos, movs, anio, onAnio, anios }) {
  const delAnio = objetivos.filter((o) => Number(o.anio) === Number(anio));
  const cumplidos = delAnio.filter((o) => objPct(o, movs) >= 100);
  const atrasados = delAnio.filter((o) => objTono(o, movs).k === "atrasado");
  const vencidos = delAnio.filter((o) => objTono(o, movs).k === "vencido");
  const promedio = delAnio.length
    ? Math.round(delAnio.reduce((s, o) => s + Math.min(100, objPct(o, movs)), 0) / delAnio.length)
    : 0;

  // facturación real del año contra las metas mensuales cargadas
  const metaMes = {};
  delAnio.filter((o) => o.tipo === "facturacion" && o.mes).forEach((o) => {
    metaMes[o.mes] = (metaMes[o.mes] || 0) + (Number(o.meta) || 0);
  });
  const data = MES_OBJ_CORTO.map((m, i) => ({
    label: m,
    valores: [(movs || []).filter((x) => Number(x.anio) === Number(anio) && Number(x.mes) === i + 1).reduce((s, x) => s + (Number(x.total) || 0), 0)],
  }));
  const marcas = MES_OBJ_CORTO.map((_, i) => metaMes[i + 1] || null);
  const hayMetasFact = Object.keys(metaMes).length > 0;

  const orden = [...delAnio].sort((a, b) => objPct(b, movs) - objPct(a, movs));

  return (
    <div className="obj-panel">
      <div className="obj-hero">
        <div className="obj-hero-anillo">
          <ChAnillo pct={promedio} size={132} grosor={14} color={promedio >= 80 ? "#16A34A" : promedio >= 50 ? "#2563EB" : "#EA580C"} />
        </div>
        <div className="obj-hero-txt">
          <span className="obj-hero-k">Avance promedio {anio}</span>
          <h2>{promedio}% de las metas del año</h2>
          <p>{delAnio.length} {delAnio.length === 1 ? "objetivo cargado" : "objetivos cargados"} · {cumplidos.length} cumplidos · {atrasados.length} atrasados · {vencidos.length} sin cumplir</p>
        </div>
        <div className="obj-hero-mini">
          {[
            { l: "Cumplidos", v: cumplidos.length, c: "#16A34A" },
            { l: "En curso", v: Math.max(0, delAnio.length - cumplidos.length - vencidos.length - atrasados.length), c: "#2563EB" },
            { l: "Atrasados", v: atrasados.length, c: "#EA580C" },
            { l: "Sin cumplir", v: vencidos.length, c: "#DC2626" },
          ].map((x) => (
            <div className="obj-hero-mini-item" key={x.l}>
              <span className="obj-hero-mini-v" style={{ color: x.c }}>{x.v}</span>
              <span className="obj-hero-mini-l">{x.l}</span>
            </div>
          ))}
        </div>
        <select className="select obj-hero-anio" value={anio} onChange={(e) => onAnio(Number(e.target.value))}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <section className="est-card">
        <div className="est-card-head">
          <div>
            <h3>Facturación real contra la meta</h3>
            <p>{hayMetasFact ? "la línea punteada es la meta cargada para ese mes" : "todavía no hay metas de facturación por mes en " + anio}</p>
          </div>
        </div>
        <ChBarras data={data} series={[{ nombre: "Facturado", color: CH_COLOR.azul }]}
          marcas={hayMetasFact ? marcas : null} fmtEje={(v) => (v >= 1000000 ? "$" + (v / 1000000).toFixed(1).replace(".", ",") + "M" : v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + v)}
          fmtValor={(v) => ARS_OBJ.format(Math.round(v))} alto={250} />
      </section>

      <section className="est-card">
        <div className="est-card-head"><div><h3>Todas las metas de {anio}</h3><p>ordenadas por avance</p></div></div>
        {orden.length ? (
          <div className="obj-mini-list">
            {orden.map((o) => {
              const t = objTono(o, movs);
              const pct = objPct(o, movs);
              return (
                <div className="obj-mini" key={o.id}>
                  <span className="obj-mini-t">{o.titulo}</span>
                  <span className="obj-mini-p">{objPeriodo(o)}</span>
                  <span className="obj-mini-bar"><span style={{ width: Math.min(100, pct) + "%", background: t.color }} /></span>
                  <span className="obj-mini-pct mono" style={{ color: t.color }}>{Math.round(pct)}%</span>
                  <span className="obj-mini-v mono">{objFmt(o, objActual(o, movs))} / {objFmt(o, Number(o.meta) || 0)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ch-vacio">No hay objetivos cargados para {anio}. Creálos en “Metas y seguimiento”.</div>
        )}
      </section>
    </div>
  );
}

// ---------- orquestador ----------
function ObjetivosModule({ active, station, query }) {
  const hoy = new Date();
  const [objetivos, setObjetivos] = React.useState([]);
  const [movs, setMovs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [usingDb, setUsingDb] = React.useState(false);
  const [anio, setAnio] = React.useState(hoy.getFullYear());
  const [filtro, setFiltro] = React.useState("Todos");
  const [constructor, setConstructor] = React.useState(null); // null | {editando}
  const [toast, setToast] = React.useState(null);
  const tt = React.useRef(null);
  const topRef = React.useRef(null);   // para volver arriba al editar (el scroll lo tiene .content, no window)
  const flash = React.useCallback((msg) => { setToast({ msg, id: Date.now() }); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 2600); }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (window.DB && window.DB.configured() && window.DB.obj) {
        try {
          // Los objetivos de facturación se calculan con `fact_mensual`, la misma
          // tabla que usa el módulo de Facturación.
          const [objs, ms] = await Promise.all([
            window.DB.obj.list(),
            window.DB.fact ? window.DB.fact.mensual.list().catch(() => []) : Promise.resolve([]),
          ]);
          if (alive) { setObjetivos(objs); setMovs(ms); setUsingDb(true); }
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
  const anios = React.useMemo(() => {
    const s = new Set(activos.map((o) => Number(o.anio)));
    s.add(hoy.getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [activos]);

  const lista = React.useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    return activos.filter((o) => {
      if (q && !((o.titulo || "") + " " + (o.notas || "")).toLowerCase().includes(q)) return false;
      if (filtro === "Todos") return true;
      const k = objTono(o, movs).k;
      if (filtro === "En curso") return k === "curso" || k === "atrasado";
      if (filtro === "Cumplidos") return k === "cumplido";
      if (filtro === "Atrasados") return k === "atrasado" || k === "vencido";
      return true;
    }).sort((a, b) => (b.anio - a.anio) || ((a.mes || 13) - (b.mes || 13)) || (objPct(b, movs) - objPct(a, movs)));
  }, [activos, query, filtro, movs]);

  const guardar = async (data) => {
    if (data.id) {
      let updated = { ...data, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
      try { if (usingDb) updated = await window.DB.obj.update(updated); }
      catch (e) { console.error(e); flash("Error al actualizar"); return; }
      setObjetivos((p) => p.map((o) => (o.id === data.id ? { ...o, ...updated } : o)));
      setConstructor(null); flash("Objetivo actualizado");
      return;
    }
    let n;
    if (usingDb) { try { n = (await window.DB.obj.maxN()) + 1; } catch (e) { n = activos.reduce((m, o) => Math.max(m, o.n || 0), 0) + 1; } }
    else { n = activos.reduce((m, o) => Math.max(m, o.n || 0), 0) + 1; }
    let item = { ...data, id: "OBJ-" + String(n).padStart(4, "0"), n, ultimaModPor: station, ultimaModFecha: new Date().toISOString(), eliminado: false };
    try { if (usingDb) item = await window.DB.obj.create(item); }
    catch (e) { console.error(e); flash("Error al guardar"); return; }
    setObjetivos((p) => [item, ...p]); setConstructor(null); flash("Objetivo creado");
  };
  // Guardado rápido desde la propia fila (meta o avance), sin abrir nada
  const guardarRapido = async (data) => {
    let updated = { ...data, ultimaModPor: station, ultimaModFecha: new Date().toISOString() };
    setObjetivos((p) => p.map((o) => (o.id === data.id ? { ...o, ...updated } : o)));
    try { if (usingDb) updated = await window.DB.obj.update(updated); }
    catch (e) { console.error(e); flash("No se pudo guardar el cambio"); return; }
    setObjetivos((p) => p.map((o) => (o.id === data.id ? { ...o, ...updated } : o)));
  };
  const eliminar = async (item) => {
    try { if (usingDb) await window.DB.obj.remove(item); }
    catch (e) { console.error(e); flash("Error al eliminar"); return; }
    setObjetivos((p) => p.map((o) => (o.id === item.id ? { ...o, eliminado: true } : o)));
    flash("Objetivo eliminado");
  };

  if (loading) return <div className="boot"><div className="boot-inner"><div className="boot-spin" />Cargando objetivos…</div></div>;

  if (active === "obj-panel") {
    return (<>
      <ObjPanel objetivos={activos} movs={movs} anio={anio} onAnio={setAnio} anios={anios} />
      {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
    </>);
  }

  return (<>
    <div className="obj-metas" ref={topRef}>
      <div className="obj-metas-head">
        <div className="obj-metas-titulo">
          <h2>Metas y seguimiento</h2>
          <span>{lista.length} {lista.length === 1 ? "objetivo" : "objetivos"}</span>
        </div>
        <div className="obj-metas-tools">
          <div className="seg">
            {["Todos", "En curso", "Cumplidos", "Atrasados"].map((s) => (
              <button key={s} className={"seg-btn" + (filtro === s ? " is-on" : "")} onClick={() => setFiltro(s)}>{s}</button>
            ))}
          </div>
          <button className="btn-primary" disabled={!!constructor && !constructor.editando}
            onClick={() => setConstructor({ editando: null })}><Ico name="plus" size={17} />Nuevo objetivo</button>
        </div>
      </div>

      {constructor && (
        <ObjConstructor movs={movs} editando={constructor.editando}
          onCancelar={() => setConstructor(null)} onGuardar={guardar} />
      )}

      {lista.length ? (
        <div className="obj-lista">
          {lista.map((o) => (
            <ObjFila key={o.id} o={o} movs={movs}
              onEditar={(x) => { setConstructor({ editando: x }); if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              onGuardarRapido={guardarRapido} onEliminar={eliminar} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-ico"><Ico name="target" size={26} /></div>
          <div className="empty-title">{activos.length ? "Ningún objetivo con ese filtro" : "Todavía no hay objetivos"}</div>
          <div className="empty-sub">{activos.length ? "Probá con otro filtro o limpiá la búsqueda." : "Tocá “Nuevo objetivo”: elegís qué, cuándo y cuánto, y listo."}</div>
        </div>
      )}
    </div>
    {toast && <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>}
  </>);
}

Object.assign(window, { ObjetivosModule, ObjPanel, ObjConstructor, ObjFila, objActual, objPct, objPeriodo });
