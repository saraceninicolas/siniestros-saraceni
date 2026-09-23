// configuracion.jsx — La marca de cada broker, editable desde el portal
// ─────────────────────────────────────────────────────────────────────────────
// Hasta acá los colores de un cliente se cambiaban tocando el código, y por eso
// cada demo necesitaba su propia rama. Esta pantalla los deja en manos de cada
// broker: elige su color, el tema del menú y sube su logo.
//
// Los cambios se aplican EN VIVO mientras elige, sobre el portal entero, no
// sobre una maqueta: es la única forma de que vea de verdad cómo le queda. Por
// eso al salir sin guardar hay que devolver lo guardado (`aplicarMarca` con lo
// que vino de la base), o se iría con colores que su equipo no tiene.
//
// Lo que NO se puede tocar desde acá —nombre, dirección pública y estado de la
// empresa— es a propósito: eso lo maneja el portal de administración. En la
// base está cerrado por privilegios de columna, no solo escondido acá.
// ─────────────────────────────────────────────────────────────────────────────

const CFG_TEMAS = [
  { valor: "auto", label: "Automático", pista: "Se aclara u oscurece según tu color" },
  { valor: "oscuro", label: "Oscuro", pista: "Menú oscuro teñido con tu color" },
  { valor: "claro", label: "Claro", pista: "Menú blanco" },
  { valor: "marca", label: "De la marca", pista: "El menú en tu color" },
  { valor: "personalizado", label: "Elegir color", pista: "Vos elegís el color del menú" },
];
const CFG_LOGO_MAX = 2 * 1024 * 1024;   // 2 MB: un logo bien exportado pesa mucho menos

// Lo que el portal termina mostrando, con los valores por defecto puestos.
function cfgNormalizar(marca) {
  const m = marca || {};
  return {
    color: m.color || "#DD0909",
    menu: m.menu || "auto",
    menuColor: m.menuColor || "#1C1313",
    logo: m.logo || "",
  };
}

function ConfiguracionView({ quien, onAviso }) {
  const [org, setOrg] = React.useState(null);
  const [cargando, setCargando] = React.useState(true);
  const [form, setForm] = React.useState(cfgNormalizar(null));
  const [guardado, setGuardado] = React.useState(cfgNormalizar(null));
  const [archivo, setArchivo] = React.useState(null);      // logo elegido, todavía sin subir
  const [guardando, setGuardando] = React.useState(false);
  const hayDb = !!(window.DB && window.DB.configured() && window.DB.org);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      if (!hayDb) { setCargando(false); return; }
      const o = await window.DB.org.mia();
      if (!vivo) return;
      setOrg(o);
      const m = cfgNormalizar(o && o.marca);
      setForm(m); setGuardado(m);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [hayDb]);

  // Al salir de la pantalla sin guardar, el portal vuelve a lo que está en la
  // base. Sin esto, alguien probaría cinco colores y se quedaría con el último.
  React.useEffect(() => () => {
    window.aplicarMarca({ ...guardado, nombre: org && org.nombre });
  }, [guardado, org]);

  const aplicar = (cambio) => {
    const nuevo = { ...form, ...cambio };
    setForm(nuevo);
    window.aplicarMarca({ ...nuevo, nombre: org && org.nombre });
  };

  const elegirLogo = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) { onAviso && onAviso("Eso no es una imagen", true); return; }
    if (f.size > CFG_LOGO_MAX) {
      onAviso && onAviso("El logo pesa " + pesoLegible(f.size) + ": el máximo es 2 MB", true);
      return;
    }
    setArchivo(f);
    // Se muestra al instante desde el navegador; recién se sube al guardar.
    aplicar({ logo: URL.createObjectURL(f) });
  };

  const guardar = async () => {
    if (!org) return;
    setGuardando(true);
    try {
      let marca = { ...form };
      if (archivo) marca.logo = await window.DB.org.subirLogo(org.id, archivo);
      const guardadaEnBase = await window.DB.org.guardarMarca(org.id, marca);
      const m = cfgNormalizar(guardadaEnBase);
      setGuardado(m); setForm(m); setArchivo(null);
      window.aplicarMarca({ ...m, nombre: org.nombre });
      onAviso && onAviso("Listo: así lo va a ver todo tu equipo");
    } catch (e) {
      console.error(e);
      onAviso && onAviso("No se pudo guardar: " + (e.message || "error"), true);
    }
    setGuardando(false);
  };

  const deshacer = () => {
    setArchivo(null);
    setForm(guardado);
    window.aplicarMarca({ ...guardado, nombre: org && org.nombre });
  };

  const hayCambios = archivo ||
    ["color", "menu", "menuColor", "logo"].some((k) => form[k] !== guardado[k]);

  if (cargando) return <div className="ch-vacio">Cargando…</div>;
  if (!org) {
    return (
      <div className="panel cfg-sin-org">
        <h3>Todavía no hay empresa configurada</h3>
        <p>Esta pantalla edita la marca de tu empresa, y este portal todavía no está
          asociado a ninguna. Cuando lo esté, vas a poder elegir acá tus colores y tu logo.</p>
      </div>
    );
  }

  const tema = CFG_TEMAS.find((t) => t.valor === form.menu) || CFG_TEMAS[0];

  return (
    <div className="est-wrap">
      <div className="cfg-cab">
        <div>
          <h2>Marca de {org.nombre}</h2>
          <p>Lo que elijas se ve al instante mientras probás. Recién queda para todo tu
            equipo cuando tocás Guardar.</p>
        </div>
        <div className="cfg-acciones">
          <button className="btn-ghost" onClick={deshacer} disabled={!hayCambios || guardando}>Deshacer</button>
          <button className="btn-primary" onClick={guardar} disabled={!hayCambios || guardando}>
            <Ico name="check" size={16} />{guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="est-grid">
        <EstCard title="Color de la marca" sub="botones, resaltados y detalles del portal">
          <div className="cfg-fila">
            <input type="color" className="cfg-color" value={form.color}
              onChange={(e) => aplicar({ color: e.target.value })} aria-label="Color de la marca" />
            <input className="input mono" value={form.color.toUpperCase()}
              onChange={(e) => { const v = e.target.value.trim();
                aplicar({ color: v.startsWith("#") ? v : "#" + v }); }} spellCheck="false" />
          </div>
          <p className="cfg-pista">
            Los tonos suaves, los bordes y los dos colores de texto se calculan solos a
            partir de este, midiendo contraste para que nada quede ilegible.
          </p>
        </EstCard>

        <EstCard title="Menú lateral" sub={tema.pista}>
          <div className="cfg-temas">
            {CFG_TEMAS.map((t) => (
              <button key={t.valor} type="button"
                className={"cfg-tema" + (form.menu === t.valor ? " is-on" : "")}
                aria-pressed={form.menu === t.valor}
                onClick={() => aplicar({ menu: t.valor })}>{t.label}</button>
            ))}
          </div>
          <div className="cfg-fila" style={{ marginTop: 10 }}>
            <input type="color" className="cfg-color" value={form.menuColor}
              onChange={(e) => aplicar({ menuColor: e.target.value, menu: "personalizado" })}
              aria-label="Color del menú" />
            <input className="input mono" value={form.menuColor.toUpperCase()}
              onChange={(e) => { const v = e.target.value.trim();
                aplicar({ menuColor: v.startsWith("#") ? v : "#" + v, menu: "personalizado" }); }}
              spellCheck="false" />
          </div>
          <p className="cfg-pista">Tocar este color ya te pasa a «Elegir color». El texto del
            menú se aclara o se oscurece solo, según lo que elijas.</p>
        </EstCard>

        <EstCard title="Logo" sub="se ve arriba del menú y en los PDF">
          <div className="cfg-logo">
            <div className="cfg-logo-caja">
              {form.logo
                ? <img src={form.logo} alt={"Logo de " + org.nombre} />
                : <span className="cfg-logo-sin">Sin logo cargado</span>}
            </div>
            <div className="cfg-logo-acciones">
              <label className="btn-ghost sm cfg-subir">
                <Ico name="image" size={15} />{form.logo ? "Cambiar logo" : "Subir logo"}
                <input type="file" accept="image/*" onChange={elegirLogo} />
              </label>
              {form.logo && (
                <button className="btn-ghost sm danger" onClick={() => { setArchivo(null); aplicar({ logo: "" }); }}>
                  Quitar
                </button>
              )}
              <span className="cfg-pista">PNG o JPG, hasta 2 MB. Se ve mejor con fondo transparente.</span>
              {archivo && <span className="aseg-aviso"><Ico name="alert" size={13} />Se sube cuando guardes.</span>}
            </div>
          </div>
        </EstCard>
      </div>
    </div>
  );
}

Object.assign(window, { ConfiguracionView });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
