// siniestralidad.jsx — Siniestralidad por asegurado
// ─────────────────────────────────────────────────────────────────────────────
// Para qué sirve: ver de un vistazo qué clientes concentran siniestros. Es el
// dato que se usa al renovar (¿conviene seguir con este riesgo?, ¿hay que
// avisarle a la compañía?) y el que hasta ahora no se podía sacar, porque el
// mismo cliente estaba cargado con el nombre escrito de tres maneras.
//
// Cómo se agrupa: por la FICHA del asegurado (`asegurado_id`), no por el texto
// del nombre. Un siniestro sin ficha —no debería quedar ninguno después del
// enganche, pero puede fallar al guardar— se agrupa por su nombre tal cual,
// para no perderlo de la cuenta.
//
// "Reincidente" = 2 o más siniestros en los últimos 12 meses, contados por la
// fecha de denuncia (o la del hecho si no hay). Es un umbral de trabajo, no una
// regla de ninguna compañía: si se quiere otro, se cambia SA_REINCIDENTE.
// ─────────────────────────────────────────────────────────────────────────────

const SA_REINCIDENTE = 2;

function saClave(s) {
  return s.aseguradoId ? "id:" + s.aseguradoId : "nom:" + String(s.cliente || "—").trim().toUpperCase();
}
// Sin tildes y en minúscula: "Pérez" se encuentra buscando "perez".
function saPlano(txt) {
  return String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function saEnUltimoAnio(iso) {
  const d = parseDate(iso);
  if (!d) return false;
  const hace = today0(); hace.setFullYear(hace.getFullYear() - 1);
  return d >= hace;
}
const saPlural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);

// Cuenta por una clave y lo deja listo para ChBarrasH, de mayor a menor.
function saContar(siniestros, claveDe, etiqueta, color) {
  const m = {};
  siniestros.forEach((s) => { const k = claveDe(s) || "—"; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .map(([k, n]) => ({ label: etiqueta(k), valor: n, texto: String(n), color }));
}

function saArmarGrupos(data, fichas) {
  const grupos = {};
  (data || []).forEach((s) => {
    const k = saClave(s);
    if (!grupos[k]) {
      const ficha = s.aseguradoId ? fichas[s.aseguradoId] : null;
      grupos[k] = { clave: k, ficha, nombre: (ficha && ficha.nombre) || s.cliente || "—",
                    documento: (ficha && ficha.documento) || "", siniestros: [] };
    }
    grupos[k].siniestros.push(s);
  });
  return Object.values(grupos).map((g) => {
    const fechas = g.siniestros.map((s) => estInicio(s)).filter(Boolean).sort();
    const ult12 = g.siniestros.filter((s) => saEnUltimoAnio(estInicio(s))).length;
    return {
      ...g,
      total: g.siniestros.length,
      ult12,
      abiertos: g.siniestros.filter((s) => s.estado !== "Terminado").length,
      primero: fechas[0] || null,
      ultimo: fechas[fechas.length - 1] || null,
      ramos: Array.from(new Set(g.siniestros.map((s) => s.ramo).filter(Boolean))),
      reincidente: ult12 >= SA_REINCIDENTE,
    };
  });
}

// ---------- la ficha de un asegurado ----------
function SaFicha({ grupo, onVolver, onOpen, onDocGuardado, onAviso }) {
  const [doc, setDoc] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const f = grupo.ficha;
  const ss = [...grupo.siniestros].sort((a, b) => String(estInicio(b) || "").localeCompare(String(estInicio(a) || "")));
  const cerrados = ss.map((s) => estDemora(s)).filter((d, i) => d != null && ss[i].estado === "Terminado");
  const demora = cerrados.length ? cerrados.reduce((a, b) => a + b, 0) / cerrados.length : null;

  const guardarDoc = async () => {
    if (!asegDocValido(doc)) return;
    setGuardando(true);
    try {
      const id = await window.DB.aseg.completarDocumento(f.id, doc.trim());
      if (id && id !== f.id) {
        onAviso && onAviso("Ese documento ya es de otra ficha: quedó para revisar en Asegurados duplicados", true);
      } else {
        onAviso && onAviso("DNI / CUIT guardado");
      }
      setDoc("");
      onDocGuardado && (await onDocGuardado());
    } catch (e) {
      console.error(e);
      onAviso && onAviso("No se pudo guardar el documento", true);
    }
    setGuardando(false);
  };

  const kpis = [
    { label: "Siniestros", value: grupo.total, hint: grupo.primero ? "desde " + fmtDate(grupo.primero) : "—", tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "shield" },
    { label: "Últimos 12 meses", value: grupo.ult12, hint: grupo.reincidente ? "reincidente" : "por fecha de denuncia", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "alert" },
    { label: "Abiertos", value: grupo.abiertos, hint: saPlural(grupo.total - grupo.abiertos, "terminado", "terminados"), tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "folder" },
    { label: "Demora promedio", value: estDias(demora), hint: saPlural(cerrados.length, "caso cerrado", "casos cerrados"), tone: { bg: "#E6F4EA", fg: "#15803D" }, icon: "clock" },
  ];

  const docMal = doc.trim() && !asegDocValido(doc);

  return (
    <div className="est-wrap">
      <button className="btn-ghost sm sa-volver" onClick={onVolver}>
        <Ico name="chevL" size={15} />Todos los asegurados
      </button>

      <div className="sa-cab">
        <span className="sa-cab-ico"><Ico name="user" size={20} /></span>
        <div className="sa-cab-txt">
          <h2>{grupo.nombre}</h2>
          <div className="sa-cab-datos">
            {grupo.documento
              ? <span className="mono">DNI / CUIT {grupo.documento}</span>
              : <span className="sa-sindoc">Sin DNI / CUIT</span>}
            {f && f.email && <span>{f.email}</span>}
            {f && f.telefono && <span>{f.telefono}</span>}
            {grupo.reincidente && <span className="sa-reinc">Reincidente</span>}
          </div>
          {f && f.notas && <p className="sa-notas">{f.notas}</p>}
        </div>
      </div>

      {/* Las fichas que salieron de los siniestros viejos no tienen documento.
          Cargarlo acá es lo que hace que la próxima carga la encuentre sola. */}
      {f && !grupo.documento && (
        <div className="sa-cargar-doc">
          <div className="sa-cargar-doc-txt">
            <b>Esta ficha no tiene documento.</b>
            <span>Cargalo para que la próxima vez se reconozca sola y no se duplique.</span>
          </div>
          <input className={"input mono" + (docMal ? " err" : "")} value={doc} placeholder="DNI o CUIT, sin puntos"
            inputMode="numeric" onChange={(e) => setDoc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardarDoc()} />
          <button className="btn-primary sm" disabled={!asegDocValido(doc) || guardando} onClick={guardarDoc}>
            <Ico name="check" size={15} />{guardando ? "Guardando…" : "Guardar"}
          </button>
          {docMal && <span className="aseg-aviso malo"><Ico name="alert" size={13} />Un DNI tiene 7 u 8 números; un CUIT, 11 con el verificador bien.</span>}
        </div>
      )}

      <div className="kpis">
        {kpis.map((c) => <KpiCard key={c.label} {...c} />)}
      </div>

      <div className="est-grid">
        <EstCard title="Por ramo">
          <ChBarrasH rows={saContar(ss, (s) => s.ramo, (k) => RAMO_LABEL[k] || k, CH_COLOR.azul)} />
        </EstCard>
        <EstCard title="Por hecho">
          <ChBarrasH rows={saContar(ss, (s) => s.hecho, (k) => HECHO_LABEL[k] || k, CH_COLOR.naranja)} />
        </EstCard>
        <EstCard title="Por compañía">
          <ChBarrasH rows={saContar(ss, (s) => s.cia, (k) => ciaLabel(k), CH_COLOR.violeta)} />
        </EstCard>
        <EstCard title="Por año" sub="según la fecha de denuncia">
          <ChBarrasH rows={saContar(ss, (s) => (estInicio(s) || "").slice(0, 4), (k) => k, CH_COLOR.celeste)
            .sort((a, b) => String(b.label).localeCompare(String(a.label)))} />
        </EstCard>

        <EstCard title="Sus siniestros" sub="del más reciente al más viejo · clic para abrir" className="est-card-wide">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Denuncia</th><th>N° de siniestro</th><th>Compañía</th><th>Ramo / Hecho</th><th>Referencia</th><th>Estado</th></tr></thead>
              <tbody>
                {ss.map((s) => (
                  <tr key={s.id} className="sa-fila" onClick={() => onOpen(s.id)}>
                    <td className="mono cell-sub">{fmtDate(estInicio(s))}</td>
                    <td className="mono">{s.nroSiniestro || s.id}</td>
                    <td><span className="cia-pill">{ciaLabel(s.cia)}</span></td>
                    <td><RamoTag ramo={s.ramo} hecho={s.hecho} /></td>
                    <td className="cell-sub">{s.referencia || "—"}</td>
                    <td><Badge estado={s.estado} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstCard>
      </div>
    </div>
  );
}

// ---------- pantalla ----------
function SiniestralidadView({ data, query, fichaSel, onFicha, onOpen, onAviso, onNav, rol }) {
  const [fichas, setFichas] = React.useState({});
  const [foco, setFoco] = React.useState(null);
  const [duplicados, setDuplicados] = React.useState(0);
  const hayDb = !!(window.DB && window.DB.configured() && window.DB.aseg);

  const cargarFichas = React.useCallback(async () => {
    if (!hayDb) return;
    try {
      const lista = await window.DB.aseg.list();
      const m = {}; lista.forEach((a) => { m[a.id] = a; });
      setFichas(m);
    } catch (e) { console.error(e); }
  }, [hayDb]);
  React.useEffect(() => { cargarFichas(); }, [cargarFichas]);

  // Los pares de fichas parecidas se revisan desde acá: es el lugar donde se
  // está mirando la siniestralidad de cada cliente, así que es donde importa
  // que dos fichas sean en realidad la misma persona. Solo un organizador
  // puede unificarlas, así que a un empleado ni se le menciona.
  React.useEffect(() => {
    if (!hayDb || rol !== "organizador") return;
    let vivo = true;
    (async () => {
      try {
        const pares = await window.DB.aseg.dup.list();
        if (vivo) setDuplicados(pares.length);
      } catch (e) { /* informativo: no vale romper la pantalla por esto */ }
    })();
    return () => { vivo = false; };
  }, [hayDb, rol]);

  const grupos = React.useMemo(() => saArmarGrupos(data, fichas), [data, fichas]);

  const abierto = fichaSel && grupos.find((g) => g.clave === fichaSel);
  if (abierto) {
    return <SaFicha grupo={abierto} onVolver={() => onFicha(null)} onOpen={onOpen}
      onDocGuardado={cargarFichas} onAviso={onAviso} />;
  }

  const FILTROS = {
    reincidentes: (g) => g.reincidente,
    abiertos: (g) => g.abiertos > 0,
    sindoc: (g) => !g.documento,
  };
  const q = saPlano(query).trim();
  const filas = grupos
    .filter((g) => !foco || FILTROS[foco](g))
    .filter((g) => !q || saPlano(g.nombre).includes(q) || saPlano(g.documento).includes(q))
    .sort((a, b) => b.ult12 - a.ult12 || b.total - a.total || a.nombre.localeCompare(b.nombre));

  const totalSin = grupos.reduce((n, g) => n + g.total, 0);
  const alternar = (k) => setFoco((f) => (f === k ? null : k));
  const kpis = [
    { key: "todos", label: "Asegurados con siniestros", value: grupos.length, hint: saPlural(totalSin, "siniestro activo", "siniestros activos"), tone: { bg: "#E8F0FE", fg: "#1D4ED8" }, icon: "user" },
    { key: "reincidentes", label: "Reincidentes", value: grupos.filter(FILTROS.reincidentes).length, hint: SA_REINCIDENTE + " o más en los últimos 12 meses", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "alert" },
    { key: "abiertos", label: "Con casos abiertos", value: grupos.filter(FILTROS.abiertos).length, hint: "al menos un siniestro abierto", tone: { bg: "#FEF3E2", fg: "#B45309" }, icon: "folder" },
    { key: "sindoc", label: "Sin DNI / CUIT", value: grupos.filter(FILTROS.sindoc).length, hint: "se carga desde la ficha", tone: { bg: "var(--surface-2)", fg: "var(--muted)" }, icon: "search" },
  ];

  return (
    <div className="est-wrap">
      {duplicados > 0 && onNav && (
        <div className="sa-dup-aviso">
          <span className="sa-dup-ico"><Ico name="search" size={17} /></span>
          <div className="sa-dup-txt">
            <b>{duplicados === 1 ? "Hay 1 par de fichas parecidas" : "Hay " + duplicados + " pares de fichas parecidas"}</b>
            <span>Pueden ser el mismo cliente cargado dos veces. Mientras estén separadas, su siniestralidad se cuenta partida.</span>
          </div>
          <button className="btn-ghost sm" onClick={() => onNav("asegurados-dup")}>Revisar</button>
        </div>
      )}

      <div className="kpis">
        {kpis.map((c) => (
          <KpiCard key={c.key} {...sinKey(c)}
            onClick={c.key === "todos" ? undefined : () => alternar(c.key)}
            activo={foco === c.key} />
        ))}
      </div>

      <div className="panel">
        <div className="sa-barra">
          <h3>{foco ? kpis.find((k) => k.key === foco).label : "Todos los asegurados"}</h3>
          <span className="cell-sub">{saPlural(filas.length, "asegurado", "asegurados")} · ordenados por siniestros de los últimos 12 meses</span>
        </div>
        {filas.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Asegurado</th>
                  <th style={{ textAlign: "center" }}>Últimos 12 meses</th>
                  <th style={{ textAlign: "center" }}>Total</th>
                  <th style={{ textAlign: "center" }}>Abiertos</th>
                  <th>Último siniestro</th>
                  <th>Ramos</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((g) => (
                  <tr key={g.clave} className="sa-fila" onClick={() => onFicha(g.clave)}>
                    <td>
                      <div className="cell-strong">
                        {g.nombre}
                        {g.reincidente && <span className="sa-reinc">Reincidente</span>}
                      </div>
                      <div className="cell-sub mono">{g.documento || <span className="sa-sindoc">Sin DNI / CUIT</span>}</div>
                    </td>
                    <td style={{ textAlign: "center" }}><b className="mono">{g.ult12}</b></td>
                    <td style={{ textAlign: "center" }} className="mono">{g.total}</td>
                    <td style={{ textAlign: "center" }} className="mono">{g.abiertos || "—"}</td>
                    <td className="mono cell-sub">{fmtDate(g.ultimo)}</td>
                    <td className="cell-sub">{g.ramos.map((r) => RAMO_LABEL[r] || r).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ch-vacio">{grupos.length ? "Ningún asegurado coincide con el filtro" : "Todavía no hay siniestros cargados"}</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SiniestralidadView });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
