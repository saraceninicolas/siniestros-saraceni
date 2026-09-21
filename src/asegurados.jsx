// asegurados.jsx — Buscador de asegurado con autocompletado
// ─────────────────────────────────────────────────────────────────────────────
// Reemplaza al campo "Cliente" de texto libre, que es de donde salían los
// duplicados: el mismo cliente se escribía distinto cada vez y el sistema no
// tenía forma de saber que era la misma persona.
//
// Cómo funciona:
//   · Al escribir el DOCUMENTO, en cuanto tiene largo de DNI o CUIT busca la
//     ficha y completa el nombre, el email y el teléfono solos. Es el camino
//     más confiable: el documento identifica sin ambigüedad.
//   · Al escribir el NOMBRE aparece una lista de fichas parecidas para elegir.
//   · Elegida la ficha, se muestra cuántos siniestros tiene. Eso es lo que
//     convierte el dato en algo útil: se ve al toque si es un cliente que ya
//     tuvo tres choques este año.
//
// El documento se guarda tal cual lo escribieron; la base se encarga de
// normalizarlo para comparar. Si el CUIT está mal tipeado se avisa en el
// momento, que es cuando el cliente todavía tiene el papel a mano.
// ─────────────────────────────────────────────────────────────────────────────

// Mismo cálculo que `cuit_valido()` en Postgres. Devuelve null si no son 11
// dígitos: "esto no es un CUIT, no opino".
function asegCuitValido(txt) {
  const d = String(txt || "").replace(/[^0-9]/g, "");
  if (d.length !== 11) return null;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) suma += Number(d[i]) * pesos[i];
  let v = 11 - (suma % 11);
  if (v === 11) v = 0; else if (v === 10) v = 9;
  return v === Number(d[10]);
}

// ¿Alcanza para identificar a alguien? Un DNI (7 u 8 números: con menos no hay
// nadie vivo, y suele ser un CUIT a medio escribir) o un CUIT de 11 con el
// dígito verificador bien. Es lo que se
// exige para registrar un siniestro nuevo.
function asegDocValido(txt) {
  const d = String(txt || "").replace(/[^0-9]/g, "");
  if (d.length === 11) return asegCuitValido(d) === true;
  return d.length >= 7 && d.length <= 8;
}

function BuscadorAsegurado({ nombre, documento, aseguradoId, conError, docObligatorio, onCambio }) {
  const [sugerencias, setSugerencias] = React.useState([]);
  const [abierto, setAbierto] = React.useState(false);
  const [ficha, setFicha] = React.useState(null);      // la ficha enganchada
  const [cantidad, setCantidad] = React.useState(null); // sus siniestros
  const [buscando, setBuscando] = React.useState(false);
  const hayDb = !!(window.DB && window.DB.configured() && window.DB.aseg);

  const cuitOk = asegCuitValido(documento);
  const digitos = String(documento || "").replace(/[^0-9]/g, "").length;
  // Largo imposible para un DNI o un CUIT. El CUIT de 11 con el verificador
  // mal tiene su propio aviso más abajo.
  const largoRaro = digitos > 0 && digitos !== 11 && (digitos < 7 || digitos > 8);

  // Al abrir en modo edición, recuperar la ficha ya enganchada.
  React.useEffect(() => {
    let vivo = true;
    if (!hayDb || !aseguradoId) { setCantidad(null); return; }
    (async () => {
      try {
        const ss = await window.DB.aseg.siniestros(aseguradoId);
        if (vivo) setCantidad(ss.length);
      } catch (e) { /* no es crítico: es informativo */ }
    })();
    return () => { vivo = false; };
  }, [aseguradoId, hayDb]);

  // Buscar por documento con un respiro, para no consultar en cada tecla.
  React.useEffect(() => {
    if (!hayDb) return;
    const soloNum = String(documento || "").replace(/[^0-9]/g, "");
    if (soloNum.length < 7) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const a = await window.DB.aseg.porDocumento(documento);
        if (!vivo) return;
        if (a) {
          setFicha(a);
          // Completa lo que esté vacío. No pisa lo que el usuario ya escribió:
          // puede estar corrigiendo un nombre mal cargado.
          onCambio({
            aseguradoId: a.id,
            cliente: String(nombre || "").trim() ? nombre : a.nombre,
          });
        }
      } catch (e) { console.error(e); }
      if (vivo) setBuscando(false);
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
    // `nombre` a propósito fuera de las dependencias: si estuviera, cada letra
    // del nombre relanzaría la búsqueda por documento.
    // eslint-disable-next-line
  }, [documento, hayDb]);

  const buscarPorNombre = async (txt) => {
    onCambio({ cliente: txt, aseguradoId: null });
    setFicha(null);
    if (!hayDb || txt.trim().length < 2) { setSugerencias([]); setAbierto(false); return; }
    try {
      const rs = await window.DB.aseg.buscar(txt);
      setSugerencias(rs);
      setAbierto(rs.length > 0);
    } catch (e) { console.error(e); }
  };

  const elegir = async (a) => {
    setFicha(a);
    setAbierto(false);
    setSugerencias([]);
    onCambio({ cliente: a.nombre, clienteDoc: a.documento || "", aseguradoId: a.id });
  };

  const desenganchar = () => {
    setFicha(null); setCantidad(null);
    onCambio({ aseguradoId: null });
  };

  const enganchada = ficha || (aseguradoId ? { id: aseguradoId, nombre } : null);

  return (
    <>
      <Field label="Cliente" required full>
        <div className="aseg-box">
          <input
            className={"input" + (conError ? " err" : "")}
            value={nombre}
            onChange={(e) => buscarPorNombre(e.target.value)}
            onFocus={() => sugerencias.length && setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 180)}
            placeholder="Nombre / razón social" autoComplete="off" />
          {abierto && sugerencias.length > 0 && (
            <div className="aseg-lista">
              <div className="aseg-lista-tit">Fichas que ya existen</div>
              {sugerencias.map((a) => (
                <button type="button" className="aseg-op" key={a.id} onMouseDown={() => elegir(a)}>
                  <span className="aseg-op-nom">{a.nombre}</span>
                  <span className="aseg-op-doc mono">{a.documento || "sin documento"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field label="DNI / CUIT del asegurado" required={docObligatorio}>
        <input
          className={"input mono" + (cuitOk === false || largoRaro ? " err" : "")}
          value={documento}
          onChange={(e) => onCambio({ clienteDoc: e.target.value })}
          placeholder="Sin puntos" inputMode="numeric" autoComplete="off" />
        {cuitOk === false && (
          <span className="aseg-aviso malo">
            <Ico name="alert" size={13} />Ese CUIT no es válido: revisá los números.
          </span>
        )}
        {largoRaro && (
          <span className="aseg-aviso malo">
            <Ico name="alert" size={13} />Revisá el número: un DNI tiene 7 u 8 números y un CUIT, 11.
          </span>
        )}
        {/* Aparece recién cuando ya escribieron el nombre: antes es ruido. */}
        {docObligatorio && !digitos && String(nombre || "").trim() && (
          <span className="aseg-aviso">
            <Ico name="alert" size={13} />Obligatorio: es lo que evita que un cliente quede cargado dos veces.
          </span>
        )}
        {buscando && <span className="aseg-aviso"><Ico name="search" size={13} />Buscando ficha…</span>}
      </Field>

      {enganchada && (
        <div className="aseg-ficha field-full">
          <span className="aseg-ficha-ico"><Ico name="user" size={16} /></span>
          <div className="aseg-ficha-txt">
            <b>Ficha existente</b>
            <span>
              {enganchada.nombre}
              {cantidad != null && (
                <> · {cantidad === 0 ? "sin siniestros previos"
                     : cantidad === 1 ? "1 siniestro previo"
                     : cantidad + " siniestros previos"}</>
              )}
            </span>
          </div>
          <button type="button" className="btn-ghost sm" onClick={desenganchar} title="Cargar como cliente nuevo">
            No es este
          </button>
        </div>
      )}
    </>
  );
}

Object.assign(window, { BuscadorAsegurado, asegCuitValido, asegDocValido });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
