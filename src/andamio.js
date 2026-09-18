// andamio.js — Pone en `window` lo que antes traían los <script> del CDN
// ─────────────────────────────────────────────────────────────────────────────
// TEMPORAL: desaparece cuando todos los módulos usen imports de verdad.
// Ver la explicación completa en main.jsx.
//
// Esto vive en su propio archivo y no dentro de main.jsx por un detalle de ES
// modules que es fácil de pasar por alto: los `import` se hoistean, así que
// todos los módulos importados se evalúan ANTES de la primera línea del cuerpo
// del archivo que los importa. Si estas asignaciones estuvieran en el cuerpo de
// main.jsx, `db.js` y compañía correrían primero y no encontrarían nada.
//
// Al ser un import aparte y el primero de la lista, sí queda garantizado que
// corre antes que el resto.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import ReactDOM from "react-dom/client";
import { createClient } from "@supabase/supabase-js";

window.React = React;
// El código existente llama a ReactDOM.createRoot(), que en React 18 vive en
// "react-dom/client" y no en "react-dom".
window.ReactDOM = ReactDOM;
// db.js espera la misma forma que exponía el bundle UMD del CDN.
window.supabase = { createClient };
