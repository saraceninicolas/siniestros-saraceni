// ui.jsx — Saraceni Seguros · componentes de UI (modelo real)

// ---------- icons ----------
const Icon = ({ d, size = 18, sw = 1.8, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const Icons = {
  grid:   "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  folder: "M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
  agenda: ["M7 3v3M17 3v3", "M4 8h16M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M9 13h2M9 17h6"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
  plus:   ["M12 5v14", "M5 12h14"],
  edit:   ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  trash:  ["M3 6h18", "M8 6V4h8v2", "M6 6l1 14h10l1-14"],
  close:  ["M6 6l12 12", "M18 6L6 18"],
  chevR:  "M9 18l6-6-6-6",
  chevL:  "M15 18l-6-6 6-6",
  monitor:["M3 4h18v12H3z", "M9 20h6", "M12 16v4"],
  car:    ["M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13", "M5 13h14v4H5z", "M7 17v2", "M17 17v2"],
  home:   ["M4 11l8-7 8 7", "M6 10v9h12v-9"],
  store:  ["M4 9l1-5h14l1 5", "M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0", "M5 9v10h14V9"],
  shield: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
  check:  "M5 12l5 5 9-11",
  clock:  ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 8v4l3 2"],
  alert:  ["M12 3l9 16H3z", "M12 10v4", "M12 17h.01"],
  user:   ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  mail:   ["M3 6h18v12H3z", "M3 7l9 6 9-6"],
  link:   ["M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"],
  doc:    ["M6 2h8l4 4v16H6z", "M14 2v4h4"],
  flag:   ["M5 21V4", "M5 4h11l-2 4 2 4H5"],
  arrowR: ["M5 12h14", "M13 6l6 6-6 6"],
  download:["M12 3v12", "M8 11l4 4 4-4", "M5 21h14"],
  info:   ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 8h.01"],
};
const Ico = ({ name, ...rest }) => <Icon d={Icons[name]} {...rest} />;

// ---------- badges ----------
function Badge({ estado, size = "md" }) {
  const e = ESTADOS[estado] || { fg: "#475569", bg: "#EEF1F4", dot: "#64748B" };
  return (
    <span className="badge" style={{ background: e.bg, color: e.fg, fontSize: size === "sm" ? 11.5 : 12.5 }}>
      <span className="badge-dot" style={{ background: e.dot }} />{estado}
    </span>
  );
}
function UrgBadge({ item }) {
  const u = urgenciaDe(item);
  if (u === "ninguna") return <span className="urg-none">—</span>;
  const c = URGENCIA[u];
  return (
    <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 11.5 }}>
      {(u === "vencido" || u === "hoy") && <Ico name={u === "vencido" ? "alert" : "clock"} size={12} />}
      {c.label}
    </span>
  );
}
function RamoTag({ ramo, hecho }) {
  return (
    <span className="ramo">
      <Ico name={RAMO_ICON[ramo] || "doc"} size={14} />
      <span>{RAMO_LABEL[ramo] || ramo}{hecho ? <i className="ramo-sub">{HECHO_LABEL[hecho] || hecho}</i> : null}</span>
    </span>
  );
}

// ---------- sidebar ----------
function Sidebar({ active, onNav, station, counts }) {
  const items = [
    { key: "dashboard", label: "Panel de control", icon: "grid" },
    { key: "siniestros", label: "Siniestros", icon: "folder", badge: counts.abiertos },
    { key: "agenda", label: "Agenda de gestiones", icon: "agenda", badge: counts.porVencer || null },
  ];
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-logo"><img src="assets/saraceni-logo.jpg" alt="Saraceni Seguros" /></div>
        <div className="sb-sub"><span className="sb-sub-dot" />Portal de Siniestros</div>
      </div>
      <nav className="sb-nav">
        <div className="sb-group-label">Gestión</div>
        {items.map((it) => (
          <button key={it.key} className={"sb-item" + (active === it.key ? " is-active" : "")} onClick={() => onNav(it.key)}>
            <span className="sb-item-ico"><Ico name={it.icon} size={17} /></span>
            <span className="sb-item-label">{it.label}</span>
            {it.badge != null && <span className={"sb-count" + (it.key === "agenda" ? " warn" : "")}>{it.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="sb-station">
        <div className="sb-station-row">
          <span className="sb-station-led" /><span className="sb-station-label">Puesto activo</span><Ico name="monitor" size={14} />
        </div>
        <div className="sb-station-name">{station}</div>
        <div className="sb-station-note">Sin inicio de sesión · puesto compartido</div>
      </div>
      <div className="sb-foot">
        <span className="sb-foot-mark">SARACENI</span>
        <span className="sb-foot-meta">Broker de Seguros · v1.0</span>
      </div>
    </aside>
  );
}

// ---------- topbar ----------
const HOY = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const TITLES = {
  dashboard: ["Panel de control", "Seguimiento de siniestros"],
  siniestros: ["Siniestros", "Listado completo"],
  agenda: ["Agenda de gestiones", "Gestiones pendientes por fecha límite"],
};
function Topbar({ active, query, onQuery, station, onSwitchStation, onNew, onOpenSync }) {
  const [title, sub] = TITLES[active] || TITLES.dashboard;
  return (
    <header className="tb">
      <div className="tb-titles">
        <div className="tb-crumb"><span>Siniestros</span><Ico name="chevR" size={13} /><b>{title}</b></div>
        <h1>{title}</h1>
      </div>
      <div className="tb-search">
        <Ico name="search" size={17} style={{ color: "var(--muted)" }} />
        <input value={query} onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar por cliente, póliza, N° siniestro o gestor…" />
        {query && <button className="tb-search-clear" onClick={() => onQuery("")}><Ico name="close" size={14} /></button>}
      </div>
      <div className="tb-actions">
        <div className="tb-date"><Ico name="clock" size={14} /><span style={{ textTransform: "capitalize" }}>{HOY}</span></div>
        <div className="tb-sep" />
        <button className="btn-ghost tb-icon" title="Sincronizar con Google Calendar" onClick={onOpenSync}><Ico name="agenda" size={18} /></button>
        <button className="tb-station-chip" onClick={onSwitchStation} title="Cambiar de puesto (demo)">
          <span className="sb-station-led" /><Ico name="monitor" size={14} />{station}
        </button>
        <button className="btn-primary" onClick={onNew}><Ico name="plus" size={17} />Registrar siniestro</button>
      </div>
    </header>
  );
}

// ---------- KPIs ----------
function KpiCard({ label, value, hint, tone, icon }) {
  return (
    <div className="kpi">
      <span className="kpi-stripe" style={{ background: tone.fg }} />
      <div className="kpi-top">
        <span className="kpi-ico" style={{ background: tone.bg, color: tone.fg }}><Ico name={icon} size={17} /></span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-mid"><span className="kpi-value">{value}</span></div>
      <div className="kpi-foot"><span className="kpi-hint">{hint}</span></div>
    </div>
  );
}
function Kpis({ data }) {
  const total = data.length;
  const abiertos = data.filter((d) => d.estado === "Abierto");
  const terminados = data.filter((d) => d.estado === "Terminado").length;
  const vencidas = abiertos.filter((d) => urgenciaDe(d) === "vencido").length;
  const porVencer = abiertos.filter((d) => ["hoy", "proximo"].includes(urgenciaDe(d))).length;
  const cards = [
    { label: "Siniestros activos", value: abiertos.length, hint: `${total} en total`, tone: ESTADOS["Abierto"], icon: "folder" },
    { label: "Gestiones por vencer", value: porVencer, hint: "vencen en ≤ 3 días", tone: URGENCIA.proximo, icon: "clock" },
    { label: "Gestiones vencidas", value: vencidas, hint: "requieren acción", tone: { bg: "#FBE3E3", fg: "#C0241D" }, icon: "alert" },
    { label: "Terminados", value: terminados, hint: "cerrados", tone: ESTADOS["Terminado"], icon: "check" },
  ];
  return <div className="kpis">{cards.map((c) => <KpiCard key={c.label} {...c} />)}</div>;
}

// ---------- toolbar ----------
function Toolbar({ title, count, estadoFilter, onEstado, ramoFilter, onRamo, ciaFilter, onCia, selected, onEdit, onDelete }) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-title">{title}</span>
        <span className="toolbar-count">{count}</span>
      </div>
      <div className="toolbar-right">
        <div className="seg">
          {["Todos", ...ESTADO_LIST].map((s) => (
            <button key={s} className={"seg-btn" + (estadoFilter === s ? " is-on" : "")} onClick={() => onEstado(s)}>{s}</button>
          ))}
        </div>
        <select className="select" value={ramoFilter} onChange={(e) => onRamo(e.target.value)}>
          <option value="Todos">Todos los ramos</option>
          {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
        </select>
        <select className="select" value={ciaFilter} onChange={(e) => onCia(e.target.value)}>
          <option value="Todos">Todas las compañías</option>
          {CIAS.map((c) => <option key={c} value={c}>{ciaLabel(c)}</option>)}
        </select>
        <div className="toolbar-divider" />
        <button className="btn-ghost" disabled={!selected} onClick={onEdit}><Ico name="edit" size={15} />Editar</button>
        <button className="btn-ghost danger" disabled={!selected} onClick={onDelete}><Ico name="trash" size={15} />Eliminar</button>
      </div>
    </div>
  );
}

// ---------- claims table ----------
function ClaimsTable({ rows, selectedId, onSelect, onOpen }) {
  if (!rows.length) {
    return (
      <div className="empty">
        <div className="empty-ico"><Ico name="search" size={26} /></div>
        <div className="empty-title">Sin resultados</div>
        <div className="empty-sub">No hay siniestros que coincidan con la búsqueda o filtros aplicados.</div>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 34 }}></th>
            <th>N° Siniestro</th>
            <th>Cliente</th>
            <th>Compañía</th>
            <th>Ramo / Hecho</th>
            <th>Gestión a realizar</th>
            <th>Vence</th>
            <th>Estado</th>
            <th style={{ width: 44 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={selectedId === r.id ? "is-selected" : ""} onClick={() => onOpen(r.id)}>
              <td onClick={(e) => { e.stopPropagation(); onSelect(selectedId === r.id ? null : r.id); }}>
                <span className={"radio" + (selectedId === r.id ? " on" : "")} />
              </td>
              <td>
                <div className="mono cell-id">{r.nroSiniestro}</div>
                <div className="cell-sub">{r.id}</div>
              </td>
              <td>
                <div className="cell-strong">{r.cliente}</div>
                <div className="cell-sub mono">{r.poliza}</div>
              </td>
              <td><span className="cia-pill">{ciaLabel(r.cia)}</span></td>
              <td><RamoTag ramo={r.ramo} hecho={r.hecho} /></td>
              <td className="cell-gestion">
                {r.estado === "Terminado"
                  ? <span className="gestion-done"><Ico name="check" size={13} />Sin pendientes</span>
                  : <span className="gestion-text" title={r.gestionAR}>{r.gestionAR || "—"}</span>}
              </td>
              <td>
                {r.estado === "Terminado"
                  ? <span className="urg-none">—</span>
                  : <div className="vence"><span className="vence-date mono">{fmtDateShort(r.fechaLimite)}</span><UrgBadge item={r} /></div>}
              </td>
              <td><Badge estado={r.estado} /></td>
              <td onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>
                <button className="row-open" title="Ver detalle"><Ico name="chevR" size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- agenda (worklist por fecha límite) ----------
function Agenda({ data, onOpen, onSync, onGcal }) {
  const abiertos = data.filter((d) => d.estado === "Abierto" && d.fechaLimite);
  const buckets = {
    vencido: { label: "Vencidas", icon: "alert", items: [] },
    hoy: { label: "Vencen hoy", icon: "clock", items: [] },
    proximo: { label: "Próximos 3 días", icon: "clock", items: [] },
    normal: { label: "Más adelante", icon: "agenda", items: [] },
  };
  abiertos.forEach((d) => buckets[urgenciaDe(d)]?.items.push(d));
  Object.values(buckets).forEach((b) => b.items.sort((a, c) => (daysUntil(a.fechaLimite) - daysUntil(c.fechaLimite))));
  const sinFecha = data.filter((d) => d.estado === "Abierto" && !d.fechaLimite);
  const agendadas = abiertos.filter((d) => d.enCalendario).length;

  return (
    <div className="agenda">
      <div className="ag-banner">
        <span className="ag-banner-ico"><Ico name="agenda" size={22} /></span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Google Calendar</span>
          <span className="ag-banner-sub">{agendadas} de {abiertos.length} gestiones agendadas · recordatorio automático</span>
        </div>
        <button className="btn-gcal lg" onClick={onSync}><Ico name="agenda" size={16} />Sincronizar gestiones</button>
      </div>
      {Object.entries(buckets).map(([key, b]) => b.items.length > 0 && (
        <section className="ag-group" key={key}>
          <div className={"ag-head ag-" + key}>
            <Ico name={b.icon} size={16} /><span>{b.label}</span><span className="ag-count">{b.items.length}</span>
          </div>
          <div className="ag-list">
            {b.items.map((d) => (
              <button className="ag-card" key={d.id} onClick={() => onOpen(d.id)}>
                <span className={"ag-rail ag-rail-" + key} />
                <div className="ag-card-main">
                  <div className="ag-card-top">
                    <span className="ag-client">{d.cliente}</span>
                    <UrgBadge item={d} />
                    {d.enCalendario && <span className="sync-done"><Ico name="check" size={12} />Agendado</span>}
                  </div>
                  <div className="ag-gestion">{d.gestionAR || "—"}</div>
                  <div className="ag-meta">
                    <RamoTag ramo={d.ramo} hecho={d.hecho} />
                    <span className="ag-dot">·</span>
                    <span className="cia-pill sm">{ciaLabel(d.cia)}</span>
                    <span className="ag-dot">·</span>
                    <span className="ag-gestor"><Ico name="user" size={12} />{d.gestor}</span>
                  </div>
                </div>
                <div className="ag-card-right">
                  <span className="ag-vence-label">Vence</span>
                  <span className="ag-vence-date mono">{fmtDateShort(d.fechaLimite)}</span>
                  <span className="ag-vence-rel">{venceTexto(d.fechaLimite)}</span>
                  <span className="btn-gcal xs" onClick={(e) => { e.stopPropagation(); onGcal(d); }}><Ico name="agenda" size={13} />Agendar</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {sinFecha.length > 0 && (
        <section className="ag-group">
          <div className="ag-head ag-normal"><Ico name="flag" size={16} /><span>Sin fecha límite</span><span className="ag-count">{sinFecha.length}</span></div>
          <div className="ag-list">
            {sinFecha.map((d) => (
              <button className="ag-card" key={d.id} onClick={() => onOpen(d.id)}>
                <span className="ag-rail ag-rail-normal" />
                <div className="ag-card-main">
                  <div className="ag-card-top"><span className="ag-client">{d.cliente}</span></div>
                  <div className="ag-gestion">{d.gestionAR || "—"}</div>
                  <div className="ag-meta"><RamoTag ramo={d.ramo} hecho={d.hecho} /><span className="ag-dot">·</span><span className="cia-pill sm">{ciaLabel(d.cia)}</span></div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {abiertos.length === 0 && sinFecha.length === 0 && (
        <div className="empty"><div className="empty-ico"><Ico name="check" size={26} /></div>
          <div className="empty-title">Todo al día</div>
          <div className="empty-sub">No hay gestiones pendientes en siniestros abiertos.</div></div>
      )}
    </div>
  );
}

Object.assign(window, { Ico, Icons, Badge, UrgBadge, RamoTag, Sidebar, Topbar, Kpis, Toolbar, ClaimsTable, Agenda });
