// detail.jsx — Saraceni Seguros · pantalla completa de detalle de siniestro

function InfoRow({ k, v, mono }) {
  return (
    <div className="ds-row"><span className="ds-k">{k}</span><span className={"ds-v" + (mono ? " mono" : "")}>{v || "—"}</span></div>
  );
}

function DetailScreen({ item, onBack, onEdit, onDelete, onGcal, onIcs }) {
  const inspeccion = item.fechaInspeccion ? fmtDate(item.fechaInspeccion) : "Pendiente";
  const abierto = item.estado === "Abierto";

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
          <div className="ds-card-title"><Ico name="check" size={15} />Historial de gestiones realizadas</div>
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
      </div>

      <div className="ds-stamp">
        Última modificación {fmtTimeAgo(item.ultimaModFecha)} · registrado desde <span className="mono">{item.ultimaModPor}</span>
      </div>
    </div>
  );
}

Object.assign(window, { DetailScreen });
