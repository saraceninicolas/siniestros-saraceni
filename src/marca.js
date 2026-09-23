// marca.js — La marca de cada broker, aplicada en vivo
// ─────────────────────────────────────────────────────────────────────────────
// Cada empresa elige UN color y un tema de menú desde Configuración, y de ahí
// sale todo el resto: los fondos suaves, los bordes, el anillo de foco y —lo
// más delicado— los dos colores de texto.
//
// POR QUÉ NO ALCANZA CON UN SOLO COLOR DE MARCA
// Ya nos pasó con el amarillo de Aicardi: blanco sobre amarillo no se lee, y
// amarillo sobre blanco tampoco. Por eso hay dos roles distintos:
//   · `--brand-ink`: el texto que va ENCIMA del relleno de marca (un botón).
//   · `--brand-txt`: el color de marca usado como TEXTO sobre blanco.
// Los dos se calculan midiendo contraste de verdad (WCAG), no a ojo: se
// oscurece o aclara el color hasta pasar 4.5:1, que es el mínimo legible.
//
// Los colores de ESTADO (verde terminado, ámbar por vencer, rojo alerta) no se
// tocan: son idioma del producto, no de la marca. Un broker con marca verde
// tiene que seguir viendo sus alertas en rojo.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  // ---------- utilidades de color ----------
  function aRgb(hex) {
    var h = String(hex || "").trim().replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function aHex(c) {
    var p = function (n) { return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"); };
    return "#" + p(c.r) + p(c.g) + p(c.b);
  }
  // Mezcla con blanco: 0 = blanco puro, 1 = el color.
  function conBlanco(c, prop) {
    return { r: c.r * prop + 255 * (1 - prop), g: c.g * prop + 255 * (1 - prop), b: c.b * prop + 255 * (1 - prop) };
  }
  function conNegro(c, prop) { return { r: c.r * prop, g: c.g * prop, b: c.b * prop }; }

  // Luminancia relativa segun WCAG: cuanta luz emite el color para el ojo.
  // El verde pesa mucho mas que el azul, por eso no se promedian los canales.
  function luz(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contraste(a, b) {
    var la = luz(a), lb = luz(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  var BLANCO = { r: 255, g: 255, b: 255 };
  var NEGRO = { r: 26, g: 28, b: 34 };   // el negro del portal, no un negro puro

  // Oscurece el color hasta que se lea sobre blanco. Devuelve el original si ya
  // contrasta (un rojo fuerte no se toca; un amarillo termina en ocre).
  function legibleSobreBlanco(c) {
    var p = 1;
    var actual = c;
    while (contraste(actual, BLANCO) < 4.5 && p > 0.05) {
      p -= 0.05;
      actual = conNegro(c, p);
    }
    return actual;
  }

  // ---------- aplicar ----------
  // marca = { color, menu: "auto"|"oscuro"|"claro"|"marca", logo }
  function aplicarMarca(marca) {
    marca = marca || {};
    var raiz = document.documentElement;
    var c = aRgb(marca.color);
    if (c) {
      var claro = luz(c) > 0.45;                       // amarillos, celestes, verdes claros
      var tinta = claro ? NEGRO : BLANCO;              // qué se lee encima del relleno
      raiz.style.setProperty("--brand", aHex(c));
      raiz.style.setProperty("--brand-d", aHex(conNegro(c, 0.85)));
      raiz.style.setProperty("--brand-ink", aHex(tinta));
      raiz.style.setProperty("--brand-txt", aHex(legibleSobreBlanco(c)));
      raiz.style.setProperty("--brand-soft", aHex(conBlanco(c, 0.05)));
      raiz.style.setProperty("--brand-soft-2", aHex(conBlanco(c, 0.09)));
      raiz.style.setProperty("--brand-line", aHex(conBlanco(c, 0.22)));
      raiz.style.setProperty("--brand-line-2", aHex(conBlanco(c, 0.15)));
      raiz.style.setProperty("--brand-ring", "rgba(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ",.09)");

      // Menú lateral. "auto" decide por el color: un amarillo oscurecido queda
      // marrón sucio, así que con marcas claras conviene el menú claro.
      var menu = marca.menu || "auto";
      if (menu === "auto") menu = claro ? "claro" : "oscuro";
      if (menu === "oscuro") {
        // Casi negro, apenas teñido con la marca: es el gris de siempre cuando
        // la marca es roja, y acompaña cuando es otra.
        raiz.style.setProperty("--sb-bg", aHex(conNegro(conBlanco(c, 0.45), 0.16)));
        raiz.style.setProperty("--sb-active", aHex(conNegro(conBlanco(c, 0.5), 0.24)));
        raiz.style.setProperty("--sb-ink", "#C9CFD9");
        raiz.style.setProperty("--sb-ink-dim", aHex(conBlanco(conNegro(c, 0.75), 0.55)));
        raiz.style.setProperty("--sb-ink-fuerte", "#FFFFFF");
      } else if (menu === "marca") {
        raiz.style.setProperty("--sb-bg", aHex(c));
        raiz.style.setProperty("--sb-active", aHex(claro ? conNegro(c, 0.88) : conBlanco(c, 0.8)));
        raiz.style.setProperty("--sb-ink", aHex(tinta));
        raiz.style.setProperty("--sb-ink-dim", aHex(claro ? conBlanco(conNegro(c, 0.55), 0.75) : conBlanco(c, 0.45)));
        raiz.style.setProperty("--sb-ink-fuerte", aHex(tinta));
      } else {
        raiz.style.setProperty("--sb-bg", "#FFFFFF");
        raiz.style.setProperty("--sb-active", aHex(conBlanco(c, 0.1)));
        raiz.style.setProperty("--sb-ink", "#3A414D");
        raiz.style.setProperty("--sb-ink-dim", "#8B93A1");
        raiz.style.setProperty("--sb-ink-fuerte", aHex(NEGRO));
      }
      raiz.setAttribute("data-menu", menu);
    }
    if (marca.logo) raiz.style.setProperty("--logo", "url(" + JSON.stringify(marca.logo) + ")");
    window.MARCA = marca;
  }

  // El nombre que se imprime (PDF, pie de página). Mientras no haya marca
  // cargada, el del broker de siempre.
  function marcaNombre() {
    return (window.MARCA && window.MARCA.nombre) || "SARACENI · BROKER DE SEGUROS";
  }

  // Deja los valores por defecto del archivo de variables (el rojo de Saraceni).
  function limpiarMarca() {
    var raiz = document.documentElement;
    ["--brand", "--brand-d", "--brand-ink", "--brand-txt", "--brand-soft", "--brand-soft-2",
     "--brand-line", "--brand-line-2", "--brand-ring", "--sb-bg", "--sb-active", "--sb-ink",
     "--sb-ink-dim", "--sb-ink-fuerte", "--logo"].forEach(function (v) { raiz.style.removeProperty(v); });
    raiz.removeAttribute("data-menu");
    window.MARCA = null;
  }

  Object.assign(window, { aplicarMarca, limpiarMarca, marcaNombre, marcaContraste: contraste, marcaARgb: aRgb });
})();
