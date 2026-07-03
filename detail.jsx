// detail.jsx — Saraceni Seguros · pantalla completa de detalle de siniestro

function InfoRow({ k, v, mono }) {
  return (
    <div className="ds-row"><span className="ds-k">{k}</span><span className={"ds-v" + (mono ? " mono" : "")}>{v || "—"}</span></div>
  );
}

// Exporta el historial de gestiones a PDF (abre vista imprimible → Guardar como PDF)
function exportGestionesPDF(item) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const gs = [...(item.gestiones || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const rows = gs.length
    ? gs.map((g) => `<tr><td class="d">${esc(fmtDate(g.fecha))}</td><td>${esc(g.texto)}</td><td class="pc">${esc(g.pc || "")}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty">Sin gestiones registradas.</td></tr>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Permití las ventanas emergentes para exportar el PDF."); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Gestiones ${esc(item.id)}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{margin:32px;color:#191C22}
    .brand{color:#DD0909;font-weight:800;letter-spacing:.14em;font-size:12px}
    h1{font-size:20px;margin:6px 0 2px}
    .sub{color:#5A6271;font-size:12px;margin-bottom:16px}
    .meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12px;color:#5A6271;border:1px solid #E7E9ED;border-radius:8px;padding:10px 14px;margin-bottom:16px}
    .meta b{color:#191C22}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{text-align:left;background:#F5F6F8;border-bottom:1px solid #E7E9ED;padding:8px 10px;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#8B93A1}
    td{padding:8px 10px;border-bottom:1px solid #EFF1F4;vertical-align:top}
    td.d{white-space:nowrap;font-weight:600;width:110px}
    td.pc{white-space:nowrap;color:#8B93A1;width:120px}
    td.empty{text-align:center;color:#8B93A1}
    .foot{margin-top:18px;font-size:10px;color:#8B93A1}
    @media print{body{margin:14mm}}
  </style></head><body>
    <div class="brand">SARACENI · BROKER DE SEGUROS</div>
    <h1>Historial de gestiones</h1>
    <div class="sub">${esc(item.cliente)} · N° ${esc(item.nroSiniestro)} · ${esc(item.id)}</div>
    <div class="meta">
      <span>Compañía: <b>${esc(ciaLabel(item.cia))}</b></span>
      <span>Ramo: <b>${esc(RAMO_LABEL[item.ramo] || item.ramo)}</b></span>
      <span>Estado: <b>${esc(item.estado)}</b></span>
      <span>Póliza: <b>${esc(item.poliza || "—")}</b></span>
      ${item.gestionAR ? `<span>Próxima gestión: <b>${esc(item.gestionAR)}</b></span>` : ""}
    </div>
    <table><thead><tr><th>Fecha</th><th>Gestión realizada</th><th>Puesto</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">Generado el ${new Date().toLocaleString("es-AR")} desde el Portal de Siniestros de Saraceni.</div>
  </body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => { try { w.print(); } catch (e) { /* noop */ } }, 350);
}

function DetailScreen({ item, onBack, onEdit, onDelete, onGcal, onIcs }) {
  const inspeccion = item.fechaInspeccion ? fmtDate(item.fechaInspeccion) : "Pendiente";
  const abierto = item.estado === "Abierto";
  const adjuntos = item.adjuntos || [];
  const [adjUrls, setAdjUrls] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.DB || !window.DB.files || !adjuntos.length) return;
      const map = {};
      for (const a of adjuntos) { try { map[a.path] = await window.DB.files.signedUrl(a.path, 3600); } catch (e) { /* noop */ } }
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
          <button className="btn-ghost" onClick={() => onEdit(item)}><Ico name="edit" size={15} />Editar</button>
          <button className="btn-danger" onClick={() => onDelete(item)}><Ico name="trash" size={15} />Eliminar</button>
        </div>
      </div>

      {/* encabezado */}
      <div className="ds-hero">
        <div className="ds-hero-left">
          <div className="ds-crumb mono">{item.nroSiniestro} · {item.id}</div>
          <h1 className="ds-client">{item.cliente}</h1>
          <div className="ds-badges">
            <Badge estado={item.estado} />
            <RamoTag ramo={item.ramo} hecho={item.hecho} />
            {abierto && <UrgBadge item={item} />}
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
                : <span className="ds-gestor-nomail">Sin contacto cargado</span>}
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
            <button className="btn-ghost sm" onClick={() => exportGestionesPDF(item)} title="Exportar a PDF"><Ico name="download" size={14} />Exportar PDF</button>
          </div>
          {(item.gestiones && item.gestiones.length) ? (
            <ul className="hist-tl">
              {[...item.gestiones].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")).map((g, i) => (
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
