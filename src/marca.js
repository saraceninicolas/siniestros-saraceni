// marca.js — Los colores de cada broker, aplicados en vivo
// ─────────────────────────────────────────────────────────────────────────────
// Cada empresa elige sus colores desde Ajustes y de ahí sale TODO el resto del
// portal: los fondos suaves, los bordes, la escala de grises del texto y —lo
// más delicado— qué color de letra va encima de cada fondo.
//
// POR QUÉ SE CALCULA Y NO SE ELIGE CADA TONO A MANO
// Un portal tiene decenas de tonos (borde, borde fuerte, fondo suave, texto
// secundario, texto tenue…). Pedirle eso a un broker es pedirle que sea
// diseñador. Acá elige los pocos colores que importan —marca, menú, fondo,
// tarjetas, texto y los cuatro de estado— y el resto se deriva midiendo
// contraste de verdad (WCAG 4.5:1), no a ojo.
//
// Ya nos pasó con el amarillo de Aicardi: blanco sobre amarillo no se lee, y
// amarillo sobre blanco tampoco. Por eso hay dos roles distintos:
//   · `--brand-ink`: el texto que va ENCIMA del relleno de marca (un botón).
//   · `--brand-txt`: el color de marca usado como TEXTO sobre la tarjeta.
// La misma regla vale para cada color elegible: el que se usa como texto se
// oscurece (o se aclara, si el fondo es oscuro) hasta que se lea.
//
// Los colores de ESTADO se pueden editar, pero arrancan iguales en todos los
// portales y conviene dejarlos: verde terminado, ámbar por vencer, rojo alerta
// son idioma del producto. Un broker con marca verde tiene que seguir viendo
// sus alertas en rojo.
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
  // `prop` de `c` sobre `fondo`: 0 = el fondo puro, 1 = el color puro.
  function mezcla(c, fondo, prop) {
    return {
      r: c.r * prop + fondo.r * (1 - prop),
      g: c.g * prop + fondo.g * (1 - prop),
      b: c.b * prop + fondo.b * (1 - prop),
    };
  }
  var BLANCO = { r: 255, g: 255, b: 255 };
  var NEGRO = { r: 25, g: 28, b: 34 };   // el negro del portal, no un negro puro
  function conBlanco(c, prop) { return mezcla(c, BLANCO, prop); }
  function conNegro(c, prop) { return mezcla(c, { r: 0, g: 0, b: 0 }, prop); }

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

  // Lleva el color hasta que se lea sobre ese fondo: lo oscurece si el fondo es
  // claro, lo aclara si es oscuro. Devuelve el original si ya contrasta (un rojo
  // fuerte no se toca; un amarillo sobre blanco termina en ocre).
  function legibleSobre(c, fondo) {
    if (contraste(c, fondo) >= 4.5) return c;
    var oscurecer = luz(fondo) > 0.35;
    var p = 1, actual = c;
    while (contraste(actual, fondo) < 4.5 && p > 0.05) {
      p -= 0.05;
      actual = oscurecer ? conNegro(c, p) : conBlanco(c, p);
    }
    return actual;
  }
  // Qué letra va ENCIMA de un relleno de ese color.
  function tintaSobre(c) { return luz(c) > 0.45 ? NEGRO : BLANCO; }

  // Los valores de fábrica, los mismos que tokens.css. Viven acá para que la
  // pantalla de Ajustes muestre un color concreto en cada casillero y para que
  // "volver a fábrica" no dependa de recordar hexadecimales en dos lugares.
  var FABRICA = {
    color: "#DD0909",
    menu: "auto", menuColor: "#1C1313", menuTexto: "", menuActivo: "",
    fondo: "#F5F6F8", superficie: "#FFFFFF", texto: "#191C22",
    ok: "#15803D", warn: "#D97706", peligro: "#DC2626", info: "#1A73E8",
    logo: "",
  };

  // ---------- aplicar ----------
  // marca = { color, menu, menuColor, menuTexto, menuActivo, fondo, superficie,
  //           texto, ok, warn, peligro, info, logo }
  // Todo es opcional: lo que no venga queda como está en tokens.css, así que un
  // broker que nunca entró a Ajustes ve el portal de siempre.
  function aplicarMarca(marca) {
    marca = marca || {};
    var raiz = document.documentElement;
    var set = function (v, val) { raiz.style.setProperty(v, val); };

    // El fondo de las tarjetas es la referencia de TODO lo demás: sobre él se
    // mide si un texto se lee y con él se mezclan los tonos suaves.
    var sup = aRgb(marca.superficie) || BLANCO;
    var ink = legibleSobre(aRgb(marca.texto) || NEGRO, sup);

    if (marca.fondo && aRgb(marca.fondo)) set("--bg", aHex(aRgb(marca.fondo)));

    if (aRgb(marca.superficie) || aRgb(marca.texto)) {
      // De estos dos sale la escala de grises entera: los seis grises del texto
      // y los bordes son el mismo color de letra, cada vez más diluido.
      set("--surface", aHex(sup));
      set("--surface-2", aHex(mezcla(ink, sup, 0.025)));
      set("--ink", aHex(ink));
      set("--ink-2", aHex(mezcla(ink, sup, 0.72)));
      set("--muted", aHex(mezcla(ink, sup, 0.52)));
      set("--ink-tenue", aHex(mezcla(ink, sup, 0.21)));
      set("--neutro", aHex(mezcla(ink, sup, 0.22)));
      set("--line", aHex(mezcla(ink, sup, 0.09)));
      set("--line-2", aHex(mezcla(ink, sup, 0.06)));
      set("--line-fuerte", aHex(mezcla(ink, sup, 0.17)));
      set("--line-fuerte-2", aHex(mezcla(ink, sup, 0.13)));
    }

    var c = aRgb(marca.color);
    if (c) {
      var claro = luz(c) > 0.45;                       // amarillos, celestes, verdes claros
      var tinta = tintaSobre(c);                       // qué se lee encima del relleno
      set("--brand", aHex(c));
      set("--brand-d", aHex(conNegro(c, 0.85)));
      set("--brand-ink", aHex(tinta));
      set("--brand-txt", aHex(legibleSobre(c, sup)));
      set("--brand-soft", aHex(mezcla(c, sup, 0.05)));
      set("--brand-soft-2", aHex(mezcla(c, sup, 0.09)));
      set("--brand-line", aHex(mezcla(c, sup, 0.22)));
      set("--brand-line-2", aHex(mezcla(c, sup, 0.15)));
      set("--brand-ring", "rgba(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ",.09)");

      // ---- menú lateral ----
      // "auto" decide por el color: un amarillo oscurecido queda marrón sucio,
      // así que con marcas claras conviene el menú claro.
      var menu = marca.menu || "auto";
      if (menu === "auto") menu = claro ? "claro" : "oscuro";
      var sbBg, sbActive, sbInk, sbInkDim, sbInkFuerte;
      if (menu === "oscuro") {
        // Casi negro, apenas teñido con la marca: es el gris de siempre cuando
        // la marca es roja, y acompaña cuando es otra.
        sbBg = conNegro(conBlanco(c, 0.45), 0.16);
        sbActive = conNegro(conBlanco(c, 0.5), 0.24);
        sbInk = aRgb("#C9CFD9");
        sbInkDim = conBlanco(conNegro(c, 0.75), 0.55);
        sbInkFuerte = BLANCO;
      } else if (menu === "personalizado" && aRgb(marca.menuColor)) {
        // El menú con un color propio, distinto del de la marca: hay brokers
        // cuyo logo pide un acento y un menú de otro tono. La tinta se decide
        // por la luminancia de ESE color, no la de la marca.
        var m = aRgb(marca.menuColor);
        var mClaro = luz(m) > 0.45;
        sbBg = m;
        sbActive = mClaro ? conNegro(m, 0.93) : conBlanco(m, 0.86);
        sbInk = mClaro ? aRgb("#3A414D") : aRgb("#C9CFD9");
        sbInkDim = mClaro ? aRgb("#8B93A1") : conBlanco(conNegro(m, 0.75), 0.55);
        sbInkFuerte = mClaro ? NEGRO : BLANCO;
      } else if (menu === "marca") {
        sbBg = c;
        sbActive = claro ? conNegro(c, 0.88) : conBlanco(c, 0.8);
        sbInk = tinta;
        sbInkDim = claro ? conBlanco(conNegro(c, 0.55), 0.75) : conBlanco(c, 0.45);
        sbInkFuerte = tinta;
      } else {
        sbBg = BLANCO;
        sbActive = mezcla(c, BLANCO, 0.1);
        sbInk = aRgb("#3A414D");
        sbInkDim = aRgb("#8B93A1");
        sbInkFuerte = NEGRO;
      }
      // Los dos de abajo pisan lo calculado. Son opcionales a propósito: vacío
      // significa "seguí el tema", y así cambiar de tema no deja el texto de un
      // color que ya no se lee sobre el fondo nuevo.
      var mTexto = aRgb(marca.menuTexto);
      if (mTexto) {
        sbInkFuerte = mTexto;
        sbInk = mezcla(mTexto, sbBg, 0.82);
        sbInkDim = mezcla(mTexto, sbBg, 0.55);
      }
      var mActivo = aRgb(marca.menuActivo);
      if (mActivo) sbActive = mActivo;

      set("--sb-bg", aHex(sbBg));
      set("--sb-active", aHex(sbActive));
      set("--sb-ink", aHex(sbInk));
      set("--sb-ink-dim", aHex(sbInkDim));
      set("--sb-ink-fuerte", aHex(sbInkFuerte));
      raiz.setAttribute("data-menu", menu);
    }

    // ---- colores de estado ----
    // De cada uno salen cuatro o cinco tonos: el relleno (el que se ve en un
    // punto o una barra), el texto (bajado hasta que se lea sobre la tarjeta) y
    // los fondos y bordes suaves de las píldoras.
    var ok = aRgb(marca.ok);
    if (ok) {
      set("--ok", aHex(legibleSobre(ok, sup)));
      set("--ok-dot", aHex(ok));
      set("--ok-ink", aHex(tintaSobre(ok)));
      set("--ok-soft", aHex(mezcla(ok, sup, 0.12)));
      set("--ok-soft-2", aHex(mezcla(ok, sup, 0.03)));
      set("--ok-line", aHex(mezcla(ok, sup, 0.30)));
    }
    var warn = aRgb(marca.warn);
    if (warn) {
      set("--warn", aHex(legibleSobre(warn, sup)));
      set("--warn-fuerte", aHex(warn));
      set("--warn-txt", aHex(conNegro(legibleSobre(warn, sup), 0.85)));
      set("--warn-soft", aHex(mezcla(warn, sup, 0.12)));
      set("--warn-soft-2", aHex(mezcla(warn, sup, 0.05)));
      set("--warn-line", aHex(mezcla(warn, sup, 0.30)));
    }
    var pel = aRgb(marca.peligro);
    if (pel) {
      set("--peligro", aHex(legibleSobre(pel, sup)));
      set("--peligro-fuerte", aHex(pel));
      set("--peligro-hondo", aHex(conNegro(legibleSobre(pel, sup), 0.9)));
      set("--peligro-soft", aHex(mezcla(pel, sup, 0.14)));
    }
    var info = aRgb(marca.info);
    if (info) {
      var infoTxt = legibleSobre(info, sup);
      set("--info", aHex(infoTxt));
      set("--info-d", aHex(conNegro(infoTxt, 0.85)));
      set("--info-2", aHex(infoTxt));
      set("--info-3", aHex(info));
      set("--info-ink", aHex(tintaSobre(infoTxt)));
      set("--info-soft", aHex(mezcla(info, sup, 0.12)));
      set("--info-soft-2", aHex(mezcla(info, sup, 0.05)));
      set("--info-line", aHex(mezcla(info, sup, 0.22)));
    }

    if (marca.logo) set("--logo", "url(" + JSON.stringify(marca.logo) + ")");
    window.MARCA = marca;
  }

  // El nombre que se imprime (PDF, pie de página). Mientras no haya marca
  // cargada, el del broker de siempre.
  function marcaNombre() {
    return (window.MARCA && window.MARCA.nombre) || "SARACENI · BROKER DE SEGUROS";
  }

  // Todas las variables que puede pisar aplicarMarca. Están juntas para que
  // limpiarMarca no se olvide ninguna: una que quede pegada mezcla el portal de
  // un broker con el del siguiente que entra en la misma pestaña.
  var VARIABLES = [
    "--brand", "--brand-d", "--brand-ink", "--brand-txt", "--brand-soft", "--brand-soft-2",
    "--brand-line", "--brand-line-2", "--brand-ring",
    "--sb-bg", "--sb-active", "--sb-ink", "--sb-ink-dim", "--sb-ink-fuerte",
    "--bg", "--surface", "--surface-2", "--ink", "--ink-2", "--muted", "--ink-tenue", "--neutro",
    "--line", "--line-2", "--line-fuerte", "--line-fuerte-2",
    "--ok", "--ok-dot", "--ok-ink", "--ok-soft", "--ok-soft-2", "--ok-line",
    "--warn", "--warn-fuerte", "--warn-txt", "--warn-soft", "--warn-soft-2", "--warn-line",
    "--peligro", "--peligro-fuerte", "--peligro-hondo", "--peligro-soft",
    "--info", "--info-d", "--info-2", "--info-3", "--info-ink", "--info-soft", "--info-soft-2", "--info-line",
    "--logo",
  ];

  // Deja los valores por defecto del archivo de variables (el rojo de Saraceni).
  function limpiarMarca() {
    var raiz = document.documentElement;
    VARIABLES.forEach(function (v) { raiz.style.removeProperty(v); });
    raiz.removeAttribute("data-menu");
    window.MARCA = null;
  }

  Object.assign(window, {
    aplicarMarca, limpiarMarca, marcaNombre, MARCA_FABRICA: FABRICA,
    marcaContraste: contraste, marcaARgb: aRgb, marcaLuz: luz,
  });
})();
