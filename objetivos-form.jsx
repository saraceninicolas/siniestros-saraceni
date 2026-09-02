// objetivos-form.jsx — Asistente para crear o editar un objetivo
// ─────────────────────────────────────────────────────────────────────────────
// Cinco pasos numerados en una sola pantalla (no un modal): qué, cuándo, cuánto,
// quién y notas. Se ve todo junto para poder repasarlo antes de guardar, pero
// cada paso está separado para que no se sienta un formulario largo.
//
// Las sugerencias de meta del paso 3 salen de datos reales: para las áreas
// automáticas mide el período anterior; para las manuales busca el último
// objetivo cargado de la misma área.
// ─────────────────────────────────────────────────────────────────────────────

const OBJ_PLANTILLAS = [
  { k: "fact-mes",  label: "Facturación del mes", icono: "card",    area: "facturacion",  periodicidad: "mensual", unidad: "$" },
  { k: "fact-anio", label: "Facturación del año", icono: "target",  area: "facturacion",  periodicidad: "anual",   unidad: "$" },
  { k: "polizas",   label: "Pólizas nuevas",      icono: "doc",     area: "ventas",       periodicidad: "mensual", unidad: "pólizas" },
  { k: "clientes",  label: "Clientes nuevos",     icono: "user",    area: "clientes",     periodicidad: "mensual", unidad: "clientes" },
  { k: "renov",     label: "Renovaciones",        icono: "refresh", area: "renovaciones", periodicidad: "mensual", unidad: "renovaciones" },
  { k: "otro",      label: "Otro objetivo",       icono: "flag",    area: "otro",         periodicidad: "mensual", unidad: "" },
];

function ObjPaso({ n, titulo, children, nota }) {
  return (
    <section className="objf-paso">
      <span className="objf-paso-n" aria-hidden="true">{n}</span>
      <div className="objf-paso-body">
        <h3 className="objf-paso-t">{titulo}</h3>
        {nota && <p className="objf-paso-nota">{nota}</p>}
        {children}
      </div>
    </section>
  );
}
function ObjCampo({ label, children, opcional, ancho }) {
  return (
    <label className="objf-campo" style={ancho ? { gridColumn: "span " + ancho } : null}>
      <span className="objf-campo-l">{label}{opcional && <i> (opcional)</i>}</span>
      {children}
    </label>
  );
}

function ObjetivoForm({ inicial, usuarios, station, fuentes, objetivos, onCancelar, onGuardar }) {
  const hoy = new Date();
  const arranque = () => {
    if (inicial) {
      const d = objDia(inicial.fechaDesde) || hoy;
      return {
        plantilla: "", area: inicial.area || "otro", titulo: inicial.titulo || "", descripcion: inicial.descripcion || "",
        periodicidad: inicial.periodicidad || "mensual",
        fecha: inicial.fechaDesde || objHoyIso(), semana: objSemanaDe(d), mes: d.getMonth() + 1, anio: d.getFullYear(),
        meta: inicial.meta || "", unidad: inicial.unidad || "",
        responsable: inicial.responsable || "", equipo: inicial.equipo || "",
        colaboradores: inicial.colaboradores || [], notas: inicial.notas || "",
      };
    }
    return {
      plantilla: "fact-mes", area: "facturacion", titulo: "", descripcion: "",
      periodicidad: "mensual", fecha: objHoyIso(), semana: objSemanaDe(hoy), mes: hoy.getMonth() + 1, anio: hoy.getFullYear(),
      meta: "", unidad: "$", responsable: station || "", equipo: "", colaboradores: [], notas: "",
    };
  };
  const [f, setF] = React.useState(arranque);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const area = objArea(f.area);

  const aplicarPlantilla = (p) => setF((prev) => ({
    ...prev, plantilla: p.k, area: p.area, periodicidad: p.periodicidad,
    unidad: p.unidad || objArea(p.area).unidad,
  }));
  const cambiarArea = (k) => setF((prev) => ({ ...prev, area: k, plantilla: "", unidad: objArea(k).unidad }));

  // ---- período elegido ----
  const rango = objRango(f.periodicidad, f);
  const previo = { ...f, area: f.area, periodicidad: f.periodicidad, fechaDesde: rango.desde, fechaHasta: rango.hasta };
  const esAuto = objEsAuto(previo);

  // Nombre automático si no se escribe uno
  const tituloAuto = React.useMemo(() => {
    const p = objPeriodoTexto(previo);
    if (f.area === "facturacion") return "Facturación de " + p;
    if (f.area === "otro") return "";
    return area.label + " · " + p;
  }, [f.area, f.periodicidad, f.fecha, f.semana, f.mes, f.anio]);
  const titulo = (f.titulo || "").trim() || tituloAuto;

  // ---- sugerencias de meta ----
  const base = React.useMemo(() => {
    const anterior = objRangoAnterior(previo);
    if (esAuto) return objMedir(previo, anterior, fuentes);
    // manual: el último objetivo cargado de la misma área
    const previos = (objetivos || [])
      .filter((o) => o.area === f.area && !o.eliminado && (!inicial || o.id !== inicial.id))
      .sort((a, b) => (b.fechaDesde || "").localeCompare(a.fechaDesde || ""));
    return previos.length ? Number(previos[0].meta) || 0 : 0;
  }, [f.area, f.periodicidad, f.fecha, f.semana, f.mes, f.anio, fuentes, objetivos]);
  const sugerencias = base > 0
    ? [{ l: "Igual", m: 1 }, { l: "+10%", m: 1.1 }, { l: "+20%", m: 1.2 }, { l: "+30%", m: 1.3 }]
      .map((s) => ({ ...s, v: Math.round(base * s.m) }))
    : [];

  const metaNum = objNum(f.meta);
  const valido = !!titulo && metaNum > 0;
  const unidadTxt = f.unidad && f.unidad !== "$" ? " " + f.unidad : "";
  const frase = valido
    ? `${esAuto ? "Medir" : "Llegar a"} ${objEsPlata(f) ? OBJ_ARS.format(metaNum) : metaNum.toLocaleString("es-AR") + unidadTxt} en ${objPeriodoTexto(previo).toLowerCase()}`
    : "Completá el nombre y la meta para poder guardar.";

  const anios = [];
  for (let a = hoy.getFullYear() + 1; a >= 2025; a--) anios.push(a);

  const guardar = () => onGuardar({
    ...(inicial || {}),
    titulo, descripcion: f.descripcion, area: f.area,
    periodicidad: f.periodicidad, fechaDesde: rango.desde, fechaHasta: rango.hasta,
    meta: metaNum, unidad: f.unidad || "$",
    // el avance manual arranca en 0; el automático lo calcula el sistema
    valorActual: esAuto ? null : (inicial ? inicial.valorActual : 0),
    responsable: f.responsable, equipo: f.equipo, colaboradores: f.colaboradores,
    notas: f.notas,
  });

  return (
    <div className="objf">
      <header className="objf-head">
        <span className="objf-head-ico" style={{ background: area.bg, color: area.color }}>
          <Ico name={inicial ? "edit" : "target"} size={20} />
        </span>
        <div className="objf-head-txt">
          <h2>{inicial ? "Editar objetivo" : "Creá un nuevo objetivo"}</h2>
          <p>{inicial ? inicial.id : "Completá los datos para definirlo y empezar a seguirlo."}</p>
        </div>
        <button className="btn-ghost" onClick={onCancelar}><Ico name="close" size={15} />Cerrar</button>
      </header>

      <ObjPaso n={1} titulo="¿Qué querés lograr?">
        <div className="objf-grid">
          <ObjCampo label="Área">
            <select className="input" value={f.area} onChange={(e) => cambiarArea(e.target.value)}>
              {OBJ_AREAS.map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}
            </select>
          </ObjCampo>
          <ObjCampo label="Nombre del objetivo" ancho={2}>
            <input className="input" value={f.titulo} onChange={(e) => set("titulo", e.target.value)}
              placeholder={tituloAuto ? tituloAuto : "Ej: Campaña de redes de septiembre"} />
          </ObjCampo>
          <ObjCampo label="Descripción" opcional>
            <input className="input" value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)}
              placeholder="Una línea con el detalle" />
          </ObjCampo>
        </div>
        <div className="objf-chips">
          <span className="objf-chips-l">Objetivos frecuentes:</span>
          {OBJ_PLANTILLAS.map((p) => (
            <button key={p.k} className={"objf-chip" + (f.plantilla === p.k ? " on" : "")} onClick={() => aplicarPlantilla(p)}>
              <Ico name={p.icono} size={14} />{p.label}
            </button>
          ))}
        </div>
      </ObjPaso>

      <ObjPaso n={2} titulo="¿Para cuándo?">
        <div className="objf-periodo">
          <div className="seg">
            {OBJ_PERIODOS.map((p) => (
              <button key={p.k} className={"seg-btn" + (f.periodicidad === p.k ? " is-on" : "")}
                onClick={() => set("periodicidad", p.k)}>{p.label}</button>
            ))}
          </div>

          {f.periodicidad === "diario" && (
            <ObjCampo label="Fecha">
              <input className="input" type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </ObjCampo>
          )}
          {f.periodicidad === "semanal" && (
            <ObjCampo label="Semana">
              <select className="input" value={f.semana} onChange={(e) => set("semana", Number(e.target.value))}>
                {Array.from({ length: objSemanasDelAnio(f.anio) }, (_, i) => i + 1).map((s) => {
                  const l = objLunesDeSemana(f.anio, s), d = new Date(l); d.setDate(d.getDate() + 6);
                  return <option key={s} value={s}>{"Semana " + s + " (" + fmtDateShort(objIso(l)) + " al " + fmtDateShort(objIso(d)) + ")"}</option>;
                })}
              </select>
            </ObjCampo>
          )}
          {f.periodicidad === "mensual" && (
            <div className="fact-mes-pills">
              {OBJ_MESES_CORTO.map((m, i) => (
                <button key={m} className={"fact-mes-pill" + (Number(f.mes) === i + 1 ? " on" : "")}
                  onClick={() => set("mes", i + 1)}>{m}</button>
              ))}
            </div>
          )}
          {f.periodicidad !== "diario" && (
            <ObjCampo label="Año">
              <select className="input" value={f.anio} onChange={(e) => set("anio", Number(e.target.value))}>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </ObjCampo>
          )}
        </div>
        <div className="objf-rango"><Ico name="agenda" size={14} />Del {fmtDate(rango.desde)} al {fmtDate(rango.hasta)}</div>
      </ObjPaso>

      <ObjPaso n={3} titulo="¿Cuánto?"
        nota={esAuto
          ? "El avance se calcula solo con los datos del portal, no hay que cargarlo a mano."
          : "El avance de esta área se carga a mano desde la ficha del objetivo."}>
        <div className="objf-monto-row">
          <div className="objf-monto">
            {objEsPlata(f) && <span className="objf-monto-signo">$</span>}
            <input className="input mono objf-monto-input" inputMode="decimal" value={f.meta}
              onChange={(e) => set("meta", e.target.value)} placeholder="0" aria-label="Meta" />
            {!objEsPlata(f) && f.unidad && <span className="objf-monto-unidad">{f.unidad}</span>}
          </div>
          {f.area === "otro" && (
            <ObjCampo label="Unidad" opcional>
              <input className="input" value={f.unidad} onChange={(e) => set("unidad", e.target.value)} placeholder="$, campañas, llamados…" />
            </ObjCampo>
          )}
          {sugerencias.length > 0 && (
            <div className="objf-sugs">
              <span className="objf-sugs-l">
                {esAuto ? "El período anterior cerró en" : "Tu último objetivo de esta área fue"} <b>{objFmt(f, base)}</b>
              </span>
              <div className="objf-sugs-row">
                {sugerencias.map((s) => (
                  <button key={s.l} className={"objf-sug" + (objNum(f.meta) === s.v ? " on" : "")}
                    onClick={() => set("meta", String(s.v))}>
                    <b>{s.l}</b><span className="mono">{objFmt(f, s.v)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ObjPaso>

      <ObjPaso n={4} titulo="¿Quién es responsable?">
        <div className="objf-grid">
          <ObjCampo label="Responsable">
            <select className="input" value={f.responsable} onChange={(e) => set("responsable", e.target.value)}>
              <option value="">Sin asignar</option>
              {(usuarios || []).map((u) => <option key={u.id} value={u.nombre || u.email}>{u.nombre || u.email}</option>)}
            </select>
          </ObjCampo>
          <ObjCampo label="Equipo" opcional>
            <select className="input" value={f.equipo} onChange={(e) => set("equipo", e.target.value)}>
              <option value="">Sin equipo</option>
              {OBJ_EQUIPOS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
            </select>
          </ObjCampo>
          <ObjCampo label="Colaboradores" opcional ancho={2}>
            <div className="objf-colabs">
              {(usuarios || []).length === 0 && <span className="objf-vacio-inline">No hay otros usuarios cargados</span>}
              {(usuarios || []).map((u) => {
                const nom = u.nombre || u.email;
                const on = f.colaboradores.includes(nom);
                return (
                  <button key={u.id} className={"objf-colab" + (on ? " on" : "")} aria-pressed={on}
                    onClick={() => set("colaboradores", on ? f.colaboradores.filter((x) => x !== nom) : [...f.colaboradores, nom])}>
                    <Ico name={on ? "check" : "plus"} size={13} />{nom}
                  </button>
                );
              })}
            </div>
          </ObjCampo>
        </div>
      </ObjPaso>

      <ObjPaso n={5} titulo="Notas" nota="Opcional: cualquier detalle que ayude a entender el objetivo.">
        <textarea className="input" rows={2} value={f.notas} onChange={(e) => set("notas", e.target.value)}
          placeholder="Ej: se acordó con la compañía un bono si superamos la meta" aria-label="Notas" />
      </ObjPaso>

      <footer className="objf-foot">
        <span className={"objf-frase" + (valido ? " ok" : "")}>{frase}</span>
        <div className="foot-btns">
          <button className="btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button className="btn-primary" disabled={!valido} onClick={guardar}>
            <Ico name="check" size={16} />{inicial ? "Guardar cambios" : "Crear objetivo"}
          </button>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { ObjetivoForm, OBJ_PLANTILLAS });
