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
    // menú lateral blanco con gris del logo
    "--sb-bg": "#FFFFFF",
    "--sb-ink": "#4A4B4D",
    "--sb-ink-dim": "#9A9B9E",
    "--sb-active": "#FFF7DC",
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
    // el logo tiene mucho blanco propio: sin sombra ni borde se integra mejor
    ".sb-logo{ box-shadow:none; border:1px solid var(--line); }",
  ].join("\n");
  document.head.appendChild(css);
})();
