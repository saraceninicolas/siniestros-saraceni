// marca.js — Identidad visual del portal (rama `demo-aicardi`)
// ─────────────────────────────────────────────────────────────────────────────
// Todo lo que cambia de un asesor a otro está acá: nombre, logo y colores.
// Para armar la demo de otro estudio alcanza con:
//   1. copiar su logo a assets/ y apuntar `logo` al archivo nuevo
//   2. cambiar los colores de abajo
// No hay que tocar ningún otro archivo.
//
// Sobre los roles de color: el amarillo de Aicardi no admite texto blanco
// encima (no se lee) ni sirve como color de texto sobre blanco. Por eso la
// marca no es un color solo sino cinco roles:
//   brand      el color en sí, para rellenos (botones, activos, etiquetas)
//   brandInk   qué color va ARRIBA de ese relleno  → acá gris oscuro
//   brandTxt   el color de marca cuando es TEXTO sobre blanco → dorado oscuro
//   brandSoft  fondo tenue (fila seleccionada, avisos)
//   brandLine  borde tenue, y brandRing el aro de foco de los campos
// Con eso el mismo CSS sirve para una marca roja, una azul o una amarilla.
// ─────────────────────────────────────────────────────────────────────────────

var MARCA = window.MARCA = {
  nombre: "AICARDI",
  nombreCompleto: "Aicardi Broker de Seguros",
  bajada: "Broker de Seguros",
  logo: "assets/aicardi-logo.jpg",
  // Menú lateral claro, como el fondo del logo. Usa el tema "claro" del portal.
  sidebarTema: "claro",

  colores: {
    "--brand": "#F5C518",
    "--brand-d": "#E0B310",
    "--brand-ink": "#2B2B2D",              // texto sobre amarillo
    "--brand-txt": "#8A6D00",              // texto dorado sobre blanco
    "--brand-soft": "#FFFBEB",
    "--brand-line": "#F2E3B4",
    "--brand-ring": "rgba(245,197,24,.28)",
    // Menú lateral entero en amarillo, con letras negras. Es un fondo CLARO,
    // así que usa el tema "claro" del portal y las tintas van oscuras: los
    // grises que traen los temas oscuros acá no se leerían.
    "--sb-bg": "#F5C518",
    "--sb-ink": "#1C1D20",                 // negro de los items y las carpetas
    "--sb-ink-dim": "#4A400C",             // secundario, oscuro para que lea sobre amarillo
    "--sb-active": "#FFFFFF",              // el item activo y el hover, en blanco
    // fondo general apenas cálido, para que el blanco de las tarjetas resalte
    "--bg": "#F7F6F3",
    "--line": "#E7E5DF",
    "--line-2": "#F0EEE9",
  },
};

(function () {
  const raiz = document.documentElement;
  Object.entries(MARCA.colores).forEach(([k, v]) => raiz.style.setProperty(k, v));
  raiz.setAttribute("data-sidebar", MARCA.sidebarTema || "marca");
  if (MARCA.nombreCompleto) document.title = MARCA.nombreCompleto + " · Portal de gestiones";

  // Retoques que no salen de una variable:
  // los botones de borrar deben seguir siendo rojos aunque la marca sea amarilla.
  const css = document.createElement("style");
  css.textContent = [
    ".btn-danger{ background:#DC2626; color:#fff; }",
    ".btn-danger:hover{ background:#B91C1C; }",
    ".btn-ghost.danger:hover:not(:disabled){ color:#C0241D; border-color:#F3C9C9; background:#FDF3F3; }",
    ".row-open.danger:hover{ background:#FDF3F3; color:#C0241D; }",
    ".confirm-ico{ background:#FDF3F3; color:#C0241D; }",
    ".login-err{ color:#C0241D; background:#FDF3F3; border-color:#F3C9C9; }",
    // ---- menú amarillo ----
    // el logo va en su placa blanca, que sobre el amarillo resalta sola
    ".sb-logo{ box-shadow:none; border:none; }",
    // la franja de marca era amarilla: sobre el menú amarillo desaparecía
    ".sb::after{ display:none; }",
    // los items van con la tinta fuerte, no con la tenue
    ".sb-subitem{ color:var(--sb-ink); }",
    ".sb-group-label{ opacity:1; }",
    // lo que era del color de marca quedaría amarillo sobre amarillo
    ".sb-count{ background:#1C1D20; color:#F5C518; }",
    ".sb-sub-dot{ background:#1C1D20; }",
    ".sb-folder.is-open .sb-folder-head .sb-item-ico,",
    ".sb-folder-head.has-active .sb-item-ico,",
    ".sb-item.is-active .sb-item-ico{ color:#1C1D20; }",
    // separadores: los grises claros no se ven sobre amarillo
    ".sb-brand{ border-bottom-color:rgba(0,0,0,.14); }",
    ".sb-foot{ border-top-color:rgba(0,0,0,.14); }",
    ".sb-folder-kids-inner{ border-left-color:rgba(0,0,0,.16); }",
    // el bloque del usuario, como tarjeta blanca sobre el amarillo
    ".sb-station{ background:#fff; border-color:rgba(0,0,0,.10); }",
  ].join("\n");
  document.head.appendChild(css);
})();
