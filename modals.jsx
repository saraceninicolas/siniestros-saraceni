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
function ClaimFormModal({ mode, initial, station, onClose, onSubmit, usuarios }) {
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const byFecha = (a, b) => (a.fecha || "").localeCompare(b.fecha || "");
  const blank = {
    estado: "Abierto", cliente: "", dominio: "", referencia: "", cia: CIAS[0], ramo: "AUTO", hecho: HECHOS[0], cobertura: COBERTURAS_AUTO[0],
    poliza: "", nroSiniestro: "", fechaOcurrido: "", fechaDenuncia: "", fechaLimite: "", fechaInspeccion: "",
    gestionAR: "", gestionReal: "", gestiones: [], gestor: "", gestorEmail: "", gestorTel: "", obs: "", ticket: "",
    franquiciaPct: "", franquiciaMonto: "", adjuntos: [], enCalendario: false, asignadoA: null,
  };
  const [f, setF] = React.useState(() => {
    const base = initial ? { ...blank, ...initial } : blank;
    return { ...base, gestiones: [...(base.gestiones || [])].sort(byFecha), adjuntos: base.adjuntos || [] };
  });
  const [touched, setTouched] = React.useState(false);
  const [newGest, setNewGest] = React.useState({ fecha: todayISO(), texto: "" });
  const [subiendo, setSubiendo] = React.useState(false);
  const filesReady = !!(window.DB && window.DB.configured() && window.DB.files);
  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length || !filesReady) return;
    setSubiendo(true);
    for (const file of files) {
      try { const a = await window.DB.files.upload(file); setF((p) => ({ ...p, adjuntos: [...(p.adjuntos || []), a] })); }
      catch (err) { console.error(err); }
    }
    setSubiendo(false);
  };
  const removeAdjunto = async (a) => {
    setF((p) => ({ ...p, adjuntos: (p.adjuntos || []).filter((x) => x.path !== a.path) }));
    if (filesReady) { try { await window.DB.files.remove(a.path, a.bucket); } catch (err) { console.error(err); } }
  };
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // Al cambiar el ramo ajustamos la cobertura (AUTO usa lista fija; el resto, texto libre)
  const setRamo = (ramo) => setF((p) => ({
    ...p, ramo,
    cobertura: esRamoAuto(ramo) ? (COBERTURAS_AUTO.includes(p.cobertura) ? p.cobertura : COBERTURAS_AUTO[0]) : "",
    franquiciaPct: esRamoAuto(ramo) ? p.franquiciaPct : "",
    franquiciaMonto: esRamoAuto(ramo) ? p.franquiciaMonto : "",
  }));
  // La franquicia solo aplica a TODO RIESGO
  const setCobertura = (cobertura) => setF((p) => ({
    ...p, cobertura,
    franquiciaPct: aplicaFranquicia(cobertura) ? p.franquiciaPct : "",
    franquiciaMonto: aplicaFranquicia(cobertura) ? p.franquiciaMonto : "",
  }));
  const addGestion = () => {
    const texto = (newGest.texto || "").trim();
    if (!texto) return;
    const entry = { fecha: newGest.fecha || todayISO(), texto, pc: station };
    setF((p) => ({ ...p, gestiones: [...(p.gestiones || []), entry].sort(byFecha) }));
    setNewGest({ fecha: todayISO(), texto: "" });
  };
  const removeGestion = (idx) => setF((p) => {
    const g = [...(p.gestiones || [])]; g.splice(idx, 1); return { ...p, gestiones: g };
  });
  // edición de una gestión existente
  const [editIdx, setEditIdx] = React.useState(null);
  const [editGest, setEditGest] = React.useState({ fecha: "", texto: "" });
  const startEdit = (i) => { const g = f.gestiones[i]; setEditIdx(i); setEditGest({ fecha: g.fecha || todayISO(), texto: g.texto || "" }); };
  const saveEdit = () => {
    const texto = (editGest.texto || "").trim();
    if (!texto) return;
    setF((p) => {
      const gs = [...(p.gestiones || [])];
      gs[editIdx] = { ...gs[editIdx], fecha: editGest.fecha || todayISO(), texto };
      return { ...p, gestiones: gs.sort(byFecha) };
    });
    setEditIdx(null);
  };
  // orden de visualización del historial (asc = más vieja primero)
  const [histDesc, setHistDesc] = React.useState(true); // por defecto, la última gestión arriba
  // Aviso de cambios sin guardar al cerrar (scrim, X, Escape o Cancelar)
  const snap0 = React.useRef(null);
  if (snap0.current === null) snap0.current = JSON.stringify(f);
  const hayCambios = () => JSON.stringify(f) !== snap0.current || !!newGest.texto.trim();
  const safeClose = () => {
    if (hayCambios() && !window.confirm("Tenés cambios sin guardar. ¿Cerrar sin guardar?")) return;
    onClose();
  };
  const valid = f.cliente.trim() && f.nroSiniestro.trim();
  // La última gestión del historial queda como "gestión realizada" (compatibilidad)
  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const last = (f.gestiones || []).length ? f.gestiones[f.gestiones.length - 1].texto : f.gestionReal;
    onSubmit({ ...f, gestionReal: last || "" });
  };

  return (
    <ModalShell wide
      title={mode === "edit" ? "Editar siniestro" : "Registrar nuevo siniestro"}
      sub={mode === "edit" ? `${initial.id} · ${initial.cliente}` : "Cargá los datos del siniestro y la gestión"}
      onClose={safeClose}
      footer={
        <>
          <span className="foot-note"><Ico name="monitor" size={14} /> Se registrará como <b>{station}</b></span>
          <div className="foot-btns">
            <button className="btn-ghost" onClick={safeClose}>Cancelar</button>
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
        <Field label="Dominio / bien afectado">
          <input className="input mono" value={f.dominio} onChange={(e) => set("dominio", e.target.value.toUpperCase())}
            placeholder="Ej: AB123CD o Notebook Lenovo" />
        </Field>
        <Field label="Referencia del caso">
          <input className="input" value={f.referencia} onChange={(e) => set("referencia", e.target.value)}
            placeholder="Ej: Choque capó, Espejo lateral…" />
        </Field>
        <Field label="Compañía">
          <select className="input" value={f.cia} onChange={(e) => set("cia", e.target.value)}>
            {CIAS.map((c) => <option key={c} value={c}>{ciaLabel(c)}</option>)}
          </select>
        </Field>
        <Field label="Ramo">
          <select className="input" value={f.ramo} onChange={(e) => setRamo(e.target.value)}>
            {f.ramo && !RAMOS.includes(f.ramo) && <option value={f.ramo}>{RAMO_LABEL[f.ramo] || f.ramo}</option>}
            {RAMOS.map((r) => <option key={r} value={r}>{RAMO_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Hecho">
          <select className="input" value={f.hecho} onChange={(e) => set("hecho", e.target.value)}>
            {HECHOS.map((h) => <option key={h} value={h}>{HECHO_LABEL[h]}</option>)}
          </select>
        </Field>
        <Field label="Cobertura">
          {esRamoAuto(f.ramo) ? (
            <select className="input" value={f.cobertura} onChange={(e) => setCobertura(e.target.value)}>
              {f.cobertura && !COBERTURAS_AUTO.includes(f.cobertura) && <option value={f.cobertura}>{f.cobertura}</option>}
              {COBERTURAS_AUTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input className="input" list="cob-list" value={f.cobertura}
              onChange={(e) => set("cobertura", e.target.value)} placeholder="Cobertura" />
          )}
          <datalist id="cob-list">{COBERTURAS.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        {esRamoAuto(f.ramo) && aplicaFranquicia(f.cobertura) && (
          <>
            <Field label="Franquicia (% de la suma asegurada)">
              <input className="input" inputMode="decimal" value={f.franquiciaPct}
                onChange={(e) => set("franquiciaPct", e.target.value)} placeholder="Ej: 10" />
            </Field>
            <Field label="Franquicia (monto en $)">
              <input className="input mono" inputMode="decimal" value={f.franquiciaMonto}
                onChange={(e) => set("franquiciaMonto", e.target.value)} placeholder="Ej: 500000" />
            </Field>
          </>
        )}
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
        <div className="field field-full">
          <div className="hist-head">
            <span className="field-label">Historial de gestiones realizadas</span>
            <span className="hist-count">{(f.gestiones || []).length}</span>
            {(f.gestiones || []).length > 1 && (
              <button type="button" className="hist-sort" onClick={() => setHistDesc((v) => !v)} title="Cambiar orden">
                {histDesc ? "↓ Más nueva primero" : "↑ Más vieja primero"}
              </button>
            )}
          </div>
          {(f.gestiones || []).length > 0 ? (
            <ul className="hist-list">
              {(histDesc ? f.gestiones.map((g, i) => ({ g, i })).reverse() : f.gestiones.map((g, i) => ({ g, i }))).map(({ g, i }) => (
                editIdx === i ? (
                  <li className="hist-item hist-item-edit" key={"e" + i}>
                    <input className="input hist-add-date" type="date" value={editGest.fecha}
                      onChange={(e) => setEditGest((p) => ({ ...p, fecha: e.target.value }))} />
                    <input className="input hist-add-text" value={editGest.texto} autoFocus
                      onChange={(e) => setEditGest((p) => ({ ...p, texto: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") { e.stopPropagation(); setEditIdx(null); } }} />
                    <button type="button" className="btn-primary hist-edit-btn" onClick={saveEdit} disabled={!editGest.texto.trim()} title="Guardar"><Ico name="check" size={14} /></button>
                    <button type="button" className="btn-ghost hist-edit-btn" onClick={() => setEditIdx(null)} title="Cancelar"><Ico name="close" size={14} /></button>
                  </li>
                ) : (
                  <li className="hist-item" key={i}>
                    <span className="hist-date mono">{fmtDateShort(g.fecha)}</span>
                    <span className="hist-text">{g.texto}</span>
                    <button type="button" className="hist-del" title="Editar" onClick={() => startEdit(i)}>
                      <Ico name="edit" size={13} />
                    </button>
                    <button type="button" className="hist-del" title="Quitar" onClick={() => removeGestion(i)}>
                      <Ico name="close" size={13} />
                    </button>
                  </li>
                )
              ))}
            </ul>
          ) : (
            <div className="hist-empty">Sin gestiones registradas todavía.</div>
          )}
          <div className="hist-add">
            <input className="input hist-add-date" type="date" value={newGest.fecha}
              onChange={(e) => setNewGest((p) => ({ ...p, fecha: e.target.value }))} />
            <input className="input hist-add-text" value={newGest.texto}
              onChange={(e) => setNewGest((p) => ({ ...p, texto: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGestion(); } }}
              placeholder="Describí la gestión realizada…" />
            <button type="button" className="btn-ghost hist-add-btn" onClick={addGestion} disabled={!newGest.texto.trim()}>
              <Ico name="plus" size={15} />Agregar gestión
            </button>
          </div>
        </div>
        <Field label="Gestor (compañía)"><input className="input" value={f.gestor} onChange={(e) => set("gestor", e.target.value)} placeholder="Apellido, Nombre" /></Field>
        <Field label="Contacto del gestor"><input className="input" value={f.gestorEmail} onChange={(e) => set("gestorEmail", e.target.value)} placeholder="email@compañia.com" /></Field>
        <Field label="Teléfono del gestor"><input className="input" type="tel" value={f.gestorTel} onChange={(e) => set("gestorTel", e.target.value)} placeholder="Ej: 11 5555-5555" /></Field>
        <Field label="Estado">
          <div className="estado-pills">
            {ESTADO_LIST.map((s) => (
              <button key={s} type="button" className={"epill" + (f.estado === s ? " on" : "")} onClick={() => set("estado", s)}>
                <span className="epill-dot" style={{ background: ESTADOS[s].dot }} />{s}
              </button>
            ))}
          </div>
        </Field>
        {(usuarios || []).length > 0 && (
          <Field label="Asignado a (usuario del portal)">
            <select className="input" value={f.asignadoA || ""} onChange={(e) => set("asignadoA", e.target.value || null)}>
              <option value="">Sin asignar</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
            </select>
          </Field>
        )}
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

      <FormSection label="Adjuntos (fotos y PDF)" />
      <div className="adj-box">
        {(f.adjuntos || []).length > 0 && (
          <ul className="adj-list">
            {f.adjuntos.map((a, i) => (
              <li className="adj-item" key={a.path || i}>
                <Ico name={a.tipo && a.tipo.indexOf("pdf") >= 0 ? "doc" : "doc"} size={15} />
                <span className="adj-name" title={a.name}>{a.name}</span>
                <span className="adj-size">{a.size ? Math.max(1, Math.round(a.size / 1024)) + " KB" : ""}</span>
                <button type="button" className="hist-del" title="Quitar" onClick={() => removeAdjunto(a)}><Ico name="close" size={13} /></button>
              </li>
            ))}
          </ul>
        )}
        <label className={"btn-ghost adj-add" + (subiendo || !filesReady ? " is-disabled" : "")}>
          <Ico name={subiendo ? "clock" : "plus"} size={15} />{subiendo ? "Subiendo…" : "Agregar fotos o PDF"}
          <input type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }}
            onChange={onPickFiles} disabled={subiendo || !filesReady} />
        </label>
        {!filesReady && <span className="adj-note">En la demostración no se pueden subir archivos: en el sistema real se adjuntan fotos, presupuestos y PDF.</span>}
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
    <div className="toast">
      <span className="toast-ico" style={toast.err ? { background: "#DC2626" } : null}>
        <Ico name={toast.err ? "alert" : "check"} size={15} />
      </span>
      <span>{toast.msg}</span>
    </div>
  );
}

Object.assign(window, { ClaimFormModal, DetailModal, ConfirmDelete, Toast });
