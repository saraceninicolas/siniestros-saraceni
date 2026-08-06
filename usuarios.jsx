// usuarios.jsx — Saraceni Seguros · Administración de usuarios y roles (solo organizador)
// + Campana de notificaciones in-app (todos los usuarios activos)

const ROL_LABEL = { organizador: "Organizador", empleado: "Empleado" };
const USR_ESTADO = {
  activo:     { fg: "#15803D", bg: "#E6F4EA", t: "Activo" },
  pendiente:  { fg: "#B45309", bg: "#FDF1DC", t: "Pendiente" },
  suspendido: { fg: "#B91C1C", bg: "#FBE3E3", t: "Suspendido" },
};

function UsuariosView({ perfiles, me, onUpdate }) {
  const [busyId, setBusyId] = React.useState(null);
  const act = async (id, patch) => {
    setBusyId(id);
    try { await onUpdate(id, patch); } finally { setBusyId(null); }
  };
  const pendientes = perfiles.filter((p) => p.estado === "pendiente");
  const resto = perfiles.filter((p) => p.estado !== "pendiente");

  const Fila = ({ p }) => {
    const esYo = me && p.id === me.id;
    const est = USR_ESTADO[p.estado] || USR_ESTADO.pendiente;
    const busy = busyId === p.id;
    return (
      <tr>
        <td>
          <div className="cell-strong">{p.nombre || p.email}{esYo && <span className="cia-pill sm" style={{ marginLeft: 8 }}>vos</span>}</div>
          <div className="cell-sub">{p.email}</div>
        </td>
        <td>
          {esYo ? <span className="cia-pill">{ROL_LABEL[p.rol]}</span> : (
            <select className="select" value={p.rol} disabled={busy}
              onChange={(e) => act(p.id, { rol: e.target.value })}>
              <option value="organizador">Organizador</option>
              <option value="empleado">Empleado</option>
            </select>
          )}
        </td>
        <td><span className="badge" style={{ background: est.bg, color: est.fg }}><span className="badge-dot" style={{ background: est.fg }} />{est.t}</span></td>
        <td className="cell-sub">{p.creado ? fmtDate(p.creado.slice(0, 10)) : "—"}</td>
        <td>
          {!esYo && (
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {p.estado === "pendiente" && <button className="btn-primary sm" disabled={busy} onClick={() => act(p.id, { estado: "activo" })}><Ico name="check" size={14} />Aprobar</button>}
              {p.estado === "activo" && <button className="btn-ghost danger sm" disabled={busy} onClick={() => { if (window.confirm(`¿Suspender el acceso de ${p.nombre || p.email}?`)) act(p.id, { estado: "suspendido" }); }}>Suspender</button>}
              {p.estado === "suspendido" && <button className="btn-ghost sm" disabled={busy} onClick={() => act(p.id, { estado: "activo" })}><Ico name="refresh" size={13} />Reactivar</button>}
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="ag-banner">
        <span className="ag-banner-ico" style={{ background: "#fdecec", color: "var(--brand)" }}><Ico name="user" size={22} /></span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Usuarios del portal</span>
          <span className="ag-banner-sub">
            Los <b>organizadores</b> administran todo (incluye Facturación, Objetivos y esta pantalla).
            Los <b>empleados</b> operan Siniestros, Solicitudes y Pendientes.
            Quien se registra queda <b>pendiente</b> hasta que lo apruebes acá.
          </span>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="toolbar"><div className="toolbar-left"><span className="toolbar-title">Esperando aprobación</span><span className="toolbar-count">{pendientes.length}</span></div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Alta</th><th></th></tr></thead>
              <tbody>{pendientes.map((p) => <Fila key={p.id} p={p} />)}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="toolbar"><div className="toolbar-left"><span className="toolbar-title">Todos los usuarios</span><span className="toolbar-count">{resto.length}</span></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Alta</th><th></th></tr></thead>
            <tbody>{resto.map((p) => <Fila key={p.id} p={p} />)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- campana de notificaciones (topbar) ----------
const NOTIF_ICON = { asignacion: "user", vencimiento: "alert", solicitud: "mail", cotizacion: "home", sistema: "info" };
function NotifBell({ notifs, onOpenNotif, onMarkAll }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const unread = notifs.filter((n) => !n.leida).length;
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="notif-wrap" ref={ref}>
      <button className="btn-ghost tb-icon notif-btn" title="Notificaciones" onClick={() => setOpen((v) => !v)}>
        <Ico name="bell" size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span>Notificaciones</span>
            {unread > 0 && <button className="notif-clear" onClick={onMarkAll}>Marcar todas leídas</button>}
          </div>
          <div className="notif-list">
            {notifs.length === 0 && <div className="notif-empty">Sin notificaciones por ahora.</div>}
            {notifs.slice(0, 30).map((n) => (
              <button key={n._dbId} className={"notif-item" + (n.leida ? "" : " unread")}
                onClick={() => { setOpen(false); onOpenNotif(n); }}>
                <span className={"notif-ico notif-" + n.tipo}><Ico name={NOTIF_ICON[n.tipo] || "info"} size={15} /></span>
                <span className="notif-txt">
                  <span className="notif-title">{n.titulo}</span>
                  {n.cuerpo && <span className="notif-body">{n.cuerpo}</span>}
                  <span className="notif-meta">{n.referencia && <b className="mono">{n.referencia}</b>}{n.referencia && n.creado ? " · " : ""}{n.creado ? fmtTimeAgo(n.creado) : ""}</span>
                </span>
                {!n.leida && <span className="notif-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { UsuariosView, NotifBell });
