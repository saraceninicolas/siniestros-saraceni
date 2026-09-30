// inicio.jsx — La pantalla principal: qué hay que hacer hoy, y quién es quién
// ─────────────────────────────────────────────────────────────────────────────
// Antes el portal abría en el panel de siniestros. Eso está bien para quien
// gestiona siniestros todo el día, pero deja afuera lo demás: una renovación
// que vence, un pendiente atrasado, una cotización sin responder. Cada cosa
// vivía en su carpeta y había que ir a buscarla.
//
// Esta pantalla junta las puntas sueltas de todos los módulos en una sola
// lista ordenada por fecha, con lo vencido arriba. Es la respuesta a "¿qué
// tengo que hacer hoy?", que es la primera pregunta de la mañana.
//
// ⚠️ Respeta los módulos que contrató la empresa. Un broker que compró solo
// Siniestros no puede ver una tarjeta de Facturación, ni siquiera vacía: sería
// venderle por la ventana algo que no tiene. `tieneModulo` decide cada bloque.
// Igual que en el menú, `modulos` en null significa "no sabemos" y se muestra
// todo: las policies son las que frenan de verdad.
//
// La búsqueda de clientes NO tiene tabla propia. Sale de lo que ya hay
// cargado: las fichas de asegurado, los siniestros y las renovaciones. Por eso
// un cliente que nunca tuvo un siniestro ni una póliza por vencer no aparece;
// el día que exista una cartera de verdad, esta función se cambia por ella y
// el resto de la pantalla no se entera.
// ─────────────────────────────────────────────────────────────────────────────

// Sin tildes y en minúsculas, para que "Pérez" lo encuentre quien escribe
// "perez" con el apuro de atender el teléfono.
function iniNorm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Cuántos días faltan, en texto corto, con el signo que importa: lo vencido
// tiene que leerse distinto de lo que falta.
function iniCuando(iso) {
  const du = daysUntil(iso);
  if (du == null) return { txt: "sin fecha", urg: "ninguna" };
  if (du < 0) return { txt: `hace ${Math.abs(du)} d`, urg: "vencido" };
  if (du === 0) return { txt: "hoy", urg: "hoy" };
  if (du === 1) return { txt: "mañana", urg: "proximo" };
  if (du <= 3) return { txt: `en ${du} d`, urg: "proximo" };
  return { txt: `en ${du} d`, urg: "normal" };
}

// ---------- tarjetas de arriba ----------
function IniKpi({ icono, valor, label, tono, onClick }) {
  return (
    <button className={"ini-kpi" + (tono ? " is-" + tono : "")} onClick={onClick}>
      <span className="ini-kpi-ico"><Ico name={icono} size={17} /></span>
      <span className="ini-kpi-valor">{valor}</span>
      <span className="ini-kpi-label">{label}</span>
    </button>
  );
}

// ---------- una línea de "para hoy" ----------
function IniTarea({ t }) {
  const u = URGENCIA[t.urg] || URGENCIA.normal;
  return (
    <button className="ini-tarea" onClick={t.onClick}>
      <span className="ini-tarea-dot" style={{ background: u.dot }} />
      <span className="ini-tarea-ico"><Ico name={t.icono} size={15} /></span>
      <span className="ini-tarea-txt">
        <span className="ini-tarea-tit">{t.titulo}</span>
        <span className="ini-tarea-sub">{t.sub}</span>
      </span>
      <span className="ini-tarea-cuando" style={{ color: u.fg, background: u.bg }}>{t.cuando}</span>
    </button>
  );
}

// ---------- la ficha de un cliente, armada al vuelo ----------
function IniCliente({ c, abierto, onToggle, onOpenSiniestro, onNav }) {
  return (
    <div className={"ini-cli" + (abierto ? " is-open" : "")}>
      <button className="ini-cli-head" onClick={onToggle}>
        <span className="ini-cli-ini">{(c.nombre || "?").slice(0, 1).toUpperCase()}</span>
        <span className="ini-cli-txt">
          <span className="ini-cli-nom">{c.nombre}</span>
          <span className="ini-cli-sub">
            {c.documento ? "Doc. " + c.documento : "sin documento"}
            {c.telefono ? " · " + c.telefono : ""}
          </span>
        </span>
        <span className="ini-cli-chips">
          {c.abiertos > 0 && <span className="ini-chip is-warn">{c.abiertos} abierto{c.abiertos > 1 ? "s" : ""}</span>}
          {c.siniestros.length > 0 && <span className="ini-chip">{c.siniestros.length} siniestro{c.siniestros.length > 1 ? "s" : ""}</span>}
          {c.polizas.length > 0 && <span className="ini-chip">{c.polizas.length} póliza{c.polizas.length > 1 ? "s" : ""}</span>}
        </span>
        <span className="ini-cli-chev"><Ico name="chevR" size={15} /></span>
      </button>

      {abierto && (
        <div className="ini-cli-body">
          {c.siniestros.length > 0 && (
            <div className="ini-cli-bloque">
              <div className="ini-cli-lbl">Siniestros</div>
              {c.siniestros.map((s) => (
                <button key={s.id} className="ini-cli-fila" onClick={() => onOpenSiniestro && onOpenSiniestro(s.id)}>
                  <span className="ini-cli-fila-id">{s.id}</span>
                  <span className="ini-cli-fila-txt">{ciaLabel(s.cia)} · {RAMO_LABEL[s.ramo] || s.ramo}</span>
                  <span className={"ini-est ini-est-" + (s.estado === "Abierto" ? "abierto" : "cerrado")}>{s.estado}</span>
                </button>
              ))}
            </div>
          )}
          {c.polizas.length > 0 && (
            <div className="ini-cli-bloque">
              <div className="ini-cli-lbl">Pólizas próximas a renovar</div>
              {c.polizas.map((p) => (
                <button key={p._dbId} className="ini-cli-fila" onClick={() => onNav && onNav("renov-proximas")}>
                  <span className="ini-cli-fila-id">{p.poliza || p.id}</span>
                  <span className="ini-cli-fila-txt">{p.aseguradora} · {p.seccion}</span>
                  <span className="ini-cli-fila-fecha">vence {fmtDateShort(p.finVig)}</span>
                </button>
              ))}
            </div>
          )}
          {c.siniestros.length === 0 && c.polizas.length === 0 && (
            <div className="ini-vacio-chico">De este cliente todavía no hay nada cargado.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- el mes, con todo lo que tiene fecha ----------
// Reusa el calculo de semanas del calendario grande (calendar.jsx): la
// matematica de los meses se escribe una vez. Lo que cambia es que este mira
// TODO lo que vence —gestiones, pendientes y renovaciones— y no solo los
// siniestros, porque esta pantalla es la del broker entero.
const INI_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const INI_DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const INI_TIPOS = {
  siniestro:  { icon: "shield",  color: "var(--brand)" },
  pendiente:  { icon: "flag",    color: "var(--warn-fuerte)" },
  renovacion: { icon: "refresh", color: "var(--info-3)" },
};

function IniCalendario({ eventos, onAbrir }) {
  const hoy = today0();
  const hoyISO = calISO(hoy);
  const [cursor, setCursor] = React.useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [dia, setDia] = React.useState(hoyISO);

  const porDia = React.useMemo(() => {
    const m = {};
    eventos.forEach((e) => { if (e.iso) (m[e.iso] = m[e.iso] || []).push(e); });
    return m;
  }, [eventos]);

  const semanas = calSemanas(cursor.anio, cursor.mes);
  const mover = (n) => {
    const f = new Date(cursor.anio, cursor.mes + n, 1);
    setCursor({ anio: f.getFullYear(), mes: f.getMonth() });
  };
  const delDia = porDia[dia] || [];

  return (
    <div className="ini-cal">
      <div className="ini-cal-barra">
        <span className="ini-cal-mes">{INI_MESES[cursor.mes]} {cursor.anio}</span>
        <div className="ini-cal-nav">
          <button className="row-open" onClick={() => mover(-1)} aria-label="Mes anterior"><Ico name="chevL" size={15} /></button>
          <button className="btn-ghost sm" onClick={() => { setCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() }); setDia(hoyISO); }}>Hoy</button>
          <button className="row-open" onClick={() => mover(1)} aria-label="Mes siguiente"><Ico name="chevR" size={15} /></button>
        </div>
      </div>
      <div className="ini-cal-grilla">
        {INI_DIAS.map((d) => <div className="ini-cal-dia-lbl" key={d}>{d}</div>)}
        {semanas.flat().map((c) => {
          const evs = porDia[c.iso] || [];
          return (
            <button key={c.iso}
              className={"ini-cal-celda" + (c.otroMes ? " es-otro" : "") + (c.iso === hoyISO ? " es-hoy" : "") + (c.iso === dia ? " es-sel" : "")}
              onClick={() => {
                setDia(c.iso);
                if (c.otroMes) { const f = parseDate(c.iso); setCursor({ anio: f.getFullYear(), mes: f.getMonth() }); }
              }}>
              <span className="ini-cal-num">{Number(c.iso.slice(8, 10))}</span>
              {evs.length > 0 && (
                <span className="ini-cal-puntos">
                  {evs.slice(0, 3).map((e, i) => (
                    <span key={i} className="ini-cal-punto" style={{ background: (INI_TIPOS[e.tipo] || {}).color }} />
                  ))}
                  {evs.length > 3 && <span className="ini-cal-mas">+{evs.length - 3}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="ini-cal-panel">
        <div className="ini-cal-panel-tit">{calDiaLargo(dia)}</div>
        {delDia.length === 0
          ? <div className="ini-vacio-chico">Sin vencimientos ese día.</div>
          : delDia.map((e, i) => (
              <button key={i} className="ini-cal-ev" onClick={() => e.onClick && e.onClick()}>
                <span className="ini-cal-ev-ico" style={{ color: (INI_TIPOS[e.tipo] || {}).color }}>
                  <Ico name={(INI_TIPOS[e.tipo] || {}).icon || "agenda"} size={14} />
                </span>
                <span className="ini-cal-ev-txt">
                  <span className="ini-cal-ev-tit">{e.titulo}</span>
                  <span className="ini-cal-ev-sub">{e.sub}</span>
                </span>
                {e.gcal && (
                  <a className="ini-cal-ev-gcal" href={e.gcal} target="_blank" rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()} title="Agendar en Google Calendar">
                    <Ico name="agenda" size={13} />
                  </a>
                )}
              </button>
            ))}
      </div>
    </div>
  );
}

function InicioView({ siniestros, solicitudes, modulos, quien, usuarios, onNav, onOpenSiniestro }) {
  const tieneModulo = React.useCallback((m) => !modulos || modulos.includes(m), [modulos]);
  const [renov, setRenov] = React.useState([]);
  const [pend, setPend] = React.useState([]);
  const [cots, setCots] = React.useState([]);
  const [fichas, setFichas] = React.useState([]);
  const [acciones, setAcciones] = React.useState([]);
  const [q, setQ] = React.useState("");
  const [cliAbierto, setCliAbierto] = React.useState(null);

  // Cada módulo se pide solo si la empresa lo tiene. Si algo falla, esa lista
  // queda vacía y la pantalla sigue: un error de red en renovaciones no puede
  // dejar sin panel a quien entra a ver sus siniestros.
  React.useEffect(() => {
    let vivo = true;
    const DB = window.DB;
    if (!DB || !DB.configured()) return;
    const pedir = async (cond, fn, set) => {
      // Sin el módulo se vacía, no se deja lo de antes: `modulos` llega
      // despues del primer dibujo, y entre medio se pidio todo.
      if (!cond) { set([]); return; }
      try { const d = await fn(); if (vivo) set(d || []); }
      catch (e) { console.error("Inicio:", e); }
    };
    pedir(tieneModulo("renovaciones"), DB.renov.list, setRenov);
    pedir(tieneModulo("pendientes"), DB.pend.list, setPend);
    pedir(tieneModulo("comercial"), DB.cot.list, setCots);
    pedir(tieneModulo("siniestros"), DB.aseg.list, setFichas);
    // Lo que hizo el equipo. La policy ya decide qué puede ver cada uno.
    pedir(true, () => (DB.acc ? DB.acc.list() : []), setAcciones);
    return () => { vivo = false; };
  }, [tieneModulo]);

  const activos = React.useMemo(() => (siniestros || []).filter((s) => !s.eliminado), [siniestros]);
  const abiertos = React.useMemo(() => activos.filter((s) => s.estado === "Abierto"), [activos]);
  const solNuevas = React.useMemo(() => (solicitudes || []).filter((s) => s.estado === "nueva"), [solicitudes]);
  const cotNuevas = React.useMemo(() => cots.filter((c) => c.estado === "nueva"), [cots]);
  const renovVivas = React.useMemo(
    () => renov.filter((r) => r.estado !== "Renovada" && r.estado !== "No renueva" && r.finVig),
    [renov]);
  const pendVivos = React.useMemo(() => pend.filter((p) => p.estado !== "Terminado"), [pend]);

  // ---- lo que hay que hacer ----
  // Todo junto y ordenado por fecha: es el orden en que lo va a hacer una
  // persona, no el orden en que está guardado.
  const tareas = React.useMemo(() => {
    const out = [];
    if (tieneModulo("siniestros")) {
      abiertos.forEach((s) => {
        const u = urgenciaDe(s);
        if (u !== "vencido" && u !== "hoy" && u !== "proximo") return;
        const c = iniCuando(s.fechaLimite);
        out.push({
          clave: "sin-" + s.id, fecha: s.fechaLimite, urg: c.urg, cuando: c.txt, icono: "shield",
          titulo: s.cliente, sub: `${s.id} · ${s.gestionAR || "Gestión sin detalle"}`,
          onClick: () => onOpenSiniestro && onOpenSiniestro(s.id),
        });
      });
    }
    if (tieneModulo("pendientes")) {
      pendVivos.forEach((p) => {
        const du = daysUntil(p.fechaLimite);
        if (du == null || du > 3) return;
        const c = iniCuando(p.fechaLimite);
        out.push({
          clave: "pen-" + p.id, fecha: p.fechaLimite, urg: c.urg, cuando: c.txt, icono: "flag",
          titulo: p.titulo, sub: (p.cliente ? p.cliente + " · " : "") + (p.asignado || "sin asignar"),
          onClick: () => onNav("pend-agenda"),
        });
      });
    }
    if (tieneModulo("renovaciones")) {
      renovVivas.forEach((r) => {
        const du = daysUntil(r.finVig);
        if (du == null || du > 15) return;
        const c = iniCuando(r.finVig);
        out.push({
          clave: "ren-" + r.id, fecha: r.finVig, urg: c.urg, cuando: c.txt, icono: "refresh",
          titulo: r.cliente, sub: `${r.aseguradora || "—"} · ${r.seccion || "póliza"} ${r.poliza || ""}`.trim(),
          onClick: () => onNav("renov-proximas"),
        });
      });
    }
    return out.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [abiertos, pendVivos, renovVivas, tieneModulo, onNav, onOpenSiniestro]);

  // ---- lo que llegó solo y espera respuesta ----
  const entradas = React.useMemo(() => {
    const out = [];
    if (tieneModulo("siniestros")) {
      solNuevas.forEach((s) => out.push({
        clave: "sol-" + s.id, icono: "mail", titulo: s.nombre || "Denuncia sin nombre",
        sub: `Denuncia web · ${s.ramo || "sin ramo"}`, cuando: s.creado ? fmtTimeAgo(s.creado) : "",
        onClick: () => onNav("solicitudes"),
      }));
    }
    if (tieneModulo("comercial")) {
      cotNuevas.forEach((c) => out.push({
        clave: "cot-" + c.id, icono: "home", titulo: c.nombre || "Interesado sin nombre",
        sub: `Cotización de hogar · ${c.localidad || "sin localidad"}`, cuando: c.creado ? fmtTimeAgo(c.creado) : "",
        onClick: () => onNav("com-cotizaciones"),
      }));
    }
    return out;
  }, [solNuevas, cotNuevas, tieneModulo, onNav]);

  // ---- los clientes, armados con lo que ya hay ----
  const clientes = React.useMemo(() => {
    const mapa = new Map();
    const tomar = (nombre) => {
      const k = iniNorm(nombre);
      if (!k) return null;
      if (!mapa.has(k)) mapa.set(k, { clave: k, nombre: nombre, documento: "", telefono: "", email: "", siniestros: [], polizas: [], abiertos: 0 });
      return mapa.get(k);
    };
    // La ficha manda para los datos de contacto: es la única que los tiene.
    fichas.forEach((f) => {
      const c = tomar(f.nombre);
      if (!c) return;
      c.documento = f.documento || c.documento;
      c.telefono = f.telefono || c.telefono;
      c.email = f.email || c.email;
    });
    activos.forEach((s) => {
      const c = tomar(s.cliente);
      if (!c) return;
      c.siniestros.push(s);
      if (s.estado === "Abierto") c.abiertos += 1;
    });
    renovVivas.forEach((r) => {
      const c = tomar(r.cliente);
      if (c) c.polizas.push(r);
    });
    return [...mapa.values()].sort((a, b) => b.abiertos - a.abiertos || a.nombre.localeCompare(b.nombre));
  }, [fichas, activos, renovVivas]);

  const clientesFiltrados = React.useMemo(() => {
    const t = iniNorm(q);
    if (!t) return clientes.slice(0, 6);
    return clientes.filter((c) => iniNorm(c.nombre).includes(t) || iniNorm(c.documento).includes(t)).slice(0, 30);
  }, [clientes, q]);

  // ---- lo que tiene fecha, para el calendario ----
  const eventos = React.useMemo(() => {
    const out = [];
    if (tieneModulo("siniestros")) abiertos.forEach((sn) => {
      if (!sn.fechaLimite) return;
      out.push({ iso: sn.fechaLimite, tipo: "siniestro", titulo: sn.cliente,
        sub: `${sn.id} · ${sn.gestionAR || "Gestión"}`,
        gcal: window.gcalUrl ? window.gcalUrl(sn) : null,
        onClick: () => onOpenSiniestro && onOpenSiniestro(sn.id) });
    });
    if (tieneModulo("pendientes")) pendVivos.forEach((pd) => {
      if (!pd.fechaLimite) return;
      out.push({ iso: pd.fechaLimite, tipo: "pendiente", titulo: pd.titulo,
        sub: (pd.cliente ? pd.cliente + " · " : "") + (pd.asignado || "sin asignar"),
        onClick: () => onNav("pend-agenda") });
    });
    if (tieneModulo("renovaciones")) renovVivas.forEach((rn) => {
      out.push({ iso: rn.finVig, tipo: "renovacion", titulo: rn.cliente,
        sub: `${rn.aseguradora || "—"} · ${rn.seccion || "póliza"}`,
        onClick: () => onNav("renov-proximas") });
    });
    return out;
  }, [abiertos, pendVivos, renovVivas, tieneModulo, onNav, onOpenSiniestro]);

  // ---- quién tiene qué encima ----
  // Los tres módulos guardan el responsable distinto (un id, un nombre, un
  // mail), así que se normaliza acá y no en cada tarjeta.
  const nombreDe = React.useCallback((u) => {
    if (!u) return null;
    const x = (usuarios || []).find((y) => y.id === u || y.email === u);
    return x ? (x.nombre || x.email) : String(u);
  }, [usuarios]);

  const equipo = React.useMemo(() => {
    const m = {};
    const sumar = (quienEs, cuanto) => {
      const k = quienEs || "Sin asignar";
      m[k] = (m[k] || 0) + cuanto;
    };
    abiertos.forEach((sn) => sumar(nombreDe(sn.asignadoA), 1));
    pendVivos.forEach((pd) => sumar(nombreDe(pd.asignadoA) || pd.asignado, 1));
    cots.filter((c) => ["nueva", "cotizada"].includes(c.estado))
        .forEach((c) => sumar(nombreDe(c.responsable), 1));
    return Object.entries(m)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [abiertos, pendVivos, cots, nombreDe]);

  // ---- de dónde viene el trabajo ----
  // Por ramo y no por compañía ni por responsable: es lo único que significa lo
  // mismo en un siniestro y en una cotización, así que la torta suma peras con
  // peras. Por responsable ya está el bloque de al lado.
  const porRamo = React.useMemo(() => {
    const m = {};
    if (tieneModulo("siniestros")) abiertos.forEach((sn) => {
      const r = sn.ramo || "OTRO"; m[r] = (m[r] || 0) + 1;
    });
    if (tieneModulo("comercial")) cots.filter((c) => ["nueva", "cotizada"].includes(c.estado))
      .forEach((c) => { const r = c.ramo || "OTRO"; m[r] = (m[r] || 0) + 1; });
    const paleta = (window.CH_COLOR || ["var(--brand)"]);
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([r, v], i) => ({ nombre: RAMO_LABEL[r] || r, valor: v, color: paleta[i % paleta.length] }));
  }, [abiertos, cots, tieneModulo]);

  // ---- lo último que hizo el equipo ----
  const actividad = React.useMemo(() => {
    const nombreCot = {};
    cots.forEach((c) => { nombreCot[c._dbId] = c.nombre; });
    return (acciones || []).slice(0, 8).map((a) => ({
      id: a.id,
      quien: nombreDe(a.usuario) || a.usuario,
      que: (window.accTipo ? window.accTipo(a.tipo).label : a.tipo),
      donde: a.cotizacionId ? (nombreCot[a.cotizacionId] || "una cotización") : "un objetivo",
      nota: a.nota, cuando: fmtTimeAgo(a.fecha),
      onClick: () => onNav(a.cotizacionId ? "com-seguimiento" : "obj-metas"),
    }));
  }, [acciones, cots, nombreDe, onNav]);

  const hoy = new Date();
  // Del mail sale el nombre; la mayuscula se la ponemos acá y no en el CSS.
  const nombreCorto = String(quien || "").split("@")[0].replace(/^./, (x) => x.toUpperCase());
  const saludo = hoy.getHours() < 13 ? "Buen día" : hoy.getHours() < 20 ? "Buenas tardes" : "Buenas noches";
  const fechaLarga = `${hoy.getDate()} de ${["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][hoy.getMonth()]}`;
  const vencidas = tareas.filter((t) => t.urg === "vencido").length;

  return (
    <div className="ini">
      <div className="ini-head">
        <div>
          <h1 className="ini-titulo">{saludo}, {nombreCorto}</h1>
          <p className="ini-fecha">{fechaLarga} · {tareas.length === 0 && entradas.length === 0
            ? "no hay nada urgente"
            : `${tareas.length} para atender${vencidas ? `, ${vencidas} vencida${vencidas > 1 ? "s" : ""}` : ""}`}</p>
        </div>
      </div>

      <div className="ini-kpis">
        {tieneModulo("siniestros") && <IniKpi icono="shield" valor={abiertos.length} label="Siniestros abiertos" onClick={() => onNav("dashboard")} />}
        {tieneModulo("siniestros") && <IniKpi icono="agenda" valor={abiertos.filter((s) => ["vencido", "hoy"].includes(urgenciaDe(s))).length}
          label="Gestiones para hoy" tono="warn" onClick={() => onNav("agenda")} />}
        {tieneModulo("siniestros") && <IniKpi icono="mail" valor={solNuevas.length} label="Denuncias nuevas" onClick={() => onNav("solicitudes")} />}
        {tieneModulo("renovaciones") && <IniKpi icono="refresh" valor={renovVivas.filter((r) => { const d = daysUntil(r.finVig); return d != null && d <= 30; }).length}
          label="Renovaciones del mes" onClick={() => onNav("renov-proximas")} />}
        {tieneModulo("pendientes") && <IniKpi icono="flag" valor={pendVivos.filter((p) => { const d = daysUntil(p.fechaLimite); return d != null && d <= 0; }).length}
          label="Pendientes vencidos" tono="warn" onClick={() => onNav("pend-agenda")} />}
        {tieneModulo("comercial") && <IniKpi icono="home" valor={cotNuevas.length} label="Cotizaciones nuevas" onClick={() => onNav("com-cotizaciones")} />}
      </div>

      <section className="ini-caja">
        <div className="ini-caja-head">
          <h2>El mes</h2>
          <span className="ini-caja-sub">gestiones, pendientes y renovaciones, cada uno en su fecha</span>
        </div>
        <IniCalendario eventos={eventos} />
      </section>

      <div className="ini-cols">
        <section className="ini-caja">
          <div className="ini-caja-head">
            <h2>Para atender</h2>
            <span className="ini-caja-sub">vencido y por vencer, de todas las carpetas</span>
          </div>
          {tareas.length === 0
            ? <div className="ini-vacio"><Ico name="check" size={22} /><span>Nada vencido ni por vencer. Buen momento para adelantar.</span></div>
            : <div className="ini-lista">{tareas.slice(0, 12).map((t) => <IniTarea key={t.clave} t={t} />)}</div>}
          {tareas.length > 12 && <div className="ini-mas">y {tareas.length - 12} más</div>}
        </section>

        <section className="ini-caja">
          <div className="ini-caja-head">
            <h2>Llegó solo</h2>
            <span className="ini-caja-sub">lo que cargaron los clientes y espera respuesta</span>
          </div>
          {entradas.length === 0
            ? <div className="ini-vacio"><Ico name="mail" size={22} /><span>Sin novedades sin responder.</span></div>
            : <div className="ini-lista">
                {entradas.slice(0, 8).map((e) => (
                  <button key={e.clave} className="ini-tarea" onClick={e.onClick}>
                    <span className="ini-tarea-dot" style={{ background: "var(--info-3)" }} />
                    <span className="ini-tarea-ico"><Ico name={e.icono} size={15} /></span>
                    <span className="ini-tarea-txt">
                      <span className="ini-tarea-tit">{e.titulo}</span>
                      <span className="ini-tarea-sub">{e.sub}</span>
                    </span>
                    <span className="ini-tarea-cuando">{e.cuando}</span>
                  </button>
                ))}
              </div>}
        </section>
      </div>

      <div className="ini-cols">
        <section className="ini-caja">
          <div className="ini-caja-head">
            <h2>Quién tiene qué</h2>
            <span className="ini-caja-sub">siniestros abiertos, pendientes y cotizaciones en gestión</span>
          </div>
          <div className="ini-caja-cuerpo">
            <ChBarrasH rows={equipo} vacio="Todavía no hay nada asignado." />
          </div>
        </section>

        <section className="ini-caja">
          <div className="ini-caja-head">
            <h2>De dónde viene el trabajo</h2>
            <span className="ini-caja-sub">por ramo, sumando siniestros y cotizaciones</span>
          </div>
          <div className="ini-caja-cuerpo ini-dona">
            {porRamo.length === 0
              ? <div className="ini-vacio-chico">Sin datos todavía.</div>
              : <>
                  <ChDona items={porRamo} centro={<>
                    <tspan className="ch-dona-num" x="50%" dy="-2">{porRamo.reduce((a, r) => a + r.valor, 0)}</tspan>
                    <tspan className="ch-dona-lbl" x="50%" dy="16">en curso</tspan>
                  </>} />
                  <ChLeyenda series={porRamo.map((r) => ({ nombre: r.nombre + " · " + r.valor, color: r.color }))} />
                </>}
          </div>
        </section>
      </div>

      <section className="ini-caja">
        <div className="ini-caja-head">
          <h2>Lo último que hizo el equipo</h2>
          <span className="ini-caja-sub">llamados, cotizaciones, cierres y avances, con nombre y hora</span>
        </div>
        {actividad.length === 0
          ? <div className="ini-vacio"><Ico name="agenda" size={22} /><span>Todavía no hay movimientos anotados.</span></div>
          : <div className="ini-lista">
              {actividad.map((a) => (
                <button key={a.id} className="ini-tarea" onClick={a.onClick}>
                  <span className="ini-tarea-dot" style={{ background: "var(--brand)" }} />
                  <span className="ini-tarea-ico"><Ico name="check" size={15} /></span>
                  <span className="ini-tarea-txt">
                    <span className="ini-tarea-tit">{a.quien} · {a.que} en {a.donde}</span>
                    <span className="ini-tarea-sub">{a.nota || "sin nota"}</span>
                  </span>
                  <span className="ini-tarea-cuando">{a.cuando}</span>
                </button>
              ))}
            </div>}
      </section>

      <section className="ini-caja">
        <div className="ini-caja-head">
          <h2>Clientes</h2>
          <span className="ini-caja-sub">buscá por nombre o documento y mirá todo lo suyo</span>
        </div>
        <div className="ini-buscador">
          <Ico name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o documento…" />
          {q && <button className="ini-limpiar" onClick={() => setQ("")}><Ico name="close" size={14} /></button>}
        </div>
        {clientesFiltrados.length === 0
          ? <div className="ini-vacio"><Ico name="user" size={22} /><span>{q ? "Ningún cliente con ese nombre o documento." : "Todavía no hay clientes cargados."}</span></div>
          : <div className="ini-clis">
              {clientesFiltrados.map((c) => (
                <IniCliente key={c.clave} c={c} abierto={cliAbierto === c.clave}
                  onToggle={() => setCliAbierto(cliAbierto === c.clave ? null : c.clave)}
                  onOpenSiniestro={onOpenSiniestro} onNav={onNav} />
              ))}
            </div>}
        {!q && clientes.length > clientesFiltrados.length && (
          <div className="ini-mas">{clientes.length} clientes en total · escribí arriba para encontrar uno</div>
        )}
      </section>
    </div>
  );
}

Object.assign(window, { InicioView, iniNorm, iniCuando });

// Marca este archivo como modulo ES (ver el comentario de data.jsx).
export {};
