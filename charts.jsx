// charts.jsx — Saraceni Seguros · gráficos hechos a mano en SVG
// ─────────────────────────────────────────────────────────────────────────────
// El portal no tiene build ni dependencias, así que no se puede usar una
// librería de gráficos: cada uno es un <svg> dibujado acá. Todos escalan solos
// con viewBox, por eso se ven bien en el celular sin cálculos de ancho.
// Los usan Estadísticas de siniestros, Facturación y Objetivos.
// ─────────────────────────────────────────────────────────────────────────────

const CH_COLOR = {
  azul: "#2563EB", verde: "#16A34A", ambar: "#F59E0B", naranja: "#EA580C",
  rojo: "#DC2626", violeta: "#7C3AED", celeste: "#0891B2", gris: "#94A3B8",
};

// Escala "redonda" para el eje: elige un paso de 1/2/2,5/5 × 10ⁿ que cubra el máximo.
function chEje(max, divisiones = 4) {
  if (!(max > 0)) return { top: 1, steps: [0, 1] };
  const crudo = max / divisiones;
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const norm = crudo / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / paso) * paso;
  const steps = [];
  for (let v = 0; v <= top + paso / 1000; v += paso) steps.push(v);
  return { top, steps };
}

// Mide el ancho real del contenedor para dibujar el svg 1 unidad = 1 píxel.
// Si no, al escalar el viewBox las etiquetas del eje quedan ilegibles en las
// tarjetas angostas (la columna lateral del tablero mide la mitad que el panel).
function useAnchoCh(ref, fallback = 620) {
  const [ancho, setAncho] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const medir = () => { const a = nodo.clientWidth; if (a > 0) setAncho(a); };
    medir();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(medir);
      ro.observe(nodo);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ref]);
  return ancho;
}

// Leyenda compartida (se dibuja fuera del svg para que el texto no se deforme)
function ChLeyenda({ series }) {
  return (
    <div className="ch-leyenda">
      {series.map((s) => (
        <span className="ch-leyenda-item" key={s.nombre}>
          <span className="ch-leyenda-dot" style={{ background: s.color }} />{s.nombre}
        </span>
      ))}
    </div>
  );
}

// ---------- barras verticales agrupadas ----------
// data: [{ label: "Ago 26", valores: [1000, 800] }]  ·  series: [{ nombre, color }]
// marcas: valor opcional por columna, se dibuja como línea punteada (ej: la meta).
function ChBarras({ data, series, fmtEje, fmtValor, marcas, alto = 250 }) {
  const caja = React.useRef(null);
  const W = Math.max(280, useAnchoCh(caja));
  const H = alto, padL = 58, padR = 12, padT = 12, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const valores = data.reduce((a, d) => a.concat(d.valores), []);
  const conMarcas = marcas ? valores.concat(marcas.filter((m) => m != null)) : valores;
  const eje = chEje(Math.max(0, ...conMarcas));
  const y = (v) => padT + plotH - (Math.max(0, v) / eje.top) * plotH;
  const gw = plotW / Math.max(1, data.length);
  const n = Math.max(1, series.length);
  const bw = Math.max(5, Math.min(22, (gw * 0.62 - (n - 1) * 4) / n));
  const fv = fmtValor || ((v) => v);

  return (
    <div className="ch-box" ref={caja}>
    <svg className="ch-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="xMidYMid meet">
      {eje.steps.map((v) => (
        <g key={v}>
          <line className="ch-grid" x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} />
          <text className="ch-eje" x={padL - 9} y={y(v) + 4} textAnchor="end">{fmtEje ? fmtEje(v) : v}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = padL + gw * i + gw / 2;
        const ancho = n * bw + (n - 1) * 4;
        return (
          <g key={i}>
            {d.valores.map((v, j) => {
              const h = v > 0 ? Math.max(2, (v / eje.top) * plotH) : 0;
              return (
                <rect key={j} x={cx - ancho / 2 + j * (bw + 4)} y={padT + plotH - h}
                  width={bw} height={h} rx={3} fill={series[j] ? series[j].color : CH_COLOR.gris}>
                  <title>{d.label + " · " + (series[j] ? series[j].nombre : "") + ": " + fv(v)}</title>
                </rect>
              );
            })}
            {marcas && marcas[i] != null && (
              <line className="ch-marca" x1={cx - ancho / 2 - 4} x2={cx + ancho / 2 + 4} y1={y(marcas[i])} y2={y(marcas[i])}>
                <title>{"Meta: " + fv(marcas[i])}</title>
              </line>
            )}
            <text className="ch-eje" x={cx} y={H - 10} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
      <line className="ch-base" x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} />
    </svg>
    </div>
  );
}

// ---------- dona ----------
// items: [{ label, valor, color }]  ·  centro: { valor, label }
function ChDona({ items, size = 168, grosor = 26, centro }) {
  const total = items.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const r = (size - grosor) / 2;
  const C = 2 * Math.PI * r;
  let acum = 0;
  return (
    <svg className="ch-dona" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={grosor} />
      {total > 0 && items.map((it, i) => {
        const frac = (Number(it.valor) || 0) / total;
        if (frac <= 0) return null;
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={grosor}
            strokeDasharray={`${C * frac} ${C * (1 - frac)}`} strokeDashoffset={-C * acum}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{it.label + ": " + Math.round(frac * 1000) / 10 + "%"}</title>
          </circle>
        );
        acum += frac;
        return el;
      })}
      {centro && (
        <>
          <text className="ch-dona-v" x={size / 2} y={size / 2 + 2} textAnchor="middle">{centro.valor}</text>
          <text className="ch-dona-l" x={size / 2} y={size / 2 + 20} textAnchor="middle">{centro.label}</text>
        </>
      )}
    </svg>
  );
}

// ---------- anillo de avance (objetivos) ----------
function ChAnillo({ pct, size = 68, grosor = 8, color, texto }) {
  const r = (size - grosor) / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <svg className="ch-anillo" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={grosor} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || "var(--brand)"} strokeWidth={grosor}
        strokeLinecap="round" strokeDasharray={`${(C * p) / 100} ${C}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text className="ch-anillo-t" x={size / 2} y={size / 2 + 5} textAnchor="middle"
        style={{ fontSize: size < 60 ? 14 : 16 }}>{texto != null ? texto : Math.round(p) + "%"}</text>
    </svg>
  );
}

// ---------- barras horizontales (ranking / promedios) ----------
// rows: [{ label, valor, texto, sub, color }]  — se dibuja con divs, no con svg,
// porque las etiquetas son largas y así se cortan solas en pantallas chicas.
function ChBarrasH({ rows, max, vacio }) {
  const tope = max != null ? max : Math.max(1, ...rows.map((r) => Number(r.valor) || 0));
  if (!rows.length) return <div className="ch-vacio">{vacio || "Sin datos en el período"}</div>;
  return (
    <div className="ch-hbars">
      {rows.map((r) => (
        <div className="ch-hbar" key={r.label}>
          <div className="ch-hbar-head">
            <span className="ch-hbar-label" title={r.label}>{r.label}</span>
            <span className="ch-hbar-valor mono">{r.texto != null ? r.texto : r.valor}</span>
          </div>
          <div className="ch-hbar-track">
            <span style={{ width: Math.max(2, ((Number(r.valor) || 0) / tope) * 100) + "%", background: r.color || CH_COLOR.azul }} />
          </div>
          {r.sub && <div className="ch-hbar-sub">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { CH_COLOR, chEje, useAnchoCh, ChLeyenda, ChBarras, ChDona, ChAnillo, ChBarrasH });
