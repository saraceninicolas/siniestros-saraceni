// configuracion.jsx — Los colores de cada broker, editables desde el portal
// ─────────────────────────────────────────────────────────────────────────────
// Hasta acá los colores de un cliente se cambiaban tocando el código, y por eso
// cada demo necesitaba su propia rama. Esta pantalla los deja en manos de cada
// broker: marca, menú, fondo, tarjetas, texto, los cuatro de estado y el logo.
//
// NO se elige tono por tono. De cada color elegido salen todos los derivados
// (bordes, fondos suaves, grises del texto) calculados en `marca.js` midiendo
// contraste: pedirle a un broker que elija veinte grises es pedirle que sea
// diseñador, y el primer texto ilegible lo paga su equipo todos los días.
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

// Los colores que se guardan. Los `auto: true` aceptan quedar vacíos, y vacío
// no es "sin color": es "seguí lo que calcula el tema".
const CFG_CAMPOS = ["color", "menu", "menuColor", "menuTexto", "menuActivo",
  "fondo", "superficie", "texto", "ok", "warn", "peligro", "info", "logo"];

// Lo que el portal termina mostrando, con los valores de fábrica puestos en los
// casilleros vacíos. Los de fábrica viven en marca.js, al lado de los cálculos.
function cfgNormalizar(marca) {
  const f = window.MARCA_FABRICA || {};
  const m = marca || {};
  const out = {};
  CFG_CAMPOS.forEach((k) => {
    out[k] = (m[k] !== undefined && m[k] !== null && m[k] !== "") ? m[k] : (f[k] || "");
  });
  return out;
}

// El color con el que quedó una variable después de aplicar la marca. Sirve
// para que un casillero en automático arranque del color que se está viendo y
// no de un hexadecimal inventado.
function cfgVarActual(nombre, sino) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : sino;
  } catch (e) { return sino; }
}

function CfgColor({ label, pista, valor, defecto, onCambio, onAuto }) {
  const enAuto = onAuto && !valor;
  const mostrado = valor || defecto || "#000000";
  return (
    <div className="cfg-campo">
      <div className="cfg-campo-cab">
        <span className="cfg-campo-lab">{label}</span>
        {enAuto && <span className="cfg-auto-tag">Automático</span>}
        {onAuto && !enAuto && (
          <button type="button" className="cfg-auto" onClick={onAuto}>Volver a automático</button>
        )}
      </div>
      <div className="cfg-fila">
        <input type="color" className="cfg-color" value={mostrado}
          onChange={(e) => onCambio(e.target.value)} aria-label={label} />
        <input className="input mono" value={mostrado.toUpperCase()}
          onChange={(e) => { const v = e.target.value.trim(); onCambio(v.startsWith("#") ? v : "#" + v); }}
          spellCheck="false" />
      </div>
      {pista && <p className="cfg-pista">{pista}</p>}
    </div>
  );
}

// Con qué compañías trabaja el broker. Antes era una constante del código con
// las siete de Saraceni, así que cualquier otro veía compañías ajenas al cargar
// un siniestro y no había forma de arreglarlo sin tocar el código.
//
// Guarda en el momento, sin botón: son filas sueltas, no un formulario. Y no
// borra de verdad al sacar una: `siniestros.cia` es texto libre, hay
// siniestros viejos que la nombran, y esconderla alcanza para que no vuelva a
// elegirse. Borrar del todo queda en la lista de las que no usa.
function CfgCompanias({ onAviso }) {
  const [lista, setLista] = React.useState(null);
  const [nueva, setNueva] = React.useState("");
  const [editando, setEditando] = React.useState(null);
  const [texto, setTexto] = React.useState("");
  const [verSacadas, setVerSacadas] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try { setLista(await window.DB.cias.todas()); }
    catch (e) { console.error(e); setLista([]); }
  }, []);
  React.useEffect(() => { cargar(); }, [cargar]);

  // La clave es lo que queda escrito en cada siniestro: sin tildes, en
  // mayúsculas y sin símbolos, para que no haya dos formas de escribir la misma.
  const claveDe = (nombre) => String(nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, 40);

  const fallar = (e) => {
    console.error(e);
    const dup = String(e && e.message || "").includes("duplicate") || (e && e.code) === "23505";
    onAviso(dup ? "Esa compañía ya está en la lista" : "No se pudo guardar el cambio", true);
  };

  const agregar = async () => {
    const nombre = nueva.trim();
    const clave = claveDe(nombre);
    if (!clave) return;
    try {
      const orden = (lista || []).reduce((m, c) => Math.max(m, c.orden || 0), 0) + 10;
      await window.DB.cias.create({ clave, nombre, orden });
      setNueva(""); await cargar(); onAviso(nombre + " agregada");
    } catch (e) { fallar(e); }
  };

  const renombrar = async (c) => {
    const nombre = texto.trim();
    setEditando(null);
    if (!nombre || nombre === c.nombre) return;
    // Solo cambia cómo se muestra: la clave se queda quieta, si no los
    // siniestros ya cargados dejarían de reconocerla.
    try { await window.DB.cias.update({ id: c.id, nombre }); await cargar(); }
    catch (e) { fallar(e); }
  };

  const usar = async (c, activa) => {
    try { await window.DB.cias.update({ id: c.id, activa }); await cargar(); }
    catch (e) { fallar(e); }
  };

  const borrar = async (c) => {
    try { await window.DB.cias.remove(c.id); await cargar(); onAviso(c.nombre + " borrada"); }
    catch (e) { fallar(e); }
  };

  if (lista === null) return <div className="ch-vacio">Cargando compañías…</div>;

  const activas = lista.filter((c) => c.activa);
  const sacadas = lista.filter((c) => !c.activa);

  return (
    <div className="cfg-cias">
      <div className="cfg-cias-alta">
        <input className="input" value={nueva} placeholder="Agregar una compañía…"
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} />
        <button className="btn-primary" onClick={agregar} disabled={!nueva.trim()}>
          <Ico name="plus" size={15} />Agregar
        </button>
      </div>

      {activas.length === 0 && <div className="ch-vacio">Todavía no cargaste ninguna compañía.</div>}

      <div className="cfg-cias-lista">
        {activas.map((c) => (
          <div className="cfg-cia" key={c.id}>
            {editando === c.id ? (
              <input className="input" autoFocus value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onBlur={() => renombrar(c)}
                onKeyDown={(e) => { if (e.key === "Enter") renombrar(c); if (e.key === "Escape") setEditando(null); }} />
            ) : (
              <button className="cfg-cia-nom" onClick={() => { setEditando(c.id); setTexto(c.nombre); }}
                title="Tocá para cambiarle el nombre">{c.nombre}</button>
            )}
            <span className="cfg-cia-clave mono">{c.clave}</span>
            <button className="btn-ghost sm" onClick={() => usar(c, false)}>Sacar</button>
          </div>
        ))}
      </div>

      {sacadas.length > 0 && (
        <div className="cfg-cias-sacadas">
          <button className="cfg-cias-toggle" onClick={() => setVerSacadas(!verSacadas)}>
            <Ico name={verSacadas ? "chevR" : "chevR"} size={14} />
            {sacadas.length} que no usás
          </button>
          {verSacadas && sacadas.map((c) => (
            <div className="cfg-cia is-off" key={c.id}>
              <span className="cfg-cia-nom">{c.nombre}</span>
              <span className="cfg-cia-clave mono">{c.clave}</span>
              <button className="btn-ghost sm" onClick={() => usar(c, true)}>Volver a usar</button>
              <button className="btn-ghost sm danger" onClick={() => borrar(c)} title="Borrar de la lista">
                <Ico name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  // Lo guardado y la empresa, en referencias: el efecto de abajo tiene que
  // correr SOLO al salir de la pantalla. Con `guardado` en las dependencias,
  // React también lo ejecutaba al terminar de cargar —porque ahí cambia— y
  // repintaba el portal con los valores por defecto. Se veía así: elegías un
  // color, salías (quedaba bien) y al volver a Ajustes se iba el color.
  const guardadoRef = React.useRef(guardado);
  const orgRef = React.useRef(org);
  React.useEffect(() => { guardadoRef.current = guardado; orgRef.current = org; }, [guardado, org]);

  // Al salir de la pantalla sin guardar, el portal vuelve a lo que está en la
  // base. Sin esto, alguien probaría cinco colores y se quedaría con el último.
  React.useEffect(() => () => {
    window.aplicarMarca({ ...guardadoRef.current, nombre: orgRef.current && orgRef.current.nombre });
  }, []);

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

  // Vuelve a los colores originales del portal sin tocar el logo: el logo es de
  // la empresa, los colores son una decisión de diseño que se puede deshacer.
  const deFabrica = (campos) => {
    const f = window.MARCA_FABRICA || {};
    const cambio = {};
    (campos || CFG_CAMPOS.filter((k) => k !== "logo")).forEach((k) => { cambio[k] = f[k] || ""; });
    aplicar(cambio);
  };

  const hayCambios = archivo || CFG_CAMPOS.some((k) => form[k] !== guardado[k]);

  if (cargando) return <div className="ch-vacio">Cargando…</div>;
  if (!org) {
    return (
      <div className="panel cfg-sin-org">
        <h3>Todavía no hay empresa configurada</h3>
        <p>Esta pantalla edita los colores de tu empresa, y este portal todavía no está
          asociado a ninguna. Cuando lo esté, vas a poder elegir acá tus colores y tu logo.</p>
      </div>
    );
  }

  const tema = CFG_TEMAS.find((t) => t.valor === form.menu) || CFG_TEMAS[0];
  const btnFabrica = (campos) => (
    <button className="btn-ghost sm" onClick={() => deFabrica(campos)}>Volver a los de fábrica</button>
  );

  return (
    <div className="est-wrap">
      <div className="cfg-cab">
        <div>
          <h2>Ajustes de {org.nombre}</h2>
          <p>Lo que elijas se ve al instante mientras probás, sobre el portal entero. Recién
            queda para todo tu equipo cuando tocás Guardar.</p>
        </div>
        <div className="cfg-acciones">
          <button className="btn-ghost" onClick={() => deFabrica()}>De fábrica</button>
          <button className="btn-ghost" onClick={deshacer} disabled={!hayCambios || guardando}>Deshacer</button>
          <button className="btn-primary" onClick={guardar} disabled={!hayCambios || guardando}>
            <Ico name="check" size={16} />{guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="est-grid">
        <EstCard title="Color de la marca" sub="botones, resaltados y detalles del portal">
          <CfgColor label="Color principal" valor={form.color} defecto="#DD0909"
            onCambio={(v) => aplicar({ color: v })}
            pista="Los tonos suaves, los bordes y los dos colores de texto se calculan solos a partir de este, midiendo contraste para que nada quede ilegible." />
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
          <div className="cfg-campos">
            <CfgColor label="Fondo del menú" valor={form.menuColor} defecto="#1C1313"
              onCambio={(v) => aplicar({ menuColor: v, menu: "personalizado" })}
              pista="Tocarlo ya te pasa a «Elegir color»." />
            <CfgColor label="Texto del menú" valor={form.menuTexto}
              defecto={cfgVarActual("--sb-ink-fuerte", "#FFFFFF")}
              onCambio={(v) => aplicar({ menuTexto: v })}
              onAuto={() => aplicar({ menuTexto: "" })}
              pista="En automático se aclara u oscurece según el fondo del menú." />
            <CfgColor label="Opción abierta" valor={form.menuActivo}
              defecto={cfgVarActual("--sb-active", "#2A1E1E")}
              onCambio={(v) => aplicar({ menuActivo: v })}
              onAuto={() => aplicar({ menuActivo: "" })}
              pista="El fondo de la carpeta o la pantalla en la que estás parado." />
          </div>
        </EstCard>

        <EstCard title="Pantalla" sub="el fondo, las tarjetas y el texto de todo el portal"
          right={btnFabrica(["fondo", "superficie", "texto"])}>
          <div className="cfg-campos">
            <CfgColor label="Fondo" valor={form.fondo} defecto="#F5F6F8"
              onCambio={(v) => aplicar({ fondo: v })}
              pista="Lo que se ve detrás de las tarjetas." />
            <CfgColor label="Tarjetas y paneles" valor={form.superficie} defecto="#FFFFFF"
              onCambio={(v) => aplicar({ superficie: v })}
              pista="El papel sobre el que se apoya todo: tablas, fichas, modales." />
            <CfgColor label="Texto" valor={form.texto} defecto="#191C22"
              onCambio={(v) => aplicar({ texto: v })}
              pista="De este color salen también los grises secundarios y los bordes. Si no llega a leerse sobre las tarjetas, se ajusta solo." />
          </div>
        </EstCard>

        <EstCard title="Colores de estado" sub="el semáforo del portal"
          right={btnFabrica(["ok", "warn", "peligro", "info"])}>
          <div className="cfg-campos cfg-campos-2">
            <CfgColor label="Terminado" valor={form.ok} defecto="#15803D"
              onCambio={(v) => aplicar({ ok: v })} />
            <CfgColor label="Por vencer" valor={form.warn} defecto="#D97706"
              onCambio={(v) => aplicar({ warn: v })} />
            <CfgColor label="Vencido o alerta" valor={form.peligro} defecto="#DC2626"
              onCambio={(v) => aplicar({ peligro: v })} />
            <CfgColor label="Información" valor={form.info} defecto="#1A73E8"
              onCambio={(v) => aplicar({ info: v })} />
          </div>
          <p className="cfg-aviso">
            <Ico name="alert" size={14} />
            Estos cuatro son el idioma del portal: verde terminado, ámbar por vencer, rojo
            vencido. Cambiarlos cambia el semáforo en todas las pantallas a la vez, así que
            conviene tocarlos solo si chocan con tu marca.
          </p>
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

      <div className="est-grid cfg-grid-ancha">
        <EstCard title="Compañías con las que trabajás"
          sub="las que aparecen al cargar un siniestro y en el filtro de la tabla">
          <CfgCompanias onAviso={onAviso} />
        </EstCard>
      </div>
    </div>
  );
}

Object.assign(window, { ConfiguracionView, CfgColor, CfgCompanias, cfgNormalizar });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
