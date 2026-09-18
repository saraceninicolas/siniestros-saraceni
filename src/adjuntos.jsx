// adjuntos.jsx — Grilla de adjuntos, visor de fotos y descarga en lote
// ─────────────────────────────────────────────────────────────────────────────
// La grilla estaba copiada igual en detail.jsx y en solicitudes.jsx. Acá vive
// una sola vez, con dos cosas que antes no tenía:
//
//   · VISOR: tocar una foto la abre en la misma pantalla, encima, con flechas
//     para pasar a la siguiente. Antes abría una pestaña nueva por foto, así
//     que revisar una denuncia de 6 fotos dejaba 6 pestañas abiertas y había
//     que volver a buscar la solicitud cada vez.
//   · DESCARGAR TODAS: baja un único .zip. Bajarlas de a una no alcanza: los
//     navegadores bloquean la segunda descarga seguida y aparece el cartel de
//     "¿permitir varias descargas?", que la mitad de las veces se rechaza.
//
// Los PDF siguen abriéndose en pestaña nueva a propósito: el navegador los
// muestra con su propio lector, que es mejor que cualquier cosa que podamos
// dibujar acá.
// ─────────────────────────────────────────────────────────────────────────────

function adjEsImagen(a) {
  return !!(a && a.tipo && a.tipo.indexOf("image") === 0);
}

// Nombre con el que se guarda cada archivo adentro del zip. Se numeran para
// que conserven el orden en que se sacaron, y si la foto vino de un marco del
// formulario se usa esa etiqueta ("Cédula verde") en vez del nombre original,
// que suele ser IMG_4821.jpg y no dice nada.
function adjNombreEnZip(a, i) {
  const ext = (a.name || "").match(/\.[^.]+$/);
  const base = (a.etiqueta || (a.name || "archivo").replace(/\.[^.]+$/, ""))
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  return String(i + 1).padStart(2, "0") + " - " + base + (ext ? ext[0] : "");
}

function AdjuntoVisor({ adjuntos, urls, indice, onCerrar, onIr }) {
  const a = adjuntos[indice];
  const url = a ? urls[a.path] : null;

  React.useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") onIr(1);
      else if (e.key === "ArrowLeft") onIr(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar, onIr]);

  if (!a) return null;
  const solo = adjuntos.length <= 1;
  return (
    <div className="visor" onMouseDown={onCerrar}>
      <div className="visor-barra" onMouseDown={(e) => e.stopPropagation()}>
        <span className="visor-tit">{a.etiqueta || a.name}</span>
        <span className="visor-pos">{indice + 1} de {adjuntos.length}</span>
        <a className="btn-ghost sm visor-bajar" href={url || "#"} download={a.name || "foto"}
          onClick={(e) => { if (!url) e.preventDefault(); }}>
          <Ico name="download" size={14} />Descargar
        </a>
        <button className="btn-ghost sm" type="button" onClick={onCerrar}><Ico name="close" size={16} />Cerrar</button>
      </div>

      {!solo && (
        <button className="visor-flecha izq" type="button" title="Anterior (←)"
          onMouseDown={(e) => e.stopPropagation()} onClick={() => onIr(-1)}>
          <Ico name="chevL" size={26} />
        </button>
      )}

      <img className="visor-img" src={url || ""} alt={a.name}
        onMouseDown={(e) => e.stopPropagation()} />

      {!solo && (
        <button className="visor-flecha der" type="button" title="Siguiente (→)"
          onMouseDown={(e) => e.stopPropagation()} onClick={() => onIr(1)}>
          <Ico name="chevR" size={26} />
        </button>
      )}
    </div>
  );
}

function AdjuntosGrid({ adjuntos, urls, nombreZip }) {
  const [visor, setVisor] = React.useState(null);   // índice dentro de `fotos`
  const [bajando, setBajando] = React.useState(false);
  const [error, setError] = React.useState("");

  const lista = adjuntos || [];
  // El visor pasa de foto en foto, así que solo recorre imágenes: si incluyera
  // los PDF, la flecha llevaría a una pantalla en blanco.
  const fotos = lista.filter(adjEsImagen);

  const descargarTodas = async () => {
    setError(""); setBajando(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let agregados = 0;
      await Promise.all(lista.map(async (a, i) => {
        const url = urls[a.path];
        if (!url) return;
        const r = await fetch(url);
        if (!r.ok) return;
        zip.file(adjNombreEnZip(a, i), await r.blob());
        agregados++;
      }));
      if (!agregados) throw new Error("no se pudo bajar ningún archivo");
      const blob = await zip.generateAsync({ type: "blob" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = (nombreZip || "adjuntos").replace(/[\\/:*?"<>|]/g, "-") + ".zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Sin esto el blob queda en memoria hasta recargar la página.
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch (e) {
      console.error(e);
      setError("No se pudieron descargar. Probá de nuevo.");
    }
    setBajando(false);
  };

  if (!lista.length) return null;
  const listas = lista.filter((a) => urls[a.path]).length;

  return (
    <>
      <div className="adj-head">
        <span className="adj-head-txt">
          {lista.length} {lista.length === 1 ? "archivo" : "archivos"}
          {listas < lista.length && <span className="adj-head-cargando"> · preparando {lista.length - listas}…</span>}
        </span>
        <button className="btn-ghost sm" type="button" onClick={descargarTodas} disabled={bajando || !listas}>
          <Ico name="download" size={14} />{bajando ? "Preparando…" : "Descargar todas"}
        </button>
      </div>
      {error && <div className="login-err" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="adj-grid">
        {lista.map((a, i) => {
          const url = urls[a.path];
          const esImg = adjEsImagen(a);
          const nombre = a.etiqueta || a.name;
          // Las fotos abren el visor; los PDF siguen yendo a pestaña nueva.
          if (esImg) {
            return (
              <button className="adj-card" type="button" key={a.path || i} disabled={!url}
                title={a.etiqueta ? a.etiqueta + " — " + a.name : a.name}
                onClick={() => setVisor(fotos.indexOf(a))}>
                {url
                  ? <img className="adj-thumb" src={url} alt={a.name} loading="lazy" decoding="async" />
                  : <span className="adj-thumb adj-thumb-file"><Ico name="image" size={24} /></span>}
                <span className="adj-card-name">{nombre}</span>
              </button>
            );
          }
          return (
            <a className="adj-card" key={a.path || i} href={url || "#"} target="_blank" rel="noreferrer"
              title={nombre} onClick={(e) => { if (!url) e.preventDefault(); }}>
              <span className="adj-thumb adj-thumb-file"><Ico name="doc" size={24} /></span>
              <span className="adj-card-name">{nombre}</span>
            </a>
          );
        })}
      </div>

      {visor !== null && fotos.length > 0 && (
        <AdjuntoVisor
          adjuntos={fotos} urls={urls} indice={visor}
          onCerrar={() => setVisor(null)}
          onIr={(d) => setVisor((n) => (n + d + fotos.length) % fotos.length)} />
      )}
    </>
  );
}

Object.assign(window, { AdjuntosGrid, AdjuntoVisor, adjEsImagen, adjNombreEnZip });

// Marca este archivo como modulo ES. Sin esto el compilador lo toma por
// script (no tiene ningun import/export todavia) y compila el JSX a require(),
// que en el navegador no existe. Se va cuando el archivo tenga imports de verdad.
export {};
