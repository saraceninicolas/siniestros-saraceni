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
const money2 = (v) => (v == null || v === "" ? "—" : "$" + Number(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
// "1.234.567,89" o "1234567.89" → 1234567.89
//
// El punto es ambiguo y acá se juega plata: a la argentina separa miles
// ("1.500" son mil quinientos) y en lo que guarda la base separa decimales
// ("1234567.89"). Las dos formas entran por el mismo campo, así que hay que
// decidir cuál es cuál.
//
// Con coma no hay duda: los puntos son de miles. Sin coma, se miran los grupos:
// solo es separador de miles si están TODOS de a tres ("1.500", "2.673.574").
// "2673574.83" o "1.5" terminan en un grupo que no es de tres, y ahí el punto
// es decimal.
//
// ⚠️ Esto antes devolvía 1,5 para "1.500". Casi no se llegaba, porque el campo
// mostraba el número pelado y nadie escribía puntos; desde que se muestra
// formateado, el formato con puntos es justo el que alguien va a copiar, y
// equivocarse acá no avisa: carga mil veces menos y la fila queda igual de
// prolija.
const parseMonto = (v) => {
  if (v === "" || v == null) return null;
  let s = String(v).trim().replace(/[$\s]/g, "");
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
};

// Para MOSTRAR un importe cargado. "2673574.83" obliga a contar los dígitos con
// el dedo; "2.673.574,83" se lee de un vistazo, que es lo que uno hace cuando
// controla doce filas seguidas contra la factura de la compañía.
//
// Si lo que hay escrito todavía no es un número —alguien a mitad de tipear, un
// "-" suelto, una coma sin decimales— se devuelve tal cual. Corregirle a
// alguien lo que está escribiendo es peor que mostrarlo feo un segundo.
const fmtMonto = (v) => {
  if (v === "" || v == null) return "";
  const n = parseMonto(v);
  if (n == null) return String(v);
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Un importe se escribe en crudo y se lee con puntos.
//
// Mientras alguien tipea se muestra EXACTAMENTE lo que tipeó: reformatear a
// cada tecla pelea con el cursor (escribís "1234", aparece un punto solo y el
// cursor se te va al final). Recién al salir del campo vuelve a mostrarse con
// separadores. Antes de la primera tecla también se ve formateado, así que
// entrar a corregir un número no lo hace saltar a su forma cruda.
function MontoInput({ valor, onChange, placeholder, strong }) {
  const [tipeando, setTipeando] = React.useState(null);
  // Si el campo se vacía desde afuera —el formulario de cobros lo limpia
  // después de agregar uno— hay que soltar lo que se estaba tipeando. Sin
  // esto el importe quedaba escrito aunque el cobro ya se hubiera cargado, y
  // lo más fácil del mundo era volver a apretar Agregar y cargarlo dos veces.
  React.useEffect(() => { if (valor === "" || valor == null) setTipeando(null); }, [valor]);
  return (
    <span className="monto">
      <input
        className={"input sm mono num" + (strong ? " strong" : "")}
        value={tipeando != null ? tipeando : fmtMonto(valor)}
        onChange={(e) => { setTipeando(e.target.value); onChange(e.target.value); }}
        onBlur={() => setTipeando(null)}
        placeholder={placeholder}
        inputMode="decimal"
      />
    </span>
  );
}

const IVA_PCT = 0.21;

// A dónde se le manda la factura a esta compañía. El campo guarda un mail, una
// dirección web o la palabra "WEB" de las que todavía no tienen link cargado.
//
// Antes decía siempre "mail" y el mail de verdad estaba escondido en el title,
// que en el celular no existe y en la computadora hay que adivinar que está.
// Era un dato que ya teníamos y obligaba a ir a buscarlo a otra pantalla.
function EnvioTag({ envio }) {
  const v = String(envio || "").trim();
  if (!v) return null;
  if (v.includes("@")) {
    return <a className="fact-envio" href={"mailto:" + v} title={"Escribirle a " + v}
      onClick={(e) => e.stopPropagation()}>{v}</a>;
  }
  if (/^https?:\/\//i.test(v)) {
    // Se muestra el dominio y no la URL entera: "mercantilandina.com.ar" dice
    // lo mismo que doscientos caracteres de parámetros y entra en la celda.
    let dominio = v;
    try { dominio = new URL(v).hostname.replace(/^www\./, ""); } catch (e) { /* queda la cruda */ }
    return <a className="fact-envio es-link" href={v} target="_blank" rel="noreferrer noopener"
      title={"Abrir " + v} onClick={(e) => e.stopPropagation()}>{dominio}</a>;
  }
  // "WEB" sin dirección: se puede pegar el link en Compañías y se vuelve clickeable.
  return <span className="fact-envio" title="Pegá el link del portal en Compañías y queda clickeable">{v}</span>;
}

// ============================ CARGA MENSUAL ============================
// Una fila por compañía: se ven los datos fijos y se completan los del mes.
function CargaMensual({ companias, movs, pagos, anio, mes, onAnio, onMes, onGuardar, onGuardarTodo, onVerCobros, station }) {
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

  // Cuántas transferencias tiene la factura de esa fila. Solo se muestra el
  // cartelito cuando son más de una: avisar "1 pago" en las doce filas sería
  // ruido en la única columna donde hace falta mirar rápido.
  const cuantosPagos = (g) => (g && g._dbId ? (pagos || []).filter((p) => p.factId === g._dbId).length : 0);

  // Orden de las filas. "Propio" es el que eligió el broker en Compañías;
  // "facturado" pone arriba a la que más facturó este mes.
  //
  // ⚠️ Ordena por lo GUARDADO (`delMes`) y no por lo que hay escrito en los
  // campos. Si mirara lo que se está tipeando, la fila saltaría de lugar
  // mientras cargás el neto y terminarías escribiendo en la de otra compañía.
  const [orden, setOrden] = React.useState("facturado");
  const ordenadas = React.useMemo(() => {
    if (orden !== "facturado") return companias;
    const totalDe = (c) => {
      const g = delMes[c.id];
      return g && g.total != null ? Number(g.total) : -1;   // las sin cargar, al final
    };
    return [...companias].sort((a, b) => totalDe(b) - totalDe(a) || (a.orden || 0) - (b.orden || 0));
  }, [companias, delMes, orden]);

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
            <div className="seg">
              <button type="button" className={"seg-btn" + (orden === "facturado" ? " is-on" : "")}
                onClick={() => setOrden("facturado")} title="La que más facturó este mes, arriba">Más facturado</button>
              <button type="button" className={"seg-btn" + (orden === "propio" ? " is-on" : "")}
                onClick={() => setOrden("propio")} title="El orden que elegiste en Compañías">Orden propio</button>
            </div>
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
                {/* minWidth y no width: en una tabla de ancho automático el
                    `width` es apenas una sugerencia, y cuando el espacio no
                    alcanzaba el navegador apretaba las columnas de importes en
                    vez de hacer scroll. A 980px de ancho el campo del total
                    quedaba en 96px y seis de ocho números salían cortados. Con
                    un mínimo de verdad la tabla se niega a achicarse y el que
                    corre es el scroll horizontal, que es lo que se puede leer. */}
                <th style={{ minWidth: 200 }}>Compañía</th>
                <th style={{ minWidth: 108 }}>Fecha</th>
                <th style={{ minWidth: 78 }}>N° fac</th>
                <th style={{ minWidth: 146 }}>Neto</th>
                <th style={{ minWidth: 146 }}>IVA</th>
                <th style={{ minWidth: 146 }}>Total</th>
                <th style={{ minWidth: 62 }}>Envío</th>
                <th style={{ minWidth: 146 }}>Cobrado</th>
                <th style={{ minWidth: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((c) => {
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
                        <EnvioTag envio={c.envio} />
                      </div>
                    </td>
                    <td><input className="input sm" type="date" value={valorDe(c, "fecha") || ""} onChange={(e) => setCampo(c, "fecha", e.target.value)} /></td>
                    <td><input className="input sm mono" value={valorDe(c, "nroFactura")} onChange={(e) => setCampo(c, "nroFactura", e.target.value)} placeholder="—" /></td>
                    <td><MontoInput valor={valorDe(c, "neto")} onChange={(v) => setCampo(c, "neto", v)} placeholder="0" /></td>
                    <td><MontoInput valor={valorDe(c, "iva")} onChange={(v) => setCampo(c, "iva", v)} placeholder={c.tipo === "A" ? "auto" : "—"} /></td>
                    <td><MontoInput valor={valorDe(c, "total")} onChange={(v) => setCampo(c, "total", v)} placeholder="0" strong /></td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" className="fact-chk" checked={!!valorDe(c, "enviado")} onChange={(e) => setCampo(c, "enviado", e.target.checked)} title="Factura enviada" />
                    </td>
                    <td>
                      {/* Ya no es un campo: una factura se cobra en partes, así
                          que acá se muestra la suma y se entra al detalle. */}
                      <button type="button" className="cob-btn"
                        disabled={!g || !g._dbId}
                        title={!g || !g._dbId
                          ? "Guardá la factura del mes antes de cargar cobros"
                          : "Ver y agregar los cobros de este mes"}
                        onClick={() => onVerCobros(c, g)}>
                        <span className="mono">{g && g.pago != null ? money2(g.pago) : "—"}</span>
                        {cuantosPagos(g) > 1 && <span className="cob-n">{cuantosPagos(g)} pagos</span>}
                      </button>
                    </td>
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

// ============================ COBROS DE UNA FACTURA ============================
// Varias compañías pagan la misma factura en partes: transfieren 100 y a la
// semana siguiente 150. Antes había UN campo, así que para registrar la
// segunda había que pisar el primer número con la suma hecha a mano, y se
// perdía cuándo entró cada parte. Eso es lo que se mira cuando una compañía se
// atrasa: no cuánto falta, sino desde cuándo falta.
//
// El total no se calcula acá: lo mantiene la base (0021). Esta pantalla agrega
// y borra filas, y el número del mes aparece solo.
function CobrosModal({ compania, fila, pagos, anio, mes, onAgregar, onBorrar, onClose }) {
  const [fecha, setFecha] = React.useState(hoyISO());
  const [importe, setImporte] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);

  const cobrado = pagos.reduce((s, p) => s + Number(p.importe || 0), 0);
  const facturado = fila && fila.total != null ? Number(fila.total) : 0;
  // Lo que falta para llegar a la factura NO es una deuda y no se llama
  // "pendiente". De una factura se cobra casi siempre menos de lo que dice:
  // la compañía descuenta retenciones. Con lo que hay cargado, el sistema no
  // puede saber si esa diferencia es una retención, un cobro que todavía no se
  // anotó o plata que de verdad falta, así que la muestra y no la interpreta.
  const diferencia = facturado - cobrado;

  const agregar = async () => {
    const n = parseMonto(importe);
    if (n == null) return;
    setOcupado(true);
    await onAgregar({ factId: fila._dbId, fecha: fecha || null, importe: n });
    setImporte(""); setFecha(hoyISO());
    setOcupado(false);
  };

  return (
    <ModalShell
      title={"Cobros de " + compania.razonSocial}
      sub={MESES_F[mes - 1] + " " + anio + " · facturado " + money0(facturado)}
      onClose={onClose}
      footer={
        <div className="cob-pie">
          <div><span className="fact-res-k">Cobrado</span><span className="fact-res-v">{money0(cobrado)}</span></div>
          <div>
            <span className="fact-res-k">Diferencia con la factura</span>
            <span className="fact-res-v cob-dif" title="Puede ser retenciones o un cobro todavía no cargado">
              {money0(diferencia)}
            </span>
          </div>
          <button className="btn-primary" onClick={onClose}>Listo</button>
        </div>
      }
    >
      <div className="cob-alta">
        <label className="field"><span className="field-label">Fecha</span>
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="field"><span className="field-label">Importe</span>
          <MontoInput valor={importe} onChange={setImporte} placeholder="0" /></label>
        <button className="btn-primary" onClick={agregar} disabled={ocupado || parseMonto(importe) == null}>
          <Ico name="plus" size={15} />Agregar
        </button>
      </div>

      {pagos.length === 0
        ? <div className="acc-vacio">Todavía no se registró ningún cobro de este mes.</div>
        : <table className="table">
            <thead><tr><th>Fecha</th><th style={{ textAlign: "right" }}>Importe</th><th /></tr></thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.fecha ? fmtDate(p.fecha) : "—"}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money2(p.importe)}</td>
                  <td>
                    <button className="row-open danger" title="Borrar este cobro" onClick={() => onBorrar(p)}>
                      <Ico name="close" size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
    </ModalShell>
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

  // De la que más facturó en el año a la que menos. Esta pantalla es para
  // mirar, no para cargar, así que el orden que sirve es el del ranking y no
  // el que eligió el broker en Compañías.
  const ordenadas = React.useMemo(() => {
    const anualDe = (c) => MESES_CORTO.reduce((s, _, i) => s + (totalDe(c.id, anio, i + 1) || 0), 0);
    return [...companias].sort((a, b) => anualDe(b) - anualDe(a) || (a.orden || 0) - (b.orden || 0));
  }, [companias, idx, anio]);

  const PctTag = ({ v }) => {
    if (v == null) return <span className="fact-pct nulo">—</span>;
    const cls = v > 0.5 ? "sube" : v < -0.5 ? "baja" : "igual";
    return <span className={"fact-pct " + cls}>{v > 0 ? "+" : ""}{v.toFixed(0)}%</span>;
  };

  return (
    <div>
      <div className="kpis">
        {[
          { label: "Facturado " + anio, value: money0(totalAnual), hint: mesesConDatos + " meses cargados", tone: { bg: "var(--info-soft)", fg: "var(--info-2)" }, icon: "doc" },
          { label: "Promedio mensual", value: money0(mesesConDatos ? totalAnual / mesesConDatos : 0), hint: "sobre meses con datos", tone: { bg: "var(--ok-soft)", fg: "var(--ok)" }, icon: "grid" },
          { label: "Mejor mes", value: mesesConDatos ? MESES_F[totalesMes.indexOf(Math.max(...totalesMes))] : "—", hint: money0(Math.max(...totalesMes, 0)), tone: { bg: "var(--warn-soft)", fg: "var(--warn)" }, icon: "target" },
          { label: "Compañías", value: companias.length, hint: "en el listado", tone: { bg: "var(--peligro-soft)", fg: "var(--peligro)" }, icon: "folder" },
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
              {ordenadas.map((c) => {
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
              <input className="input" value={f.envio} onChange={(e) => set("envio", e.target.value)}
                placeholder="mail@compania.com o https://portal.compania.com" />
              <span className="field-hint">Si pegás un mail o un link, en la carga mensual queda clickeable.</span></label>
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
                  ? <span className="badge" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}><span className="badge-dot" style={{ background: "var(--ok)" }} />Activa</span>
                  : <span className="badge" style={{ background: "var(--line-2)", color: "var(--ink-2)" }}><span className="badge-dot" style={{ background: "var(--muted)" }} />Inactiva</span>}</td>
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

// ============================ CIERRE DEL MES ============================
// De dónde salen los números para repartir sueldos. Es la única pantalla que
// mira el mes como un todo y no compañía por compañía: junta lo facturado, lo
// que efectivamente entró y lo que se fue en IVA, y deja ver qué queda.
//
// Lo que se reparte sale de lo COBRADO y no de lo facturado: una factura
// emitida que todavía nadie pagó no es plata que exista. El cobrado de acá es
// la suma de todos los cobros cargados en la carga mensual, incluidos los que
// entraron en partes.

// Los porcentajes con los que arranca una empresa que nunca cargó un reparto.
// Son editables y se guardan por mes: acá están solo para no empezar en blanco.
const REPARTO_FABRICA = [
  { nombre: "Hernán", pct: 75 },
  { nombre: "Nicolás", pct: 17.5 },
  { nombre: "Facundo", pct: 7.5 },
];

// Un giro a un socio. Varios por persona y por mes, porque casi nunca se paga
// todo junto y lo que importa es cuándo salió cada parte.
function AltaTransferencia({ socios, onAgregar }) {
  const [persona, setPersona] = React.useState("");
  const [fecha, setFecha] = React.useState(hoyISO());
  const [importe, setImporte] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const quien = persona || (socios[0] && socios[0].nombre) || "";

  const agregar = async () => {
    const n = parseMonto(importe);
    if (n == null || !quien) return;
    setOcupado(true);
    await onAgregar({ persona: quien, fecha: fecha || null, importe: n });
    setImporte(""); setFecha(hoyISO());
    setOcupado(false);
  };

  return (
    <div className="tr-alta">
      <label className="field"><span className="field-label">Para</span>
        <select className="input" value={quien} onChange={(e) => setPersona(e.target.value)}>
          {socios.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
        </select></label>
      <label className="field"><span className="field-label">Fecha de transferencia</span>
        <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      <label className="field"><span className="field-label">Importe</span>
        <MontoInput valor={importe} onChange={setImporte} placeholder="0" /></label>
      <button className="btn-primary" onClick={agregar} disabled={ocupado || parseMonto(importe) == null}>
        <Ico name="plus" size={15} />Registrar
      </button>
    </div>
  );
}
function RepartoView({ companias, movs, pagos, periodos, transferencias, anio, mes,
                      onAnio, onMes, onGuardarPeriodo, onAgregarTransferencia, onBorrarTransferencia }) {
  const periodo = (periodos || []).find((p) => p.anio === anio && p.mes === mes) || null;
  const [pagoIva, setPagoIva] = React.useState("");
  const [reparto, setReparto] = React.useState(REPARTO_FABRICA);
  const [guardando, setGuardando] = React.useState(false);
  const [copiado, setCopiado] = React.useState(false);

  // Los porcentajes de un mes sin guardar se arrastran del último mes que sí
  // los tenga. Si no, cada mes habría que volver a escribir lo mismo; y si
  // alguna vez cambian, los meses viejos conservan el suyo porque quedó
  // guardado en su propia fila.
  const repartoHeredado = React.useMemo(() => {
    const previos = (periodos || [])
      .filter((p) => Array.isArray(p.reparto) && p.reparto.length &&
        (p.anio < anio || (p.anio === anio && p.mes <= mes)))
      .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));
    return previos.length ? previos[0].reparto : REPARTO_FABRICA;
  }, [periodos, anio, mes]);

  // Al cambiar de mes se trae lo guardado de ese mes, no lo que quedó escrito.
  React.useEffect(() => {
    setPagoIva(periodo && periodo.pagoIva != null ? String(periodo.pagoIva) : "");
    setReparto(periodo && Array.isArray(periodo.reparto) && periodo.reparto.length
      ? periodo.reparto : repartoHeredado);
  }, [anio, mes, periodo, repartoHeredado]);

  const delMes = React.useMemo(() => {
    const m = {};
    movs.filter((x) => x.anio === anio && x.mes === mes).forEach((x) => { m[x.companiaId] = x; });
    return m;
  }, [movs, anio, mes]);

  const filas = companias.map((c) => {
    const g = delMes[c.id] || {};
    return {
      cia: c,
      neto: g.neto != null ? Number(g.neto) : 0,
      iva: g.iva != null ? Number(g.iva) : 0,
      bruto: g.total != null ? Number(g.total) : 0,
      cobrado: g.pago != null ? Number(g.pago) : 0,
      cargada: g.total != null,
    };
  }).filter((f) => f.cargada).sort((a, b) => b.bruto - a.bruto);

  const tot = filas.reduce((s, f) => ({
    neto: s.neto + f.neto, iva: s.iva + f.iva, bruto: s.bruto + f.bruto, cobrado: s.cobrado + f.cobrado,
  }), { neto: 0, iva: 0, bruto: 0, cobrado: 0 });

  const pagado = parseMonto(pagoIva) || 0;
  const ivaQueQueda = tot.iva - pagado;
  const paraRepartir = tot.cobrado - pagado;

  // ── El reparto ───────────────────────────────────────────────────────────
  const delMesTr = (transferencias || []).filter((t) => t.anio === anio && t.mes === mes);
  const pctTotal = reparto.reduce((s, p) => s + (Number(p.pct) || 0), 0);
  const socios = reparto.map((p) => {
    const pct = Number(p.pct) || 0;
    const leToca = paraRepartir * (pct / 100);
    const girado = delMesTr.filter((t) => t.persona === p.nombre).reduce((s, t) => s + Number(t.importe || 0), 0);
    return { nombre: p.nombre, pct, leToca, girado, falta: leToca - girado };
  });

  const setSocio = (i, campo, valor) =>
    setReparto((prev) => prev.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));

  const guardar = async () => {
    setGuardando(true);
    await onGuardarPeriodo({
      anio, mes, pagoIva: parseMonto(pagoIva),
      reparto: reparto
        .filter((p) => String(p.nombre || "").trim())
        .map((p) => ({ nombre: String(p.nombre).trim(), pct: Number(p.pct) || 0 })),
    });
    setGuardando(false);
  };

  // ── Los cobros del mes, uno por uno ──────────────────────────────────────
  // El detalle existe en la carga mensual pero repartido en doce modales. Acá
  // va seguido y con fecha: es la lista contra la que se controla el extracto
  // del banco antes de girar.
  const cobrosDelMes = React.useMemo(() => {
    const porFact = {};
    movs.filter((x) => x.anio === anio && x.mes === mes).forEach((x) => { porFact[x._dbId] = x; });
    const nombre = {};
    companias.forEach((c) => { nombre[c.id] = c.razonSocial; });
    return (pagos || [])
      .filter((p) => porFact[p.factId])
      .map((p) => ({ ...p, cia: nombre[porFact[p.factId].companiaId] || "—" }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [pagos, movs, companias, anio, mes]);

  // Para pasarlo a una planilla. Nico trabaja con Excel y copiar a mano doce
  // filas de números es justo donde se cuela un error que después nadie
  // encuentra.
  const copiar = async () => {
    const lineas = [["Compañía", "Neto", "IVA", "Bruto", "Cobrado"].join("\t")];
    filas.forEach((f) => lineas.push([f.cia.razonSocial, f.neto, f.iva, f.bruto, f.cobrado].join("\t")));
    lineas.push(["TOTAL", tot.neto, tot.iva, tot.bruto, tot.cobrado].join("\t"));
    lineas.push([]);
    lineas.push(["Pago de IVA", pagado].join("\t"));
    lineas.push(["IVA que queda", ivaQueQueda].join("\t"));
    lineas.push(["Para repartir", paraRepartir].join("\t"));
    lineas.push([]);
    lineas.push(["Quién", "%", "Le toca", "Transferido", "Falta girar"].join("\t"));
    socios.forEach((s) => lineas.push([s.nombre, s.pct, s.leToca, s.girado, s.falta].join("\t")));
    try {
      await navigator.clipboard.writeText(lineas.join("\n"));
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    } catch (e) { console.error(e); }
  };

  const anios = [];
  for (let a = new Date().getFullYear() + 1; a >= 2024; a--) anios.push(a);

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
      </div>

      <div className="rep-grid">
        {/* Izquierda: la cuenta del mes, que es corta y se lee de arriba abajo.
            Derecha: las tablas, que necesitan ancho. */}
        <div className="rep-col">
        <section className="est-card rep-cuentas">
          <div className="est-card-head">
            <div><h3>El mes en números</h3><p>{MESES_F[mes - 1]} {anio} · {filas.length} compañías cargadas</p></div>
          </div>

          <div className="rep-lineas">
            <div className="rep-l"><span>Neto facturado</span><b className="mono">{money2(tot.neto)}</b></div>
            <div className="rep-l"><span>IVA facturado</span><b className="mono">{money2(tot.iva)}</b></div>
            <div className="rep-l rep-l-suma"><span>Bruto</span><b className="mono">{money2(tot.bruto)}</b></div>

            <div className="rep-l rep-l-sep">
              <span>Cobrado <i className="rep-nota">lo que entró de verdad</i></span>
              <b className="mono ok">{money2(tot.cobrado)}</b>
            </div>

            <div className="rep-l rep-l-sep rep-l-input">
              <span>Pago de IVA <i className="rep-nota">lo que se transfirió a la AFIP</i></span>
              <div className="rep-campo">
                <MontoInput valor={pagoIva} onChange={setPagoIva} placeholder="0" />
                <button className="btn-primary sm" onClick={guardar} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
            <div className="rep-l"><span>IVA que queda</span>
              <b className={"mono" + (ivaQueQueda < 0 ? " peligro" : "")}>{money2(ivaQueQueda)}</b></div>

            <div className="rep-l rep-total">
              <span>Para repartir <i className="rep-nota">cobrado menos el IVA pagado</i></span>
              <b className="mono">{money2(paraRepartir)}</b>
            </div>
          </div>
        </section>

        </div>

        <div className="rep-col">
        <section className="est-card rep-socios">
          <div className="est-card-head">
            <div><h3>Reparto</h3><p>sobre {money2(paraRepartir)}</p></div>
            {Math.abs(pctTotal - 100) > 0.01 && (
              <span className="rep-pct-mal">Los porcentajes suman {pctTotal.toLocaleString("es-AR")}%</span>
            )}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {/* minWidth y no width: en una tabla de ancho automático el
                      `width` es una sugerencia, y la columna del porcentaje se
                      achicaba hasta que el campo no se veía. */}
                  <th style={{ minWidth: 130 }}>Quién</th>
                  <th style={{ minWidth: 86 }}>%</th>
                  <th style={{ textAlign: "right", minWidth: 118 }}>Le toca</th>
                  <th style={{ textAlign: "right", minWidth: 118 }}>Transferido</th>
                  <th style={{ textAlign: "right", minWidth: 118 }}>Falta girar</th>
                  <th style={{ minWidth: 40 }} />
                </tr>
              </thead>
              <tbody>
                {reparto.map((p, i) => {
                  const s = socios[i];
                  return (
                    <tr key={i}>
                      <td><input className="input sm" value={p.nombre}
                        onChange={(e) => setSocio(i, "nombre", e.target.value)} placeholder="Nombre" /></td>
                      <td><input className="input sm mono num" value={p.pct}
                        onChange={(e) => setSocio(i, "pct", e.target.value.replace(",", "."))}
                        inputMode="decimal" /></td>
                      <td className="mono" style={{ textAlign: "right" }}><b>{money2(s.leToca)}</b></td>
                      <td className="mono" style={{ textAlign: "right", color: s.girado > 0 ? "var(--ok)" : "var(--muted)" }}>
                        {s.girado ? money2(s.girado) : "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {Math.abs(s.falta) < 0.01
                          ? <span className="badge" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>Al día</span>
                          : money2(s.falta)}</td>
                      <td>
                        {reparto.length > 1 && (
                          <button className="row-open danger" title="Sacar del reparto"
                            onClick={() => setReparto((prev) => prev.filter((_, j) => j !== i))}>
                            <Ico name="close" size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rep-socios-pie">
            <button className="btn-ghost sm" onClick={() => setReparto((p) => [...p, { nombre: "", pct: 0 }])}>
              <Ico name="plus" size={14} />Agregar a alguien
            </button>
            <button className="btn-primary sm" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar el reparto del mes"}
            </button>
          </div>
          <p className="fact-nota-card">
            Los porcentajes se guardan en este mes. Si algún día cambian, los meses
            ya cerrados siguen mostrando el reparto con el que se cerraron.
          </p>
        </section>

        <section className="est-card">
          <div className="est-card-head">
            <div><h3>Transferencias del mes</h3><p>lo que ya se le giró a cada uno</p></div>
          </div>
          <AltaTransferencia socios={socios} onAgregar={(t) => onAgregarTransferencia({ ...t, anio, mes })} />
          {delMesTr.length === 0
            ? <div className="acc-vacio">Todavía no se registró ninguna transferencia de este mes.</div>
            : <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Para</th><th style={{ textAlign: "right" }}>Importe</th><th style={{ width: 40 }} /></tr></thead>
                  <tbody>
                    {delMesTr.map((t) => (
                      <tr key={t.id}>
                        <td className="mono">{t.fecha ? fmtDate(t.fecha) : "—"}</td>
                        <td><b>{t.persona}</b></td>
                        <td className="mono" style={{ textAlign: "right" }}>{money2(t.importe)}</td>
                        <td>
                          <button className="row-open danger" title="Borrar esta transferencia"
                            onClick={() => onBorrarTransferencia(t)}><Ico name="close" size={15} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </section>

        <section className="est-card">
          <div className="est-card-head">
            <div><h3>Cobros del mes</h3><p>{cobrosDelMes.length} {cobrosDelMes.length === 1 ? "cobro" : "cobros"}, con la fecha en que entró cada uno</p></div>
            <span className="fact-res-v" style={{ fontSize: 15 }}>{money0(tot.cobrado)}</span>
          </div>
          {cobrosDelMes.length === 0
            ? <div className="acc-vacio">No hay cobros cargados en este mes. Se cargan desde la carga mensual.</div>
            : <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha de cobro</th><th style={{ minWidth: 170 }}>Compañía</th><th style={{ textAlign: "right" }}>Importe</th></tr></thead>
                  <tbody>
                    {cobrosDelMes.map((p) => (
                      <tr key={p.id}>
                        <td className="mono">{p.fecha ? fmtDate(p.fecha) : "—"}</td>
                        <td><div className="cell-strong sm">{p.cia}</div></td>
                        <td className="mono" style={{ textAlign: "right" }}>{money2(p.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </section>

        <section className="est-card">
          <div className="est-card-head">
            <div><h3>Compañía por compañía</h3><p>de la que más facturó a la que menos</p></div>
            <button className="btn-ghost sm" onClick={copiar} disabled={!filas.length}>
              <Ico name={copiado ? "check" : "doc"} size={14} />{copiado ? "Copiado" : "Copiar para Excel"}
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Compañía</th>
                  <th style={{ textAlign: "right", minWidth: 118 }}>Neto</th>
                  <th style={{ textAlign: "right", minWidth: 110 }}>IVA</th>
                  <th style={{ textAlign: "right", minWidth: 118 }}>Bruto</th>
                  <th style={{ textAlign: "right", minWidth: 118 }}>Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.cia.id}>
                    <td><div className="cell-strong sm">{f.cia.razonSocial}</div></td>
                    <td className="mono" style={{ textAlign: "right" }}>{money2(f.neto)}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{money2(f.iva)}</td>
                    <td className="mono" style={{ textAlign: "right" }}><b>{money2(f.bruto)}</b></td>
                    <td className="mono" style={{ textAlign: "right", color: f.cobrado > 0 ? "var(--ok)" : "var(--muted)" }}>
                      {f.cobrado ? money2(f.cobrado) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filas.length > 0 && (
                <tfoot>
                  <tr className="fact-total-row">
                    <td><b>Total</b></td>
                    <td className="mono" style={{ textAlign: "right" }}><b>{money2(tot.neto)}</b></td>
                    <td className="mono" style={{ textAlign: "right" }}><b>{money2(tot.iva)}</b></td>
                    <td className="mono" style={{ textAlign: "right" }}><b>{money2(tot.bruto)}</b></td>
                    <td className="mono" style={{ textAlign: "right" }}><b>{money2(tot.cobrado)}</b></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {filas.length === 0 && (
            <div className="empty"><div className="empty-ico"><Ico name="doc" size={26} /></div>
              <div className="empty-title">No hay nada cargado en {MESES_F[mes - 1]}</div>
              <div className="empty-sub">Cargá las facturas del mes y acá aparecen los totales.</div></div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}

// ============================ ESTADÍSTICAS (panel) ============================
// Tablero del mes: KPIs contra el mes anterior, resumen por compañía, evolución,
// estado de cobro y alertas. Todo sale de `fact_mensual`, no se carga nada acá.
const pct1 = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + (Math.round(v * 100) / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%");
// Mes anterior, cruzando el cambio de año
const mesAnterior = (anio, mes) => (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 });
// Color del monograma de la compañía (mientras no haya logos)
const FACT_TONOS = ["var(--info-2)", "var(--warn)", "var(--ok)", "#7C3AED", "#0891B2", "var(--peligro)", "var(--ink-2)"];
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
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table fact-det-tabla">
              <thead><tr><th>Mes</th><th>N° factura</th><th style={{ textAlign: "right" }}>Facturado</th><th style={{ textAlign: "right" }}>Cobrado</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.mes}>
                    <td><b>{f.mes}</b></td>
                    <td className="mono cell-sub">{f.nro || "—"}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{f.facturado == null ? "—" : money0(f.facturado)}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{f.cobrado == null ? "—" : money0(f.cobrado)}</td>
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
      cia: c, facturado, cobrado,
      pctCobro: facturado > 0 ? (cobrado / facturado) * 100 : null,
      crecimiento: antes > 0 ? ((facturado - antes) / antes) * 100 : null,
      antes, cargada: cargada(c.id, anio, mes),
    };
  }).sort((a, b) => b.facturado - a.facturado), [companias, idx, anio, mes]);

  const conMovimiento = filas.filter((f) => f.facturado > 0);
  const facturado = conMovimiento.reduce((s, f) => s + f.facturado, 0);
  const cobrado = conMovimiento.reduce((s, f) => s + f.cobrado, 0);
  const facturadoPrev = filas.reduce((s, f) => s + f.antes, 0);
  const cobradoPrev = companias.reduce((s, c) => s + cobDe(c.id, prev.anio, prev.mes), 0);
  const varTotal = facturadoPrev > 0 ? ((facturado - facturadoPrev) / facturadoPrev) * 100 : null;
  const varCobrado = cobradoPrev > 0 ? ((cobrado - cobradoPrev) / cobradoPrev) * 100 : null;
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

  // alertas
  const alertas = [];
  conMovimiento.filter((f) => f.crecimiento != null && f.crecimiento <= -15).forEach((f) => alertas.push({
    tono: "media", titulo: f.cia.razonSocial, txt: `Caída del ${Math.abs(Math.round(f.crecimiento))}% en facturación respecto a ${mesPrevLabel}.`,
  }));
  if (sinCargar.length) alertas.push({
    tono: "media", titulo: `${sinCargar.length} ${sinCargar.length === 1 ? "compañía activa sin cargar" : "compañías activas sin cargar"}`,
    txt: sinCargar.map((c) => c.razonSocial).join(", "), accion: { label: "Ir a la carga", key: "fact-carga" },
  });

  const ranking = filas.filter((f) => f.crecimiento != null || f.facturado > 0)
    .sort((a, b) => (b.crecimiento == null ? -Infinity : b.crecimiento) - (a.crecimiento == null ? -Infinity : a.crecimiento));

  // ── Acumulado del año, contra el mismo tramo del año pasado ──────────────
  // El mes suelto engaña: una compañía que factura trimestral hunde un mes y
  // levanta el siguiente. Enero-a-este-mes contra enero-a-este-mes del año
  // anterior compara tramos iguales, que es la única comparación honesta.
  const acumulado = React.useMemo(() => {
    const sumaHasta = (a) => {
      let f = 0, c = 0;
      for (let m = 1; m <= mes; m++) {
        companias.forEach((x) => { f += facDe(x.id, a, m); c += cobDe(x.id, a, m); });
      }
      return { facturado: f, cobrado: c };
    };
    const hoy = sumaHasta(anio), antes = sumaHasta(anio - 1);
    return {
      ...hoy, antes: antes.facturado,
      variacion: antes.facturado > 0 ? ((hoy.facturado - antes.facturado) / antes.facturado) * 100 : null,
    };
  }, [companias, idx, anio, mes]);

  // ── De cuántas compañías depende el mes ──────────────────────────────────
  // Facturar mucho de pocas no es lo mismo que facturar mucho de muchas: si el
  // 70% sale de tres, perder una es perder el año. El dato no se ve en ningún
  // total.
  const top3 = conMovimiento.slice(0, 3).reduce((s, f) => s + f.facturado, 0);
  const concentracion = facturado > 0 ? (top3 / facturado) * 100 : null;

  // ── Facturas sin ningún cobro cargado, por antigüedad ────────────────────
  // ⚠️ Esta tarjeta NO mide deuda, y la primera versión sí lo intentaba.
  // Restar cobrado de facturado no da lo que una compañía debe: de una factura
  // se cobra casi siempre menos, porque descuentan retenciones. Con eso, el
  // panel marcaba como vencidos millones que nadie debía.
  //
  // Lo que el sistema sí sabe sin interpretar nada es cuáles facturas no
  // tienen un solo cobro anotado. Eso es una lista de trabajo —o está sin
  // conciliar, o está realmente sin pagar— y envejece: la de hace cuatro meses
  // es la que hay que mirar primero.
  const antiguedad = React.useMemo(() => {
    const finDeMes = (a, m) => new Date(a, m, 0);        // día 0 del siguiente = último del mes
    const hoy = new Date();
    const tramos = [
      { label: "Hasta 30 días", color: CH_COLOR.verde, valor: 0, cuantas: 0 },
      { label: "31 a 60 días", color: CH_COLOR.ambar, valor: 0, cuantas: 0 },
      { label: "Más de 60 días", color: CH_COLOR.rojo, valor: 0, cuantas: 0 },
    ];
    movs.forEach((r) => {
      if (r.total == null) return;
      if (r.anio > anio || (r.anio === anio && r.mes > mes)) return;
      if (r.pago != null) return;                         // ya tiene algo cargado
      const desde = parseDate(r.fecha) || finDeMes(r.anio, r.mes);
      const dias = Math.floor((hoy - desde) / 86400000);
      const t = dias <= 30 ? tramos[0] : dias <= 60 ? tramos[1] : tramos[2];
      t.valor += Number(r.total); t.cuantas++;
    });
    return tramos;
  }, [movs, anio, mes]);
  const sinConciliarTotal = antiguedad.reduce((s, t) => s + t.valor, 0);
  const sinConciliarViejo = antiguedad[2];

  const kpis = [
    { label: "Facturado total", value: money2(facturado), delta: varTotal, tone: { bg: "var(--info-soft)", fg: "var(--info-2)" }, icon: "doc" },
    { label: "Cobrado total", value: money2(cobrado), delta: varCobrado, tone: { bg: "var(--ok-soft)", fg: "var(--ok)" }, icon: "card" },
    { label: "Acumulado " + anio, value: money2(acumulado.facturado), delta: acumulado.variacion,
      hintAcum: "enero a " + MESES_F[mes - 1].toLowerCase() + ", contra " + (anio - 1),
      tone: { bg: "var(--brand-soft)", fg: "var(--brand-txt)" }, icon: "trend" },
    { label: "Las tres más grandes", value: concentracion == null ? "—" : Math.round(concentracion) + "%",
      hint: conMovimiento.length ? "del mes sale de " + Math.min(3, conMovimiento.length) + " de " + conMovimiento.length + " compañías" : "sin facturación cargada",
      tone: { bg: "var(--info-soft)", fg: "var(--info-2)" }, icon: "grid" },
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
                : <><span className="kpi-hint">{c.hintAcum || ("vs " + mesPrevLabel)}</span>
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
                      <td className="mono" style={{ textAlign: "right", color: f.cobrado > 0 ? "var(--ok)" : "var(--muted)" }}>{f.cobrado ? money0(f.cobrado) : "$ 0"}</td>
                      <td>
                        <div className="fact-cobro">
                          <span className="fact-cobro-track">
                            <span style={{
                              width: Math.min(100, Math.max(0, f.pctCobro || 0)) + "%",
                              background: (f.pctCobro || 0) >= 100 ? "var(--ok)" : (f.pctCobro || 0) >= 50 ? "#F59E0B" : "#EA580C",
                            }} />
                          </span>
                          <b className="mono">{f.pctCobro == null ? "—" : Math.round(f.pctCobro) + "%"}</b>
                        </div>
                      </td>
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
          {/* Lo que falta cobrar, por antigüedad. No mira solo el mes elegido:
              una factura de hace cuatro meses sin cobrar no aparece en ningún
              resumen mensual y es exactamente la que hay que ir a reclamar. */}
          <section className="est-card">
            <div className="est-card-head">
              <div><h3>Facturas sin cobros cargados</h3>
                <p>por antigüedad, hasta {MESES_F[mes - 1].toLowerCase()}</p></div>
              <span className="fact-res-v" style={{ fontSize: 15 }}>{money0(sinConciliarTotal)}</span>
            </div>
            <ChBarrasH
              rows={antiguedad.map((t) => ({
                label: t.label, valor: t.valor, color: t.color,
                texto: money0(t.valor),
                sub: t.cuantas ? t.cuantas + (t.cuantas === 1 ? " factura" : " facturas") : "ninguna",
              }))}
              vacio="Todas las facturas tienen al menos un cobro cargado." />
            {sinConciliarViejo.cuantas > 0 && (
              <p className="fact-aviso-viejo">
                {sinConciliarViejo.cuantas} {sinConciliarViejo.cuantas === 1 ? "factura lleva" : "facturas llevan"} más
                de 60 días sin un solo cobro anotado.
              </p>
            )}
            <p className="fact-nota-card">
              Es lo que falta conciliar, no lo que te deben: de una factura se cobra
              menos de lo que dice, porque descuentan retenciones.
            </p>
          </section>

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
  const [pagos, setPagos] = React.useState([]);
  const [periodos, setPeriodos] = React.useState([]);
  const [transferencias, setTransferencias] = React.useState([]);
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
      const [cs, ms, ps, pers, trs] = await Promise.all([
        window.DB.fact.companias.list(),
        window.DB.fact.mensual.list(),
        window.DB.fact.pagos.list(),
        window.DB.fact.periodo.list(),
        window.DB.fact.transferencias.list(),
      ]);
      setCompanias(cs); setMovs(ms); setPagos(ps); setPeriodos(pers); setTransferencias(trs);
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
  // Un cobro cambia el total del mes, pero ese total lo recalcula la base: por
  // eso se recarga en vez de tocar `movs` a mano. Si lo calculara acá, la
  // pantalla y la base podrían decir cosas distintas.
  const agregarPago = async (p) => {
    try {
      await window.DB.fact.pagos.create(p);
      await load();
      flash("Cobro agregado");
    } catch (e) { console.error(e); flash("No se pudo agregar el cobro", true); }
  };
  const borrarPago = async (p) => {
    if (!window.confirm("¿Borrar el cobro de " + money2(p.importe) + "?")) return;
    try {
      await window.DB.fact.pagos.remove(p.id);
      await load();
      flash("Cobro borrado");
    } catch (e) { console.error(e); flash("No se pudo borrar el cobro", true); }
  };

  const guardarPeriodo = async (p) => {
    try {
      const saved = await window.DB.fact.periodo.save(p);
      setPeriodos((prev) => {
        const i = prev.findIndex((x) => x.anio === saved.anio && x.mes === saved.mes);
        if (i >= 0) { const q = [...prev]; q[i] = saved; return q; }
        return [...prev, saved];
      });
      flash("Guardado");
    } catch (e) { console.error(e); flash("No se pudo guardar", true); }
  };

  const agregarTransferencia = async (t) => {
    try {
      const nueva = await window.DB.fact.transferencias.create(t);
      setTransferencias((p) => [...p, nueva]);
      flash("Transferencia registrada");
    } catch (e) { console.error(e); flash("No se pudo registrar", true); }
  };
  const borrarTransferencia = async (t) => {
    if (!window.confirm("¿Borrar la transferencia de " + money2(t.importe) + " a " + t.persona + "?")) return;
    try {
      await window.DB.fact.transferencias.remove(t.id);
      setTransferencias((p) => p.filter((x) => x.id !== t.id));
      flash("Transferencia borrada");
    } catch (e) { console.error(e); flash("No se pudo borrar", true); }
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
        : active === "fact-reparto"
        ? <RepartoView companias={visibles} movs={movs} pagos={pagos} anio={anio} mes={mes}
            periodos={periodos} transferencias={transferencias}
            onAnio={setAnio} onMes={setMes} onGuardarPeriodo={guardarPeriodo}
            onAgregarTransferencia={agregarTransferencia} onBorrarTransferencia={borrarTransferencia} />
        : active === "fact-companias"
        ? <CompaniasView companias={visibles} movs={movs}
            onNueva={() => setModal({ tipo: "cia" })}
            onEditar={(c) => setModal({ tipo: "cia", item: c })}
            onEliminar={eliminarCompania} />
        : <CargaMensual companias={activas} movs={movs} pagos={pagos} anio={anio} mes={mes}
            onAnio={setAnio} onMes={setMes} onGuardar={guardarMes} station={station}
            onVerCobros={(c, g) => setModal({ tipo: "cobros", cia: c, fila: g })} />}

      {modal?.tipo === "cia" && (
        <CompaniaForm initial={modal.item} onClose={() => setModal(null)} onSubmit={guardarCompania} />
      )}
      {modal?.tipo === "cobros" && (
        <CobrosModal
          compania={modal.cia}
          fila={movs.find((m) => m._dbId === modal.fila._dbId) || modal.fila}
          pagos={pagos.filter((p) => p.factId === modal.fila._dbId)}
          anio={anio} mes={mes}
          onAgregar={agregarPago} onBorrar={borrarPago}
          onClose={() => setModal(null)} />
      )}
      {toast && (
        <div className="toast">
          <span className="toast-ico" style={toast.err ? { background: "var(--peligro-fuerte)" } : null}><Ico name={toast.err ? "alert" : "check"} size={15} /></span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

Object.assign(window, { FacturacionModule, CargaMensual, CrecimientoAnual, CompaniasView, FactEstadisticas, CobrosModal, RepartoView,
  // Las dos de importes van expuestas para poder probarlas sin pantalla: son
  // plata, y el redondeo equivocado no avisa.
  parseMonto, fmtMonto });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
