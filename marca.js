// marca.js — Identidad visual del portal (solo en la rama `demo`)
// ─────────────────────────────────────────────────────────────────────────────
// Todo lo que cambia de un asesor a otro está acá: nombre, logo y colores.
// Para armar la demo de otro estudio alcanza con:
//   1. copiar su logo a assets/ y apuntar `logo` al archivo nuevo
//   2. cambiar los colores de abajo
// No hay que tocar ningún otro archivo.
//
// Los colores se aplican como variables CSS sobre :root, así pisan la paleta
// que trae index.html sin tener que editar la hoja de estilos.
// ─────────────────────────────────────────────────────────────────────────────

var MARCA = window.MARCA = {
  nombre: "SF&A",
  nombreCompleto: "SF&A Asesores de Seguros",
  bajada: "Asesores de Seguros",
  logo: "assets/sfa-logo.jpg",

  colores: {
    // acento principal: botones, links, barras de los gráficos
    "--brand": "#1F4E79",
    "--brand-d": "#163A5C",
    // menú lateral
    "--sb-bg": "#14375A",
    "--sb-ink": "#CBDCEC",
    "--sb-ink-dim": "#8AA6C2",
    "--sb-active": "#1E4A76",
    // fondo general: un gris muy leve tirando a azul, para que el blanco resalte
    "--bg": "#F4F7FA",
    "--line": "#E3E9F0",
    "--line-2": "#EDF1F6",
  },
};

(function () {
  const raiz = document.documentElement;
  Object.entries(MARCA.colores).forEach(([k, v]) => raiz.style.setProperty(k, v));
  // El tema de sidebar "claro" del portal pisaría los colores de la marca.
  raiz.setAttribute("data-sidebar", "marca");
  if (MARCA.nombreCompleto) document.title = MARCA.nombreCompleto + " · Portal de gestiones";
})();
