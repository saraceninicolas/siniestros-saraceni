// solicitudes.jsx — Saraceni Seguros · Bandeja de solicitudes públicas de siniestro
// Los asegurados cargan sus denuncias en /denuncia (sin login); acá se reciben,
// se revisan y se convierten en siniestros reales con un clic.

// Tipos de siniestro que puede elegir el asegurado en /denuncia, y a qué
// "hecho" del portal corresponde cada uno al convertir la solicitud.
const TIPO_SOL_LABEL = {
  CHOQUE: "Choque / daños con otro vehículo", DANIO_PROPIO: "Daño propio (sin terceros)",
  CRISTALES: "Cristales", ROBO_RUEDAS: "Robo de ruedas", ROBO_TOTAL: "Robo total",
  GRANIZO: "Granizo", INCENDIO: "Incendio", ROBO: "Robo", AGUA: "Daños por agua",
  ELECTRICO: "Daños eléctricos", RC: "Daños a terceros",
};
const TIPO_SOL_HECHO = {
  CHOQUE: "DAÑO PARCIAL", DANIO_PROPIO: "DAÑO PARCIAL", CRISTALES: "CRISTAL",
  ROBO_RUEDAS: "DAÑO PARCIAL", ROBO_TOTAL: "ROBO TOTAL", GRANIZO: "GRANIZO",
  INCENDIO: "INCENDIO", ROBO: "ROBO TOTAL", AGUA: "DAÑO PARCIAL",
  ELECTRICO: "DAÑO PARCIAL", RC: "RC",
};

const SOL_ESTADO = {
  "nueva":      { fg: "#B91C1C", bg: "#FBE3E3", t: "Nueva" },
  "procesada":  { fg: "#15803D", bg: "#E6F4EA", t: "Procesada" },
  "descartada": { fg: "#475569", bg: "#EEF1F4", t: "Descartada" },
};
function solBadge(estado) {
  const c = SOL_ESTADO[estado] || SOL_ESTADO.nueva;
  return <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 12 }}><span className="badge-dot" style={{ background: c.fg }} />{c.t}</span>;
}

function SolCard({ s, onConvertir, onDescartar, onReabrir }) {
  const [urls, setUrls] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.DB || !window.DB.files || !(s.adjuntos || []).length) return;
      const m = {};
      for (const a of s.adjuntos) { try { m[a.path] = await window.DB.files.signedUrl(a.path, 3600, "solicitudes"); } catch (e) { /* noop */ } }
      if (alive) setUrls(m);
    })();
    return () => { alive = false; };
  }, [s._dbId]);

  const nueva = s.estado === "nueva";
  const D = ({ k, v, mono }) => (v ? <div><div className="sol-k">{k}</div><div className={"sol-v" + (mono ? " mono" : "")}>{v}</div></div> : null);
  return (
    <div className={"sol-card" + (nueva ? " nueva" : "")}>
      <div className="sol-head">
        <div>
          <div className="sol-name">{s.nombre}</div>
          <div className="sol-meta mono">{s.id} · ref {s.ref}{s.creado ? " · recibida " + fmtTimeAgo(s.creado) : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {solBadge(s.estado)}
          {s.estado === "procesada" && s.siniestroCodigo && <span className="cia-pill sm mono">→ {s.siniestroCodigo}</span>}
        </div>
      </div>

      <div className="sol-sub">Asegurado</div>
      <div className="sol-grid-datos">
        <D k="DNI / CUIT" v={s.dniCuit} mono />
        <D k="Patente" v={s.dominio} mono />
        <D k="Compañía" v={s.cia} />
        <D k="N° de póliza" v={s.poliza} mono />
        <D k="Teléfono" v={s.telefono} mono />
        <D k="Email" v={s.email} />
      </div>

      {(s.terceroNombre || s.terceroDni || s.terceroDominio || s.terceroCia || s.terceroPoliza) && (
        <>
          <div className="sol-sub">Tercero</div>
          <div className="sol-grid-datos">
            <D k="Nombre" v={s.terceroNombre} />
            <D k="DNI / CUIT" v={s.terceroDni} mono />
            <D k="Celular" v={s.terceroCelular} mono />
            <D k="Patente" v={s.terceroDominio} mono />
            <D k="Compañía" v={s.terceroCia} />
            <D k="N° de póliza" v={s.terceroPoliza} mono />
          </div>
        </>
      )}

      <div className="sol-sub">Siniestro</div>
      <div className="sol-grid-datos">
        <D k="Ramo" v={s.ramo ? (RAMO_LABEL[s.ramo] || s.ramo) : ""} />
        <D k="Qué pasó" v={s.tipoSiniestro ? (TIPO_SOL_LABEL[s.tipoSiniestro] || s.tipoSiniestro) : ""} />
        <D k="Fecha" v={s.fechaHecho ? fmtDate(s.fechaHecho) : ""} />
        <D k="Hora" v={s.horaHecho} mono />
        <D k="Ubicación" v={s.ubicacion} />
        <D k="Localidad" v={s.localidad} />
        {s.lesionados && (
          <div>
            <div className="sol-k">¿Lesionados?</div>
            <div className="sol-v" style={s.lesionados === "SI" ? { color: "#C0241D", fontWeight: 800 } : null}>
              {s.lesionados === "SI" ? "⚠ SÍ" : "No"}
            </div>
          </div>
        )}
      </div>

      {s.relato && <div className="sol-relato">{s.relato}</div>}

      {(s.adjuntos || []).length > 0 && (
        <div className="adj-grid" style={{ marginTop: 10 }}>
          {s.adjuntos.map((a, i) => {
            const url = urls[a.path];
            const isImg = a.tipo && a.tipo.indexOf("image") >= 0;
            return (
              <a className="adj-card" key={a.path || i} href={url || "#"} target="_blank" rel="noreferrer"
                onClick={(e) => { if (!url) e.preventDefault(); }}>
                {isImg && url
                  ? <img className="adj-thumb" src={url} alt={a.name} />
                  : <span className="adj-thumb adj-thumb-file"><Ico name="doc" size={24} /></span>}
                {/* si vino de un marco, mostramos qué foto es en vez del nombre del archivo */}
                <span className="adj-card-name" title={a.etiqueta ? a.etiqueta + " — " + a.name : a.name}>
                  {a.etiqueta || a.name}
                </span>
              </a>
            );
          })}
        </div>
      )}

      <div className="sol-actions">
        {nueva ? (
          <>
            <button className="btn-primary" onClick={() => onConvertir(s)}><Ico name="plus" size={16} />Crear siniestro</button>
            <button className="btn-ghost danger" onClick={() => onDescartar(s)}><Ico name="close" size={15} />Descartar</button>
          </>
        ) : (
          s.estado === "descartada" && <button className="btn-ghost sm" onClick={() => onReabrir(s)}><Ico name="refresh" size={14} />Reabrir</button>
        )}
      </div>
    </div>
  );
}

function SolicitudesView({ solicitudes, onConvertir, onDescartar, onReabrir }) {
  const [verHist, setVerHist] = React.useState(false);
  const nuevas = solicitudes.filter((s) => s.estado === "nueva");
  const resto = solicitudes.filter((s) => s.estado !== "nueva");
  // Abierto como archivo suelto (file://) el origin es "null": mostramos un
  // ejemplo en vez de un link roto.
  const baseLink = (window.location.origin && window.location.origin !== "null") ? window.location.origin : "https://tu-portal.com.ar";
  const linkPublico = baseLink + "/denuncia";
  const copiarLink = () => {
    try { navigator.clipboard.writeText(linkPublico); } catch (e) { /* noop */ }
  };
  return (
    <div className="sol-wrap">
      <div className="ag-banner">
        <span className="ag-banner-ico" style={{ background: "#fdecec", color: "var(--brand)" }}><Ico name="mail" size={22} /></span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Denuncias online de asegurados</span>
          <span className="ag-banner-sub">Compartí este link con tus clientes: <b className="mono">{linkPublico}</b></span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={copiarLink}><Ico name="link" size={15} />Copiar link</button>
      </div>

      {nuevas.length > 0 ? (
        <div className="sol-grid">
          {nuevas.map((s) => <SolCard key={s._dbId} s={s} onConvertir={onConvertir} onDescartar={onDescartar} onReabrir={onReabrir} />)}
        </div>
      ) : (
        <div className="empty"><div className="empty-ico"><Ico name="mail" size={26} /></div>
          <div className="empty-title">Sin solicitudes nuevas</div>
          <div className="empty-sub">Cuando un asegurado cargue una denuncia en el link público, aparece acá al instante.</div></div>
      )}

      {resto.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button className="btn-ghost sm" onClick={() => setVerHist((v) => !v)}>
            <Ico name={verHist ? "chevL" : "chevR"} size={14} />{verHist ? "Ocultar procesadas" : `Ver procesadas y descartadas (${resto.length})`}
          </button>
          {verHist && (
            <div className="sol-grid" style={{ marginTop: 12 }}>
              {resto.map((s) => <SolCard key={s._dbId} s={s} onConvertir={onConvertir} onDescartar={onDescartar} onReabrir={onReabrir} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SolicitudesView, TIPO_SOL_LABEL, TIPO_SOL_HECHO });
