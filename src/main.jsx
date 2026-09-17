// main.jsx — Punto de entrada del portal
// ─────────────────────────────────────────────────────────────────────────────
// PASO INTERMEDIO DE LA MIGRACIÓN A VITE. Léase antes de tocar.
//
// Hasta acá el portal no tenía compilación: index.html cargaba React y Babel
// desde CDN y los .jsx se transpilaban en el navegador, en cada visita. Todos
// los archivos compartían un mismo scope global y se comunicaban por `window`.
//
// Convertir los 21 archivos a imports/exports de una sola vez sería una
// reescritura a ciegas: como nadie declara qué usa de quién, cualquier
// referencia que se pase por alto rompe el portal en silencio. Así que la
// migración va en dos tiempos:
//
//   1. (ACÁ ESTAMOS) Vite compila y empaqueta, pero los módulos siguen
//      hablándose por `window` igual que antes. Con esto ya ganamos lo que
//      importa: React de producción, sin Babel en el navegador, npm, y —sobre
//      todo— la posibilidad de escribir tests.
//   2. Después, archivo por archivo, se pasa a imports/exports de verdad,
//      con el portal andando en todo momento.
//
// ⚠️ EL ORDEN DE LOS IMPORTS DE ABAJO IMPORTA y es el mismo que tenían los
// <script> de index.html. Los módulos ES se evalúan en el orden en que se
// importan, así que esta lista cumple exactamente el mismo rol que cumplía
// aquella fila de <script>. `andamio.js` va primero sí o sí.
// ─────────────────────────────────────────────────────────────────────────────

import "./andamio.js";

import "./estilos/tokens.css";
import "./estilos/portal.css";

import "./config.js";
import "./imagenes.js";
import "./db.js";
import "./data.jsx";
import "./auth.jsx";
import "./ui.jsx";
import "./charts.jsx";
import "./estadisticas.jsx";
import "./modals.jsx";
import "./detail.jsx";
import "./solicitudes.jsx";
import "./usuarios.jsx";
import "./facturas.jsx";
import "./renovaciones.jsx";
import "./comercial.jsx";
import "./pendientes.jsx";
import "./objetivos-datos.jsx";
import "./objetivos-form.jsx";
import "./objetivos.jsx";
import "./calendar.jsx";
import "./app.jsx";
