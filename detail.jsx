// detail.jsx — Saraceni Seguros · pantalla completa de detalle de siniestro

function InfoRow({ k, v, mono }) {
  return (
    <div className="ds-row"><span className="ds-k">{k}</span><span className={"ds-v" + (mono ? " mono" : "")}>{v || "—"}</span></div>
  );
}

// Exporta la FICHA COMPLETA del siniestro a PDF (datos + historial de gestiones)
function exportSiniestroPDF(item) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const fd = (iso) => (iso ? esc(fmtDate(iso)) : "—");
  const kv = (pairs) => `<table class="kv">${pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${v == null || v === "" ? "—" : esc(v)}</td></tr>`).join("")}</table>`;
  const dias = diasActivo(item);
  const inspeccion = item.fechaInspeccion ? fmtDate(item.fechaInspeccion) : "Pendiente";
  const franq = item.cobertura === "TODO RIESGO"
    ? [["Franquicia %", item.franquiciaPct ? item.franquiciaPct + "%" : "—"], ["Franquicia $", item.franquiciaMonto || "—"]] : [];
  const gs = [...(item.gestiones || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const rows = gs.length
    ? gs.map((g) => `<tr><td class="d">${esc(fmtDate(g.fecha))}</td><td>${esc(g.texto)}</td><td class="pc">${esc(g.pc || "")}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty">Sin gestiones registradas.</td></tr>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permití las ventanas emergentes para exportar el PDF."); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Siniestro ${esc(item.id)}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{margin:30px;color:#191C22}
    .brand{color:#DD0909;font-weight:800;letter-spacing:.14em;font-size:12px}
    h1{font-size:21px;margin:6px 0 2px}
    .sub{color:#5A6271;font-size:12px;margin-bottom:14px}
    .badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
    .bdg{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;border-radius:99px;padding:3px 10px;border:1px solid #E7E9ED}
    h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#8B93A1;margin:16px 0 6px;border-bottom:1px solid #EFF1F4;padding-bottom:4px}
    .cols{display:flex;gap:24px}
    .cols>div{flex:1}
    table.kv{width:100%;border-collapse:collapse;font-size:12px}
    table.kv td{padding:5px 0;border-bottom:1px solid #F1F3F5;vertical-align:top}
    table.kv td.k{color:#8B93A1;width:42%}
    table.kv td.v{font-weight:600;text-align:right}
    p.obs{font-size:12px;color:#5A6271;line-height:1.5;margin:4px 0}
    table.hist{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
    table.hist th{text-align:left;background:#F5F6F8;border-bottom:1px solid #E7E9ED;padding:8px 10px;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#8B93A1}
    table.hist td{padding:8px 10px;border-bottom:1px solid #EFF1F4;vertical-align:top}
    table.hist td.d{white-space:nowrap;font-weight:600;width:110px}
    table.hist td.pc{white-space:nowrap;color:#8B93A1;width:120px}
    table.hist td.empty{text-align:center;color:#8B93A1}
    .foot{margin-top:20px;font-size:10px;color:#8B93A1}
    @media print{body{margin:14mm}}
  </style></head><body>
    <div class="brand">SARACENI · BROKER DE SEGUROS</div>
    <h1>Ficha de siniestro — ${esc(item.cliente)}</h1>
    <div class="sub">N° ${esc(item.nroSiniestro)} · ${esc(item.id)}</div>
    <div class="badges">
      <span class="bdg" style="color:#1D4ED8;background:#E8F0FE">${esc(item.estado)}</span>
      <span class="bdg" style="color:#191C22;background:#F5F6F8">${esc(RAMO_LABEL[item.ramo] || item.ramo)}</span>
      <span class="bdg" style="color:#191C22;background:#F5F6F8">${esc(HECHO_LABEL[item.hecho] || item.hecho)}</span>
      ${dias != null ? `<span class="bdg" style="color:#5A6271;background:#F5F6F8">${dias} días activo</span>` : ""}
    </div>
    <div class="cols">
      <div>
        <h2>Póliza y cobertura</h2>
        ${kv([["Compañía", ciaLabel(item.cia)], ["Ramo", RAMO_LABEL[item.ramo] || item.ramo], ["Hecho", HECHO_LABEL[item.hecho] || item.hecho], ["Dominio / bien", item.dominio], ["Referencia", item.referencia], ["Cobertura", item.cobertura], ...franq, ["N° póliza", item.poliza], ["N° siniestro", item.nroSiniestro]])}
      </div>
      <div>
        <h2>Fechas</h2>
        ${kv([["Ocurrido", fd(item.fechaOcurrido)], ["Denuncia", fd(item.fechaDenuncia)], ["Límite respuesta", item.fechaLimite ? fmtDate(item.fechaLimite) : "—"], ["Inspección", inspeccion], ["Días activo", dias != null ? dias + " días" : "—"]])}
      </div>
    </div>
    <h2>Gestión</h2>
    ${kv([["Próxima gestión a realizar", item.gestionAR], ["Gestor", item.gestor], ["Contacto", item.gestorEmail], ["Teléfono", item.gestorTel]])}
    <h2>Observaciones</h2>
    <p class="obs">${esc(item.obs || "Sin observaciones.")}</p>
    ${item.ticket ? `<p class="obs">Ticket: ${esc(item.ticket)}</p>` : ""}
    <h2>Historial de gestiones realizadas</h2>
    <table class="hist"><thead><tr><th>Fecha</th><th>Gestión realizada</th><th>Puesto</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">Generado el ${new Date().toLocaleString("es-AR")} desde el Portal de Siniestros de Saraceni · Última modificación por ${esc(item.ultimaModPor || "—")}.</div>
  </body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch (e) { /* noop */ } }, 350);
}

function DetailScreen({ item, onBack, onEdit, onDelete, onGcal, onIcs, onTerminar, onQuickGestion }) {
  const inspeccion = item.fechaInspeccion ? fmtDate(item.fechaInspeccion) : "Pendiente";
  const abierto = item.estado === "Abierto";
  const adjuntos = item.adjuntos || [];
  // gestión rápida (sin abrir el editor)
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const [qg, setQg] = React.useState({ fecha: hoyISO(), texto: "" });
  const [histDesc, setHistDesc] = React.useState(true); // por defecto, la última gestión arriba
  const addQuick = () => {
    const texto = qg.texto.trim();
    if (!texto || !onQuickGestion) return;
    onQuickGestion(item, { fecha: qg.fecha || hoyISO(), texto });
    setQg({ fecha: hoyISO(), texto: "" });
  };
  const [adjUrls, setAdjUrls] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.DB || !window.DB.files || !adjuntos.length) return;
      const map = {};
      for (const a of adjuntos) { try { map[a.path] = await window.DB.files.signedUrl(a.path, 3600, a.bucket); } catch (e) { /* noop */ } }
      if (alive) setAdjUrls(map);
    })();
    return () => { alive = false; };
  }, [item.id]);

  return (
    <div className="ds">
      {/* barra superior */}
      <div className="ds-topbar">
        <button className="ds-back" onClick={onBack}><Ico name="chevL" size={17} />Volver al listado</button>
        <div className="ds-top-actions">
          {abierto && onTerminar && (
            <button className="btn-ghost" style={{ color: "#15803D", borderColor: "#bfe5cc" }}
              onClick={() => { if (window.confirm(`¿Marcar el siniestro de ${item.cliente} como Terminado?`)) onTerminar(item); }}>
              <Ico name="check" size={15} />Marcar terminado
            </button>
          )}
          <button className="btn-ghost" onClick={() => onEdit(item)}><Ico name="edit" size={15} />Editar</button>
          <button className="btn-danger" onClick={() => onDelete(item)}><Ico name="trash" size={15} />Eliminar</button>
        </div>
      </div>

      {/* encabezado */}
      <div className="ds-hero">
        <div className="ds-hero-left">
          <div className="ds-crumb mono">{item.nroSiniestro} · {item.id}</div>
          <h1 className="ds-client">
            {item.cliente}
            {item.referencia && <span className="ds-ref"> — {item.referencia}</span>}
          </h1>
          <div className="ds-badges">
            <Badge estado={item.estado} />
            {item.dominio && <span className="dt-cal mono" style={{ fontWeight: 700 }}><Ico name="car" size={13} />{item.dominio}</span>}
            <RamoTag ramo={item.ramo} hecho={item.hecho} />
            {abierto && <UrgBadge item={item} />}
            {diasActivo(item) != null && <span className="dt-cal"><Ico name="clock" size={13} />{diasActivo(item)} días activo</span>}
            {item.enCalendario && <span className="dt-cal"><Ico name="agenda" size={13} />En calendario</span>}
          </div>
        </div>
        <div className="ds-hero-right">
          <span className="cia-pill lg">{ciaLabel(item.cia)}</span>
          <span className="ds-cobertura">{item.cobertura || "—"}</span>
        </div>
      </div>

      {/* próxima gestión destacada */}
      {abierto && (
        <div className="ds-action">
          <div className="ds-action-info">
            <div className="ds-action-k"><Ico name="arrowR" size={15} />Próxima gestión a realizar</div>
            <div className="ds-action-v">{item.gestionAR || "—"}</div>
            {item.fechaLimite && (
              <div className="ds-action-deadline">
                <Ico name="clock" size={14} />Fecha límite <b className="mono">{fmtDate(item.fechaLimite)}</b> · {venceTexto(item.fechaLimite)}
              </div>
            )}
          </div>
          {item.fechaLimite && (
            <div className="ds-action-cal">
              <button className="btn-gcal" onClick={() => onGcal(item)}><Ico name="agenda" size={15} />Agendar en Google Calendar</button>
              <button className="btn-ghost sm" onClick={() => onIcs(item)}><Ico name="download" size={14} />Descargar .ics</button>
            </div>
          )}
        </div>
      )}

      {/* grilla de información */}
      <div className="ds-grid">
        <section className="ds-card">
          <div className="ds-card-title"><Ico name="doc" size={15} />Póliza y cobertura</div>
          <InfoRow k="Compañía" v={ciaLabel(item.cia)} />
          <InfoRow k="Ramo" v={RAMO_LABEL[item.ramo] || item.ramo} />
          <InfoRow k="Hecho" v={HECHO_LABEL[item.hecho] || item.hecho} />
          <InfoRow k="Cobertura" v={item.cobertura} />
          {aplicaFranquicia(item.cobertura) && (
            <>
              <InfoRow k="Franquicia (% s/ suma aseg.)" v={item.franquiciaPct ? item.franquiciaPct + "%" : "—"} />
              <InfoRow k="Franquicia (monto $)" v={item.franquiciaMonto || "—"} mono />
            </>
          )}
          <InfoRow k="N° de póliza" v={item.poliza} mono />
          <InfoRow k="N° de siniestro" v={item.nroSiniestro} mono />
        </section>

        <section className="ds-card">
          <div className="ds-card-title"><Ico name="agenda" size={15} />Fechas</div>
          <InfoRow k="Ocurrido" v={fmtDate(item.fechaOcurrido)} />
          <InfoRow k="Denuncia" v={fmtDate(item.fechaDenuncia)} />
          <InfoRow k="Límite de respuesta" v={item.fechaLimite ? fmtDate(item.fechaLimite) : "—"} />
          <InfoRow k="Inspección" v={inspeccion} />
        </section>

        <section className="ds-card">
          <div className="ds-card-title"><Ico name="user" size={15} />Gestor de la compañía</div>
          <div className="ds-gestor">
            <span className="ds-gestor-av"><Ico name="user" size={18} /></span>
            <div className="ds-gestor-info">
              <div className="ds-gestor-name">{item.gestor || "—"}</div>
              {item.gestorEmail
                ? <a className="ds-gestor-mail" href={"mailto:" + item.gestorEmail}><Ico name="mail" size={13} />{item.gestorEmail}</a>
                : (!item.gestorTel && <span className="ds-gestor-nomail">Sin contacto cargado</span>)}
              {item.gestorTel && <a className="ds-gestor-mail" href={"tel:" + item.gestorTel}><Ico name="phone" size={13} />{item.gestorTel}</a>}
            </div>
          </div>
        </section>

        <section className="ds-card">
          <div className="ds-card-title"><Ico name="flag" size={15} />Observaciones</div>
          <p className="ds-obs">{item.obs || "Sin observaciones."}</p>
          {item.ticket && (
            <a className="dt-ticket" href={item.ticket} target="_blank" rel="noreferrer">
              <Ico name="link" size={14} />Abrir ticket de la compañía
            </a>
          )}
        </section>

        <section className="ds-card ds-card-wide">
          <div className="ds-card-title" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ico name="check" size={15} />Historial de gestiones realizadas</span>
            <span style={{ display: "inline-flex", gap: 8 }}>
              {(item.gestiones || []).length > 1 && (
                <button className="btn-ghost sm" onClick={() => setHistDesc((v) => !v)} title="Cambiar orden">
                  {histDesc ? "↓ Más nueva primero" : "↑ Más vieja primero"}
                </button>
              )}
              <button className="btn-ghost sm" onClick={() => exportSiniestroPDF(item)} title="Exportar ficha completa a PDF"><Ico name="download" size={14} />Exportar ficha (PDF)</button>
            </span>
          </div>
          {(item.gestiones && item.gestiones.length) ? (
            <ul className="hist-tl">
              {(histDesc
                ? [...item.gestiones].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
                : [...item.gestiones].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))
              ).map((g, i) => (
                <li className="hist-tl-item" key={i}>
                  <span className="hist-tl-dot" />
                  <div className="hist-tl-body">
                    <span className="hist-tl-date mono">{fmtDate(g.fecha)}</span>
                    <p className="hist-tl-text">{g.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ds-obs">Sin gestiones registradas todavía.</p>
          )}
          {abierto && onQuickGestion && (
            <div className="hist-add" style={{ marginTop: 14 }}>
              <input className="input hist-add-date" type="date" value={qg.fecha}
                onChange={(e) => setQg((p) => ({ ...p, fecha: e.target.value }))} />
              <input className="input hist-add-text" value={qg.texto}
                onChange={(e) => setQg((p) => ({ ...p, texto: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuick(); } }}
                placeholder="Registrar una gestión ahora…" />
              <button type="button" className="btn-ghost hist-add-btn" onClick={addQuick} disabled={!qg.texto.trim()}>
                <Ico name="plus" size={15} />Agregar gestión
              </button>
            </div>
          )}
        </section>

        {adjuntos.length > 0 && (
          <section className="ds-card ds-card-wide">
            <div className="ds-card-title"><Ico name="doc" size={15} />Adjuntos <span className="ds-adj-count">{adjuntos.length}</span></div>
            <div className="adj-grid">
              {adjuntos.map((a, i) => {
                const url = adjUrls[a.path];
                const isImg = a.tipo && a.tipo.indexOf("image") >= 0;
                return (
                  <a className="adj-card" key={a.path || i} href={url || "#"} target="_blank" rel="noreferrer"
                    onClick={(e) => { if (!url) e.preventDefault(); }}>
                    {isImg && url
                      ? <img className="adj-thumb" src={url} alt={a.name} />
                      : <span className="adj-thumb adj-thumb-file"><Ico name="doc" size={24} /></span>}
                    <span className="adj-card-name" title={a.name}>{a.name}</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="ds-stamp">
        Última modificación {fmtTimeAgo(item.ultimaModFecha)} · registrado desde <span className="mono">{item.ultimaModPor}</span>
      </div>
    </div>
  );
}

Object.assign(window, { DetailScreen });
