// modals.jsx — Saraceni Seguros · modales (modelo real)

function ModalShell({ title, sub, onClose, children, footer, wide }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="btn-ghost tb-icon" onClick={onClose}><Ico name="close" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children, required, full }) {
  return (
    <label className={"field" + (full ? " field-full" : "")}>
      <span className="field-label">{label}{required && <i> *</i>}</span>
      {children}
    </label>
  );
}
function FormSection({ label }) { return <div className="form-section">{label}</div>; }

// ---- Create / Edit ----
function ClaimFormModal({ mode, initial, station, onClose, onSubmit }) {
  const blank = {
    estado: "Abierto", cliente: "", cia: CIAS[0], ramo: "AUTO", hecho: HECHOS[0], cobertura: COBERTURAS[0],
    poliza: "", nroSiniestro: "", fechaOcurrido: "", fechaDenuncia: "", fechaLimite: "", fechaInspeccion: "",
    gestionAR: "", gestionReal: "", gestor: "", gestorEmail: "", obs: "", ticket: "", enCalendario: false,
  };
  const [f, setF] = React.useState(initial ? { ...initial } : blank);
  const [touched, setTouched] = React.useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.cliente.trim() && f.nroSiniestro.trim();
  const submit = () => { setTouched(true); if (!valid) return; onSubmit({ ...f }); };

  return (
    <ModalShell wide
      title={mode === "edit" ? "Editar siniestro" : "Registrar nuevo siniestro"}
      sub={mode === "edit" ? `${initial.id} · ${initial.cliente}` : "Cargá los datos del siniestro y la gestión"}
      onClose={onClose}
      footer={
        <>
          <span className="foot-note"><Ico name="monitor" size={14} /> Se registrará como <b>{station}</b></span>
          <div className="foot-btns">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={!valid}>
              <Ico name="check" size={16} />{mode === "edit" ? "Guardar cambios" : "Registrar"}
            </button>
          </div>
        </>
      }>
      <FormSection label="Datos del siniestro" />
      <div className="form-grid">
        <Field label="Cliente" required full>
          <input className={"input" + (touched && !f.cliente.trim() ? " err" : "")} value={f.cliente}
            onChange={(e) => set("cliente", e.target.value)} placeholder="Nombre / razón social" />
        </Field>
        <Field label="Compañía">
          <select className="input" value={f.cia} onChange={(e) => set("cia", e.target.value)}>
            {CIAS.map((c) => <option key={c} value={c}>{ciaLabel(c)}</option>)}
          </select>
        </Field>
        <Field label="Ramo">
          <select className="input" value={f.ramo} onChange={(e) => set("ramo", e.target.value)}>
            {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Hecho">
          <select className="input" value={f.hecho} onChange={(e) => set("hecho", e.target.value)}>
            {HECHOS.map((h) => <option key={h} value={h}>{HECHO_LABEL[h]}</option>)}
          </select>
        </Field>
        <Field label="Cobertura">
          <input className="input" list="cob-list" value={f.cobertura} onChange={(e) => set("cobertura", e.target.value)} />
          <datalist id="cob-list">{COBERTURAS.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="N° de póliza">
          <input className="input mono" value={f.poliza} onChange={(e) => set("poliza", e.target.value)} placeholder="000000000" />
        </Field>
        <Field label="N° de siniestro" required>
          <input className={"input mono" + (touched && !f.nroSiniestro.trim() ? " err" : "")} value={f.nroSiniestro}
            onChange={(e) => set("nroSiniestro", e.target.value)} placeholder="000000000000" />
        </Field>
      </div>

      <FormSection label="Fechas" />
      <div className="form-grid">
        <Field label="Ocurrido"><input className="input" type="date" value={f.fechaOcurrido} onChange={(e) => set("fechaOcurrido", e.target.value)} /></Field>
        <Field label="Denuncia"><input className="input" type="date" value={f.fechaDenuncia} onChange={(e) => set("fechaDenuncia", e.target.value)} /></Field>
        <Field label="Fecha límite de respuesta"><input className="input" type="date" value={f.fechaLimite} onChange={(e) => set("fechaLimite", e.target.value)} /></Field>
        <Field label="Inspección"><input className="input" type="date" value={f.fechaInspeccion} onChange={(e) => set("fechaInspeccion", e.target.value)} /></Field>
      </div>

      <FormSection label="Gestión" />
      <div className="form-grid">
        <Field label="Gestión a realizar (próximo paso)" full>
          <input className="input" value={f.gestionAR} onChange={(e) => set("gestionAR", e.target.value)} placeholder="Qué hay que hacer y cuándo" />
        </Field>
        <Field label="Gestión realizada (última)" full>
          <input className="input" value={f.gestionReal} onChange={(e) => set("gestionReal", e.target.value)} placeholder="Último avance registrado" />
        </Field>
        <Field label="Gestor (compañía)"><input className="input" value={f.gestor} onChange={(e) => set("gestor", e.target.value)} placeholder="Apellido, Nombre" /></Field>
        <Field label="Contacto del gestor"><input className="input" value={f.gestorEmail} onChange={(e) => set("gestorEmail", e.target.value)} placeholder="email@compañia.com" /></Field>
        <Field label="Estado">
          <div className="estado-pills">
            {ESTADO_LIST.map((s) => (
              <button key={s} type="button" className={"epill" + (f.estado === s ? " on" : "")} onClick={() => set("estado", s)}>
                <span className="epill-dot" style={{ background: ESTADOS[s].dot }} />{s}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Ticket / enlace">
          <input className="input" value={f.ticket} onChange={(e) => set("ticket", e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Observaciones" full>
          <textarea className="input" rows={2} value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Detalle del hecho y notas internas…" />
        </Field>
        <label className="check-row field-full">
          <input type="checkbox" checked={f.enCalendario} onChange={(e) => set("enCalendario", e.target.checked)} />
          <span>Agendado en calendario (recordatorio activo)</span>
        </label>
      </div>
    </ModalShell>
  );
}

// ---- Detail ----
function DetailModal({ item, onClose, onEdit, onDelete, onGcal, onIcs }) {
  const Row = ({ k, v, mono }) => (
    <div className="dt-row"><span className="dt-k">{k}</span><span className={"dt-v" + (mono ? " mono" : "")}>{v || "—"}</span></div>
  );
  const inspeccion = item.fechaInspeccion ? fmtDate(item.fechaInspeccion) : "Pendiente";
  return (
    <ModalShell wide title={item.cliente} sub={<span className="mono">{item.nroSiniestro} · {item.id}</span>} onClose={onClose}
      footer={
        <>
          <button className="btn-ghost danger" onClick={() => onDelete(item)}><Ico name="trash" size={15} />Eliminar</button>
          <div className="foot-btns">
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
            <button className="btn-primary" onClick={() => onEdit(item)}><Ico name="edit" size={15} />Editar</button>
          </div>
        </>
      }>
      <div className="dt-head">
        <Badge estado={item.estado} />
        <RamoTag ramo={item.ramo} hecho={item.hecho} />
        {item.estado === "Abierto" && <UrgBadge item={item} />}
        {item.enCalendario && <span className="dt-cal"><Ico name="agenda" size={13} />En calendario</span>}
      </div>

      {item.estado === "Abierto" && (
        <div className="dt-action">
          <div className="dt-action-k"><Ico name="arrowR" size={14} />Próxima gestión a realizar</div>
          <div className="dt-action-v">{item.gestionAR || "—"}</div>
          {item.fechaLimite && <div className="dt-action-deadline">Fecha límite <b className="mono">{fmtDate(item.fechaLimite)}</b> · {venceTexto(item.fechaLimite)}</div>}
          {item.fechaLimite && (
            <div className="dt-cal-actions">
              <button className="btn-gcal" onClick={() => onGcal(item)}><Ico name="agenda" size={14} />Agendar en Google Calendar</button>
              <button className="btn-ghost sm" onClick={() => onIcs(item)}><Ico name="download" size={14} />.ics</button>
            </div>
          )}
        </div>
      )}

      <div className="dt-cols">
        <div className="dt-block">
          <span className="dt-block-title">Póliza y cobertura</span>
          <Row k="Compañía" v={ciaLabel(item.cia)} />
          <Row k="Ramo" v={RAMO_LABEL[item.ramo] || item.ramo} />
          <Row k="Hecho" v={HECHO_LABEL[item.hecho] || item.hecho} />
          <Row k="Cobertura" v={item.cobertura} />
          <Row k="N° póliza" v={item.poliza} mono />
          <Row k="N° siniestro" v={item.nroSiniestro} mono />
        </div>
        <div className="dt-block">
          <span className="dt-block-title">Fechas</span>
          <Row k="Ocurrido" v={fmtDate(item.fechaOcurrido)} />
          <Row k="Denuncia" v={fmtDate(item.fechaDenuncia)} />
          <Row k="Límite respuesta" v={item.fechaLimite ? fmtDate(item.fechaLimite) : "—"} />
          <Row k="Inspección" v={inspeccion} />
        </div>
      </div>

      <div className="dt-block">
        <span className="dt-block-title">Gestión</span>
        <Row k="Última gestión realizada" v={item.gestionReal} />
        <div className="dt-gestor">
          <span className="dt-k">Gestor de la compañía</span>
          <div className="dt-gestor-card">
            <span className="dt-gestor-av"><Ico name="user" size={15} /></span>
            <div>
              <div className="dt-gestor-name">{item.gestor || "—"}</div>
              {item.gestorEmail && <a className="dt-gestor-mail" href={"mailto:" + item.gestorEmail}><Ico name="mail" size={12} />{item.gestorEmail}</a>}
            </div>
          </div>
        </div>
      </div>

      {(item.obs || item.ticket) && (
        <div className="dt-block">
          <span className="dt-block-title">Observaciones</span>
          {item.obs && <p className="dt-obs">{item.obs}</p>}
          {item.ticket && <a className="dt-ticket" href={item.ticket} target="_blank" rel="noreferrer"><Ico name="link" size={14} />Abrir ticket de la compañía</a>}
        </div>
      )}

      <div className="dt-stamp">Última modificación {fmtTimeAgo(item.ultimaModFecha)} · <span className="mono">{item.ultimaModPor}</span></div>
    </ModalShell>
  );
}

// ---- Confirm delete ----
function ConfirmDelete({ item, station, onClose, onConfirm }) {
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal modal-sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="confirm">
          <div className="confirm-ico"><Ico name="trash" size={22} /></div>
          <h2>Eliminar siniestro</h2>
          <p>Vas a dar de baja el siniestro <span className="mono">{item.nroSiniestro}</span> de <b>{item.cliente}</b>. Dejará de verse en el listado activo.</p>
          <div className="confirm-note"><Ico name="monitor" size={14} /> Acción registrada como <b>{station}</b></div>
          <div className="confirm-btns">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-danger" onClick={() => onConfirm(item)}><Ico name="trash" size={15} />Sí, eliminar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast"><span className="toast-ico"><Ico name="check" size={15} /></span><span>{toast.msg}</span></div>
  );
}

Object.assign(window, { ClaimFormModal, DetailModal, ConfirmDelete, Toast });
