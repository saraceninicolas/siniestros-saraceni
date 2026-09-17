// duplicados.jsx — Revisión de posibles asegurados duplicados
// ─────────────────────────────────────────────────────────────────────────────
// Lo que coincide por documento se unifica solo. Acá aparece lo que se PARECE
// por nombre pero no tiene el mismo documento, que es donde hace falta un ojo
// humano: "YEL INFORMATICA" y "YEL INFORMATICA SRL" pueden ser lo mismo, pero
// "JUAN PEREZ" y "JUAN PEREYRA" no.
//
// Unificar es irreversible: los siniestros de una ficha pasan a la otra y la
// absorbida se borra. Por eso cada tarjeta muestra los dos lados con sus datos
// y cuántos siniestros tiene cada una, y hay que elegir explícitamente cuál se
// conserva. No hay un botón "unificar" a secas.
// ─────────────────────────────────────────────────────────────────────────────

function DupFicha({ a, elegida, onElegir }) {
  return (
    <button type="button"
      className={"dup-ficha" + (elegida ? " is-elegida" : "")}
      onClick={onElegir}>
      <div className="dup-ficha-top">
        <span className="dup-ficha-nom">{a.nombre}</span>
        {elegida && <span className="dup-check"><Ico name="check" size={13} />Se conserva</span>}
      </div>
      <div className="dup-ficha-datos">
        <span className="mono">{a.documento || "sin documento"}</span>
        {a.email && <span>· {a.email}</span>}
        {a.telefono && <span className="mono">· {a.telefono}</span>}
      </div>
      <div className="dup-ficha-sin">
        {a.siniestros === 0 ? "sin siniestros"
          : a.siniestros === 1 ? "1 siniestro"
          : a.siniestros + " siniestros"}
      </div>
    </button>
  );
}

function DuplicadosView({ quien, onAviso }) {
  const [lista, setLista] = React.useState([]);
  const [cargando, setCargando] = React.useState(true);
  const [elegidas, setElegidas] = React.useState({});   // idPar -> id de la ficha que queda
  const [trabajando, setTrabajando] = React.useState(null);
  const hayDb = !!(window.DB && window.DB.configured() && window.DB.aseg);

  const cargar = React.useCallback(async () => {
    if (!hayDb) { setCargando(false); return; }
    setCargando(true);
    try { setLista(await window.DB.aseg.dup.list()); }
    catch (e) { console.error(e); onAviso && onAviso("No se pudo cargar la lista", true); }
    setCargando(false);
  }, [hayDb, onAviso]);

  React.useEffect(() => { cargar(); }, [cargar]);

  const rebuscar = async () => {
    setTrabajando("buscar");
    try {
      const n = await window.DB.aseg.dup.buscar(0.70);
      onAviso && onAviso(n === 0 ? "No aparecieron pares nuevos"
        : n === 1 ? "Apareció 1 par nuevo para revisar"
        : "Aparecieron " + n + " pares nuevos para revisar");
      await cargar();
    } catch (e) { console.error(e); onAviso && onAviso(e.message || "No se pudo buscar", true); }
    setTrabajando(null);
  };

  const unificar = async (par) => {
    const quedaId = elegidas[par.id] || par.a.id;
    const otra = quedaId === par.a.id ? par.b : par.a;
    const queda = quedaId === par.a.id ? par.a : par.b;
    const cuantos = (n) => (n === 0 ? "sin siniestros" : n === 1 ? "1 siniestro" : n + " siniestros");
    const msg = `Vas a unificar estas dos fichas.\n\n`
      + `SE CONSERVA:  ${queda.nombre} (${cuantos(queda.siniestros)})\n`
      + `SE ABSORBE:   ${otra.nombre} (${cuantos(otra.siniestros)})\n\n`
      + (otra.siniestros === 0
          ? `La ficha absorbida se borra.\n`
          : `${otra.siniestros === 1 ? "Su siniestro pasa" : "Sus " + otra.siniestros + " siniestros pasan"} a la ficha que se conserva, y la otra se borra.\n`)
      + `Esto no se puede deshacer.`;
    if (!window.confirm(msg)) return;
    setTrabajando(par.id);
    try {
      await window.DB.aseg.dup.unificar(quedaId, otra.id, quien);
      onAviso && onAviso(`Unificadas en "${queda.nombre}"`);
      await cargar();
    } catch (e) { console.error(e); onAviso && onAviso(e.message || "No se pudo unificar", true); }
    setTrabajando(null);
  };

  const distintos = async (par) => {
    setTrabajando(par.id);
    try {
      await window.DB.aseg.dup.distintos(par.a.id, par.b.id, quien);
      onAviso && onAviso("Marcadas como personas distintas");
      await cargar();
    } catch (e) { console.error(e); onAviso && onAviso(e.message || "No se pudo guardar", true); }
    setTrabajando(null);
  };

  if (cargando) {
    return <div className="empty"><div className="empty-title">Cargando…</div></div>;
  }

  return (
    <div className="dup-wrap">
      <div className="ag-banner">
        <span className="ag-banner-ico" style={{ background: "#FEF3E2", color: "#B45309" }}>
          <Ico name="user" size={22} />
        </span>
        <div className="ag-banner-txt">
          <span className="ag-banner-title">Posibles asegurados duplicados</span>
          <span className="ag-banner-sub">
            Lo que coincide por documento se unifica solo. Acá aparece lo que se <b>parece</b> por
            nombre, para que decidas vos.
          </span>
        </div>
        <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={rebuscar} disabled={!!trabajando}>
          <Ico name="search" size={15} />{trabajando === "buscar" ? "Buscando…" : "Buscar de nuevo"}
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="empty">
          <div className="empty-ico"><Ico name="check" size={26} /></div>
          <div className="empty-title">No hay duplicados para revisar</div>
          <div className="empty-sub">
            Si acabás de cargar clientes viejos, tocá “Buscar de nuevo” para que los compare.
          </div>
        </div>
      ) : (
        <div className="dup-lista">
          {lista.map((par) => {
            const quedaId = elegidas[par.id] || par.a.id;
            const ocupado = trabajando === par.id;
            return (
              <div className="dup-card" key={par.id}>
                <div className="dup-card-head">
                  <span className="dup-pct">{Math.round(par.parecido * 100)}% parecidos</span>
                  <span className="dup-hint">Elegí cuál se conserva</span>
                </div>
                <div className="dup-par">
                  <DupFicha a={par.a} elegida={quedaId === par.a.id}
                    onElegir={() => setElegidas((p) => ({ ...p, [par.id]: par.a.id }))} />
                  <DupFicha a={par.b} elegida={quedaId === par.b.id}
                    onElegir={() => setElegidas((p) => ({ ...p, [par.id]: par.b.id }))} />
                </div>
                <div className="dup-acciones">
                  <button className="btn-ghost" onClick={() => distintos(par)} disabled={ocupado}>
                    <Ico name="close" size={15} />Son personas distintas
                  </button>
                  <button className="btn-primary" onClick={() => unificar(par)} disabled={ocupado}>
                    <Ico name="check" size={16} />{ocupado ? "Unificando…" : "Es la misma persona"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DuplicadosView, DupFicha });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
