// calendar.jsx — integración con Google Calendar (sin backend)
// Estrategia: (1) enlaces "Agendar en Google Calendar" (template URL) y
// (2) exportación .ics con recordatorios (VALARM) importable a cualquier calendario.

function _icsDate(iso) { return (iso || "").replaceAll("-", ""); }
function _addDaysISO(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function _escICS(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Texto descriptivo común para el evento
function _eventTitle(item) { return `Saraceni · ${item.cliente} — ${item.gestionAR || "Gestión"}`; }
function _eventDetails(item) {
  const lines = [
    `Gestión a realizar: ${item.gestionAR || "—"}`,
    `Cliente: ${item.cliente}`,
    `Compañía: ${ciaLabel(item.cia)}`,
    `Ramo / Hecho: ${RAMO_LABEL[item.ramo] || item.ramo} · ${HECHO_LABEL[item.hecho] || item.hecho}`,
    `N° siniestro: ${item.nroSiniestro}`,
    `N° póliza: ${item.poliza}`,
    item.gestor ? `Gestor: ${item.gestor}${item.gestorEmail ? " <" + item.gestorEmail + ">" : ""}` : "",
    item.gestionReal ? `Última gestión: ${item.gestionReal}` : "",
    item.obs ? `Obs: ${item.obs}` : "",
    item.ticket ? `Ticket: ${item.ticket}` : "",
    "",
    "— Generado por el Portal de Siniestros de Saraceni Seguros",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

// (1) Google Calendar "quick add" URL — evento de día completo en la fecha límite
function gcalUrl(item) {
  if (!item.fechaLimite) return null;
  const start = _icsDate(item.fechaLimite);
  const end = _icsDate(_addDaysISO(item.fechaLimite, 1)); // fin exclusivo
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: _eventTitle(item),
    dates: `${start}/${end}`,
    details: _eventDetails(item),
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

// (2) Archivo .ics con VALARM (recordatorio leadDays antes)
function buildICS(items, leadDays = 1) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const trigger = leadDays > 0 ? `-P${leadDays}D` : "PT0S";
  const out = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Saraceni Seguros//Portal Siniestros//ES",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Gestiones Saraceni",
  ];
  items.forEach((item) => {
    if (!item.fechaLimite) return;
    const start = _icsDate(item.fechaLimite);
    const end = _icsDate(_addDaysISO(item.fechaLimite, 1));
    out.push(
      "BEGIN:VEVENT",
      `UID:${item.id}-${start}@saraceni`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${_escICS(_eventTitle(item))}`,
      `DESCRIPTION:${_escICS(_eventDetails(item))}`,
      "BEGIN:VALARM",
      `TRIGGER:${trigger}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${_escICS("Recordatorio: " + _eventTitle(item))}`,
      "END:VALARM",
      "END:VEVENT",
    );
  });
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

function downloadICS(filename, text) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Sync modal ----------
const LEAD_OPTS = [
  { key: 2, label: "2 días antes" },
  { key: 1, label: "1 día antes" },
  { key: 0, label: "El mismo día" },
];

function CalendarSync({ data, onClose, onAgendar }) {
  const pendientes = data
    .filter((d) => d.estado === "Abierto" && d.fechaLimite)
    .sort((a, b) => daysUntil(a.fechaLimite) - daysUntil(b.fechaLimite));
  const [lead, setLead] = React.useState(1);

  const exportAll = () => {
    downloadICS("gestiones-saraceni.ics", buildICS(pendientes, lead));
    onAgendar && onAgendar(pendientes.map((d) => d.id));
  };
  const exportOne = (item) => {
    downloadICS(`gestion-${item.id}.ics`, buildICS([item], lead));
    onAgendar && onAgendar([item.id]);
  };
  const openGcal = (item) => {
    window.open(gcalUrl(item), "_blank", "noopener");
    onAgendar && onAgendar([item.id]);
  };

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="sync-head">
            <span className="sync-gcal"><Ico name="agenda" size={20} /></span>
            <div>
              <h2>Sincronizar con Google Calendar</h2>
              <p>Agendá las gestiones pendientes con recordatorio automático</p>
            </div>
          </div>
          <button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="sync-bar">
            <div className="sync-reminder">
              <span className="field-label">Recordatorio</span>
              <div className="seg">
                {LEAD_OPTS.map((o) => (
                  <button key={o.key} className={"seg-btn" + (lead === o.key ? " is-on" : "")} onClick={() => setLead(o.key)}>{o.label}</button>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={exportAll} disabled={!pendientes.length}>
              <Ico name="download" size={16} />Descargar agenda (.ics) · {pendientes.length}
            </button>
          </div>

          <div className="sync-note">
            <Ico name="info" size={15} />
            <span>El archivo <b>.ics</b> se importa una vez en Google Calendar (Configuración → Importar) y entra cada gestión con su recordatorio. O usá <b>Agendar</b> en cada fila para abrir el evento ya cargado en Google Calendar.</span>
          </div>

          <div className="sync-list">
            {pendientes.map((d) => (
              <div className="sync-row" key={d.id}>
                <span className={"sync-rail ag-rail-" + urgenciaDe(d)} />
                <div className="sync-row-main">
                  <div className="sync-row-top">
                    <span className="sync-client">{d.cliente}</span>
                    <UrgBadge item={d} />
                    {d.enCalendario && <span className="sync-done"><Ico name="check" size={12} />Agendado</span>}
                  </div>
                  <div className="sync-gestion">{d.gestionAR || "—"}</div>
                </div>
                <div className="sync-row-date mono">{fmtDateShort(d.fechaLimite)}</div>
                <div className="sync-row-actions">
                  <button className="btn-ghost sm" onClick={() => exportOne(d)} title="Descargar .ics"><Ico name="download" size={14} /></button>
                  <button className="btn-gcal" onClick={() => openGcal(d)}><Ico name="agenda" size={14} />Agendar</button>
                </div>
              </div>
            ))}
            {!pendientes.length && (
              <div className="empty"><div className="empty-ico"><Ico name="check" size={26} /></div>
                <div className="empty-title">No hay gestiones con fecha límite</div>
                <div className="empty-sub">Cargá una fecha límite de respuesta para poder agendarla.</div></div>
            )}
          </div>
        </div>

        <div className="modal-foot">
          <span className="foot-note"><Ico name="shield" size={14} /> No requiere conexión ni contraseñas de Google</span>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { gcalUrl, buildICS, downloadICS, CalendarSync });
