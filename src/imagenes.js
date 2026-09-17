// imagenes.js — Achica las fotos antes de subirlas a Supabase
// ─────────────────────────────────────────────────────────────────────────────
// Un celular saca fotos de 4000px y 3 a 5 MB. El portal las muestra en
// miniaturas de 96px y, cuando se abren, dentro de una pantalla: nunca hace
// falta el original. Antes de este archivo se subía la foto tal cual salía de
// la cámara, así que el navegador se bajaba 5 MB para pintar una estampilla.
//
// Achicar acá —en el navegador de quien sube, antes de que el archivo viaje—
// resuelve las tres cosas de una sola vez: sube más rápido, ocupa menos disco
// y se ve mucho antes al abrirlo.
//
// Regla de oro: esto NUNCA puede hacer fallar una carga. Si el formato no se
// puede decodificar (algunos HEIC de iPhone en navegadores viejos), si el
// canvas falla o si el resultado sale más pesado que el original, se devuelve
// el archivo original sin tocar. Perder calidad es aceptable; perder la
// denuncia de un cliente, no.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  // 1600px en el lado largo: alcanza para leer una patente o un número de
  // póliza haciendo zoom, y es la cuarta parte de lo que entrega la cámara.
  var LADO_MAX = 1600;
  var CALIDAD = 0.82;
  // Por debajo de esto no vale la pena: el ahorro no compensa recomprimir.
  var MINIMO_PARA_ACHICAR = 300 * 1024;

  function esImagenAchicable(file) {
    if (!file || !file.type) return false;
    // El PDF se sube intacto: es el documento original de la compañía.
    if (file.type === "application/pdf") return false;
    // El GIF puede estar animado y el canvas se quedaría con un solo cuadro.
    if (file.type === "image/gif") return false;
    return file.type.indexOf("image/") === 0;
  }

  // WebP pesa ~30% menos que JPEG a igual calidad, pero no todos los
  // navegadores lo saben escribir. Se comprueba una vez.
  var soportaWebp = null;
  function formatoSalida() {
    if (soportaWebp === null) {
      try {
        var c = document.createElement("canvas");
        c.width = 1; c.height = 1;
        soportaWebp = c.toDataURL("image/webp").indexOf("image/webp") === 5;
      } catch (e) { soportaWebp = false; }
    }
    return soportaWebp ? "image/webp" : "image/jpeg";
  }

  // Devuelve algo dibujable en un canvas, ya rotado según el EXIF.
  // createImageBitmap con imageOrientation resuelve las fotos verticales de
  // celular, que si no se suben acostadas.
  function decodificar(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (e) { /* algunos navegadores no aceptan el segundo argumento */ }
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("no se pudo leer la imagen")); };
      img.src = url;
    });
  }

  function aBlob(canvas, tipo, calidad) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, tipo, calidad);
      else resolve(null);
    });
  }

  function renombrar(nombre, tipo) {
    var base = String(nombre || "foto").replace(/\.[^.]+$/, "");
    return base + (tipo === "image/webp" ? ".webp" : ".jpg");
  }

  async function achicarImagen(file, opciones) {
    var op = opciones || {};
    var ladoMax = op.ladoMax || LADO_MAX;
    var calidad = op.calidad || CALIDAD;

    if (!esImagenAchicable(file)) return file;
    if (file.size < MINIMO_PARA_ACHICAR) return file;

    try {
      var src = await decodificar(file);
      var w = src.width, h = src.height;
      if (!w || !h) return file;

      var escala = Math.min(1, ladoMax / Math.max(w, h));
      var nw = Math.round(w * escala);
      var nh = Math.round(h * escala);

      var canvas = document.createElement("canvas");
      canvas.width = nw; canvas.height = nh;
      var ctx = canvas.getContext("2d");
      if (!ctx) return file;
      // Mejora visible al bajar mucho de tamaño, sin costo perceptible.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, nw, nh);
      if (src.close) src.close();   // libera el ImageBitmap

      var tipo = formatoSalida();
      var blob = await aBlob(canvas, tipo, calidad);
      if (!blob) return file;

      // Una foto ya optimizada puede salir más pesada al recomprimirla.
      if (blob.size >= file.size) return file;

      return new File([blob], renombrar(file.name, tipo), {
        type: tipo,
        lastModified: Date.now(),
      });
    } catch (e) {
      console.warn("[imagenes] no se pudo achicar, se sube el original:", e);
      return file;
    }
  }

  // Achica varias en paralelo. Igual que arriba: si una falla, va la original.
  async function achicarVarias(files, opciones) {
    return Promise.all(
      Array.prototype.slice.call(files || []).map(function (f) {
        return achicarImagen(f, opciones);
      })
    );
  }

  function pesoLegible(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
  }

  window.achicarImagen = achicarImagen;
  window.achicarVarias = achicarVarias;
  window.pesoLegible = pesoLegible;
})();
