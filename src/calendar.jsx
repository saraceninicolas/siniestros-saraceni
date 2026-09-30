// calendar.jsx — El calendario de gestiones (mes completo) y el enlace a Google Calendar
// ─────────────────────────────────────────────────────────────────────────────
// Antes esta pantalla ofrecía bajar un .ics con todas las gestiones. Se sacó:
// en Windows el archivo lo abre Outlook, hay que importarlo a mano y, una vez
// importado, queda congelado —si la fecha límite cambia en el portal, el evento
// del calendario personal sigue con la fecha vieja, que es peor que no tenerlo—.
//
// Quedó lo que sí sirve: ver el mes entero con cada gestión parada en su fecha
// límite, y el enlace directo a Google Calendar para la gestión puntual que
// alguien quiera tener también en su agenda personal.
// ─────────────────────────────────────────────────────────────────────────────

// ---------- enlace a Google Calendar (sin backend, sin contraseñas) ----------
function _gcalFecha(iso) { return (iso || "").replaceAll("-", ""); }

function _eventTitle(item) { return `${marcaNombre()} · ${item.cliente} — ${item.gestionAR || "Gestión"}`; }
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
    `— Generado por el portal de ${marcaNombre()}`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

// Evento de 10 a 11 hs del día de la fecha límite
function gcalUrl(item) {
  if (!item.fechaLimite) return null;
  const d = _gcalFecha(item.fechaLimite);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: _eventTitle(item),
    dates: `${d}T100000/${d}T110000`,
    details: _eventDetails(item),
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

// ---------- la grilla del mes ----------
const CAL_DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const CAL_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const CAL_CHIPS_VISIBLES = 3;   // lo que entra en una celda sin desbordarla

function calISO(f) { return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`; }

// Las semanas del mes, de lunes a domingo, con los días de los meses vecinos
// incluidos para que la grilla arranque y termine completa.
function calSemanas(anio, mes) {
  const corrimiento = (new Date(anio, mes, 1).getDay() + 6) % 7;   // getDay(): 0 = domingo
  const semanas = [];
  for (let s = 0; s < 6; s++) {
    const fila = [];
    for (let d = 0; d < 7; d++) {
      // Un día menor que 1 o mayor que el largo del mes cae solo en el mes vecino.
      const f = new Date(anio, mes, 1 - corrimiento + s * 7 + d);
      fila.push({ iso: calISO(f), dia: f.getDate(), otroMes: f.getMonth() !== mes });
    }
    semanas.push(fila);
  }
  // Un mes de cinco semanas deja la sexta fila entera en el mes siguiente.
  if (semanas[5].every((c) => c.otroMes)) semanas.pop();
  return semanas;
}

// "miércoles, 23 de septiembre" con la primera en mayúscula. A mano y no con
// text-transform:capitalize, que también levantaría el "de" del medio.
function calDiaLargo(iso) {
  const f = parseDate(iso);
  if (!f) return "";
  const t = f.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function CalendarioMes({ data, onClose, onAbrir, onGcal }) {
  const hoy = today0();
  const hoyISO = calISO(hoy);
  const [cursor, setCursor] = React.useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
  const [diaSel, setDiaSel] = React.useState(hoyISO);

  // Un siniestro terminado no tiene gestión pendiente: este calendario es de lo
  // que hay que hacer, no de lo que pasó.
  const porDia = {};
  data.forEach((d) => {
    if (d.estado !== "Abierto" || !d.fechaLimite) return;
    (porDia[d.fechaLimite] = porDia[d.fechaLimite] || []).push(d);
  });

  const semanas = calSemanas(cursor.anio, cursor.mes);
  const prefijo = `${cursor.anio}-${pad(cursor.mes + 1)}`;
  const delMes = Object.keys(porDia).filter((iso) => iso.startsWith(prefijo))
    .reduce((acc, iso) => acc.concat(porDia[iso]), []);
  const vencidasMes = delMes.filter((d) => urgenciaDe(d) === "vencido").length;

  const mover = (n) => {
    const f = new Date(cursor.anio, cursor.mes + n, 1);
    setCursor({ anio: f.getFullYear(), mes: f.getMonth() });
  };
  const irHoy = () => { setCursor({ anio: hoy.getFullYear(), mes: hoy.getMonth() }); setDiaSel(hoyISO); };
  const elegir = (celda) => {
    setDiaSel(celda.iso);
    // Tocar un día del mes vecino mueve el mes: si no, el día elegido queda
    // seleccionado fuera de la vista y parece que no pasó nada.
    if (celda.otroMes) {
      const f = parseDate(celda.iso);
      setCursor({ anio: f.getFullYear(), mes: f.getMonth() });
    }
  };

  const delDia = (porDia[diaSel] || []).slice()
    .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-mes" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="sync-head">
            <span className="sync-gcal"><Ico name="agenda" size={20} /></span>
            <div>
              <h2>Calendario de gestiones</h2>
              <p>Cada gestión parada en su fecha límite, mes por mes</p>
            </div>
          </div>
          <button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="cal-barra">
            <div className="cal-nav">
              <button className="btn-ghost tb-icon" title="Mes anterior" onClick={() => mover(-1)}><Ico name="chevL" size={17} /></button>
              <button className="btn-ghost tb-icon" title="Mes siguiente" onClick={() => mover(1)}><Ico name="chevR" size={17} /></button>
            </div>
            <span className="cal-mes-nom">{CAL_MESES[cursor.mes]} {cursor.anio}</span>
            <button className="btn-ghost sm" onClick={irHoy}>Hoy</button>
            <div className="cal-resumen">
              <span><b>{delMes.length}</b> {delMes.length === 1 ? "gestión" : "gestiones"} este mes</span>
              {vencidasMes > 0 && (
                <span className="cal-vencidas">
                  <Ico name="alert" size={13} />{vencidasMes} vencida{vencidasMes === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          <div className="cal-cuerpo">
            <div className="cal-grilla">
              <div className="cal-cabecera">{CAL_DIAS.map((d) => <span key={d}>{d}</span>)}</div>
              {semanas.map((fila, i) => (
                <div className="cal-semana" key={i}>
                  {fila.map((c) => {
                    const items = porDia[c.iso] || [];
                    const clases = ["cal-dia"];
                    if (c.otroMes) clases.push("is-otro");
                    if (c.iso === diaSel) clases.push("is-sel");
                    if (c.iso === hoyISO) clases.push("is-hoy");
                    return (
                      <button type="button" className={clases.join(" ")} key={c.iso}
                        onClick={() => elegir(c)}
                        aria-label={`${c.dia} de ${CAL_MESES[parseDate(c.iso).getMonth()]}: ${items.length} gestiones`}>
                        <span className="cal-num">{c.dia}</span>
                        {items.slice(0, CAL_CHIPS_VISIBLES).map((d) => (
                          <span className={"cal-chip cal-chip-" + urgenciaDe(d)} key={d.id}
                            title={d.cliente + (d.gestionAR ? " — " + d.gestionAR : "")}>{d.cliente}</span>
                        ))}
                        {items.length > CAL_CHIPS_VISIBLES && (
                          <span className="cal-mas">+{items.length - CAL_CHIPS_VISIBLES} más</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <aside className="cal-panel">
              <span className="cal-panel-tit">{calDiaLargo(diaSel)}</span>
              <span className="cal-panel-sub">
                {delDia.length === 0 ? "Sin gestiones" : delDia.length === 1 ? "1 gestión" : delDia.length + " gestiones"}
              </span>
              {delDia.length === 0 ? (
                <p className="cal-panel-vacio">Tocá cualquier día del mes para ver qué hay que hacer.</p>
              ) : delDia.map((d) => (
                <div className="cal-item" key={d.id}>
                  <span className={"cal-rail ag-rail-" + urgenciaDe(d)} />
                  <button className="cal-item-main" onClick={() => onAbrir && onAbrir(d.id)}>
                    <span className="cal-item-cli">{d.cliente}</span>
                    <span className="cal-item-ges">{d.gestionAR || "—"}</span>
                    <span className="cal-item-meta">
                      {ciaLabel(d.cia)} · {RAMO_LABEL[d.ramo] || d.ramo}{d.gestor ? " · " + d.gestor : ""}
                    </span>
                  </button>
                  <button className="btn-gcal xs cal-item-gcal" title="Agendar en Google Calendar"
                    onClick={() => onGcal && onGcal(d)}><Ico name="agenda" size={13} /></button>
                </div>
              ))}
            </aside>
          </div>

          <div className="cal-leyendas">
            <span className="cal-leyenda"><span className="cal-punto cal-punto-vencido" />Vencida</span>
            <span className="cal-leyenda"><span className="cal-punto cal-punto-hoy" />Vence hoy</span>
            <span className="cal-leyenda"><span className="cal-punto cal-punto-proximo" />Próximos 3 días</span>
            <span className="cal-leyenda"><span className="cal-punto cal-punto-normal" />Más adelante</span>
          </div>
        </div>

        <div className="modal-foot">
          <span className="foot-note"><Ico name="info" size={14} /> Solo siniestros abiertos con fecha límite cargada</span>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { gcalUrl, calSemanas, calISO, calDiaLargo, CalendarioMes });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
