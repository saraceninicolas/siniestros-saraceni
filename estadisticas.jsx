// estadisticas.jsx — Saraceni Seguros · Estadísticas de siniestros
// ─────────────────────────────────────────────────────────────────────────────
// Responde la pregunta de Hernán: cuánto demora un caso en promedio, abierto
// por ramo y por hecho (cristales, robo total, daño parcial…).
//
// Cómo se mide la demora (en días HÁBILES, igual que el resto del portal):
//   inicio = fecha de denuncia (si no hay, la del hecho; si no, la de carga)
//   cierre = para los Terminados, la última modificación del caso — es lo más
//            cercano a "cuándo se cerró" que guarda la tabla, porque no hay
//            columna de fecha de cierre. Los casos con fechas incoherentes
//            (cierre anterior al inicio) quedan afuera del promedio.
// Los Abiertos no promedian demora: se muestran aparte como antigüedad.
// ─────────────────────────────────────────────────────────────────────────────

function estInicio(s) {
  const f = s.fechaDenuncia || s.fechaOcurrido || s.creado || "";
  return String(f).slice(0, 10) || null;
}
function estCierre(s) {
  if (s.estado !== "Terminado") return null;
  const f = s.ultimaModFecha || s.creado || "";
  return String(f).slice(0, 10) || null;
}
// Días hábiles que tardó (cerrados) o que lleva abierto (abiertos). null si no se puede calcular.
function estDemora(s) {
  const ini = parseDate(estInicio(s));
  if (!ini) return null;
  const fin = s.estado === "Terminado" ? parseDate(estCierre(s)) : today0();
  if (!fin || fin < ini) return null;
  return diasHabilesEntre(ini, fin);
}
const estProm = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
function estMediana(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
const estDias = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString("es-AR") + " d");
// Año de referencia: el cierre para los terminados, el inicio para los abiertos.
function estAnio(s) {
  const f = s.estado === "Terminado" ? estCierre(s) : estInicio(s);
  return f ? Number(f.slice(0, 4)) : null;
}

// Agrupa los cerrados por una clave y devuelve promedio, mediana y cantidad.
function estAgrupar(cerrados, claveDe) {
  const m = {};
  cerrados.forEach((s) => {
    const k = claveDe(s) || "—";
    (m[k] = m[k] || []).push(s._demora);
  });
  return Object.entries(m).map(([k, ds]) => ({
    clave: k, n: ds.length, prom: estProm(ds), mediana: estMediana(ds),
    min: Math.min(...ds), max: Math.max(...ds),
  })).sort((a, b) => b.prom - a.prom);
}

// ---------- tarjeta contenedora ----------
function EstCard({ title, sub, right, children, className }) {
  return (
    <section className={"est-card" + (className ? " " + className : "")}>
      <div className="est-card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------- matriz ramo × hecho ----------
function EstMatriz({ cerrados }) {
  const ramos = Array.from(new Set(cerrados.map((s) => s.ramo || "—")));
  const hechos = Array.from(new Set(cerrados.map((s) => s.hecho || "—")));
  const celda = {};
  cerrados.forEach((s) => {
    const k = (s.ramo || "—") + "|" + (s.hecho || "—");
    (celda[k] = celda[k] || []).push(s._demora);
  });
  const proms = Object.values(celda).map((ds) => estProm(ds));
  const tope = Math.max(1, ...proms);
  if (!cerrados.length) return <div className="ch-vacio">Sin casos cerrados en el período</div>;
  return (
    <div className="table-wrap">
      <table className="table est-matriz">
        <thead>
          <tr>
            <th style={{ minWidth: 130 }}>Ramo</th>
            {hechos.map((h) => <th key={h} style={{ textAlign: "center" }}>{HECHO_LABEL[h] || h}</th>)}
            <th style={{ textAlign: "center" }}>Todos</th>
          </tr>
        </thead>
        <tbody>
          {ramos.map((r) => {
            const fila = cerrados.filter((s) => (s.ramo || "—") === r).map((s) => s._demora);
            return (
              <tr key={r}>
                <td><b>{RAMO_LABEL[r] || r}</b></td>
                {hechos.map((h) => {
                  const ds = celda[r + "|" + h];
                  if (!ds) return <td key={h} style={{ textAlign: "center" }}><span className="urg-none">—</span></td>;
                  const p = estProm(ds);
                  const alpha = 0.08 + (p / tope) * 0.42;
                  return (
                    <td key={h} style={{ textAlign: "center", background: `rgba(220,38,38,${alpha.toFixed(3)})` }}
                      title={ds.length + (ds.length === 1 ? " caso" : " casos")}>
                      <div className="mono est-celda">{estDias(p)}</div>
                      <div className="est-celda-n">{ds.length}</div>
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", background: "var(--surface-2)" }}>
                  <div className="mono est-celda"><b>{estDias(estProm(fila))}</b></div>
                  <div className="est-celda-n">{fila.length}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- pantalla ----------
function EstadisticasSiniestros({ data }) {
  const [anioF, setAnioF] = React.useState("Todos");

  const conDemora = React.useMemo(
    () => (data || []).map((s) => ({ ...s, _demora: estDemora(s), _anio: estAnio(s) })).filter((s) => s._demora != null),
    [data]);
  const anios = React.useMemo(
    () => Array.from(new Set(conDemora.map((s) => s._anio).filter(Boolean))).sort((a, b) => b - a),
    [conDemora]);
  const enPeriodo = React.useMemo(
    () => (anioF === "Todos" ? conDemora : conDemora.filter((s) => String(s._anio) === String(anioF))),
    [conDemora, anioF]);

  const cerrados = enPeriodo.filter((s) => s.estado === "Terminado");
  const abiertos = enPeriodo.filter((s) => s.estado !== "Terminado");
  const ds = cerrados.map((s) => s._demora);
  const prom = estProm(ds), med = estMediana(ds);
  const masLargo = cerrados.reduce((a, b) => (!a || b._demora > a._demora ? b : a), null);
  const masCorto = cerrados.reduce((a, b) => (!a || b._demora < a._demora ? b : a), null);
  const promAbiertos = estProm(abiertos.map((s) => s._demora));

  const porRamo = estAgrupar(cerrados, (s) => s.ramo);
  const porHecho = estAgrupar(cerrados, (s) => s.hecho);
  const porCia = estAgrupar(cerrados, (s) => s.cia);

  // cierres por mes de los últimos 12 meses con su demora promedio
  const evolucion = React.useMemo(() => {
    const hoy = new Date();
    const cols = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      const del = cerrados.filter((s) => (estCierre(s) || "").slice(0, 7) === key);
      cols.push({
        label: MESES[d.getMonth()].charAt(0).toUpperCase() + MESES[d.getMonth()].slice(1),
        valores: [estProm(del.map((x) => x._demora)) || 0],
        n: del.length,
      });
    }
    return cols;
  }, [cerrados]);

  const kpis = [
    { label: "Demora promedio", value: estDias(prom), hint: cerrados.length + (cerrados.length === 1 ? " caso cerrado" : " casos cerrados"), tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "clock" },
    { label: "Mediana", value: estDias(med), hint: "la mitad tarda menos que esto", tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "target" },
    { label: "Caso más demorado", value: estDias(masLargo && masLargo._demora), hint: masLargo ? `${masLargo.cliente} · ${HECHO_LABEL[masLargo.hecho] || masLargo.hecho || "—"}` : "—", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "alert" },
    { label: "Abiertos hoy", value: abiertos.length, hint: "antigüedad promedio " + estDias(promAbiertos), tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "folder" },
  ];

  return (
    <div className="est-wrap">
      <div className="kpis">
        {kpis.map((c) => (
          <div className="kpi" key={c.label}>
            <span className="kpi-stripe" style={{ background: c.tone.fg }} />
            <div className="kpi-top"><span className="kpi-ico" style={{ background: c.tone.bg, color: c.tone.fg }}><Ico name={c.icon} size={17} /></span><span className="kpi-label">{c.label}</span></div>
            <div className="kpi-mid"><span className="kpi-value" style={{ fontSize: 24 }}>{c.value}</span></div>
            <div className="kpi-foot"><span className="kpi-hint">{c.hint}</span></div>
          </div>
        ))}
      </div>

      <div className="est-bar">
        <div className="est-bar-txt">
          <Ico name="info" size={15} />
          <span>Demora en <b>días hábiles</b>, desde la denuncia hasta el cierre del caso. El cierre se toma de la última modificación (la tabla no guarda fecha de cierre propia).</span>
        </div>
        <select className="select" value={anioF} onChange={(e) => setAnioF(e.target.value)}>
          <option value="Todos">Todos los años</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="est-grid">
        <EstCard title="Demora promedio por ramo" sub="ordenado de mayor a menor">
          <ChBarrasH rows={porRamo.map((g) => ({
            label: RAMO_LABEL[g.clave] || g.clave,
            valor: g.prom,
            texto: estDias(g.prom),
            sub: `${g.n} ${g.n === 1 ? "caso" : "casos"} · mediana ${estDias(g.mediana)} · del más rápido (${estDias(g.min)}) al más lento (${estDias(g.max)})`,
            color: CH_COLOR.azul,
          }))} vacio="Todavía no hay casos cerrados para promediar" />
        </EstCard>

        <EstCard title="Demora promedio por hecho" sub="cristales, robo total, daño parcial…">
          <ChBarrasH rows={porHecho.map((g) => ({
            label: HECHO_LABEL[g.clave] || g.clave,
            valor: g.prom,
            texto: estDias(g.prom),
            sub: `${g.n} ${g.n === 1 ? "caso" : "casos"} · mediana ${estDias(g.mediana)} · del más rápido (${estDias(g.min)}) al más lento (${estDias(g.max)})`,
            color: hechoColor(g.clave).fg,
          }))} vacio="Todavía no hay casos cerrados para promediar" />
        </EstCard>

        <EstCard title="Ramo × hecho" sub="promedio de días hábiles y cantidad de casos en cada cruce" className="est-card-wide">
          <EstMatriz cerrados={cerrados} />
        </EstCard>

        <EstCard title="Demora promedio por compañía" sub="cuánto tarda cada una en cerrar">
          <ChBarrasH rows={porCia.map((g) => ({
            label: ciaLabel(g.clave),
            valor: g.prom,
            texto: estDias(g.prom),
            sub: `${g.n} ${g.n === 1 ? "caso cerrado" : "casos cerrados"} · mediana ${estDias(g.mediana)}`,
            color: CH_COLOR.violeta,
          }))} vacio="Todavía no hay casos cerrados para promediar" />
        </EstCard>

        <EstCard title="Evolución de la demora" sub="promedio de los casos cerrados en cada mes (últimos 12)">
          <ChBarras data={evolucion} series={[{ nombre: "Días hábiles", color: CH_COLOR.celeste }]}
            fmtEje={(v) => Math.round(v) + " d"} fmtValor={(v) => estDias(v)} alto={230} />
          <div className="est-evol-pie">
            {evolucion.reduce((s, c) => s + c.n, 0)} casos cerrados en los últimos 12 meses
          </div>
        </EstCard>

        <EstCard title="Los que más tardaron" sub="para revisar qué los trabó" className="est-card-wide">
          {cerrados.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Cliente</th><th>Compañía</th><th>Ramo / Hecho</th><th>Denuncia</th><th>Cierre</th><th style={{ textAlign: "right" }}>Demora</th></tr></thead>
                <tbody>
                  {[...cerrados].sort((a, b) => b._demora - a._demora).slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td><div className="cell-strong">{s.cliente}</div><div className="cell-sub mono">{s.nroSiniestro || s.id}</div></td>
                      <td><span className="cia-pill">{ciaLabel(s.cia)}</span></td>
                      <td><RamoTag ramo={s.ramo} hecho={s.hecho} /></td>
                      <td className="mono cell-sub">{fmtDateShort(estInicio(s))}</td>
                      <td className="mono cell-sub">{fmtDateShort(estCierre(s))}</td>
                      <td style={{ textAlign: "right" }}><b className="mono">{estDias(s._demora)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="ch-vacio">Sin casos cerrados en el período</div>}
        </EstCard>
      </div>
    </div>
  );
}

Object.assign(window, { EstadisticasSiniestros, estDemora, estInicio, estCierre });
