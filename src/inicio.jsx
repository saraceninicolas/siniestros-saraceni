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

function InicioView({ siniestros, solicitudes, modulos, quien, onNav, onOpenSiniestro }) {
  const tieneModulo = React.useCallback((m) => !modulos || modulos.includes(m), [modulos]);
  const [renov, setRenov] = React.useState([]);
  const [pend, setPend] = React.useState([]);
  const [cots, setCots] = React.useState([]);
  const [fichas, setFichas] = React.useState([]);
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
