// publico.js — Lo que necesitan las dos páginas públicas (/denuncia y /cotizar-hogar)
// ─────────────────────────────────────────────────────────────────────────────
// Estas páginas NO cargan el portal: son HTML y JavaScript a mano, sin React,
// a propósito. Las abre un asegurado desde el celular, muchas veces con datos
// móviles y en medio de un choque: cuanto menos tengan que descargar y menos
// piezas puedan fallar, mejor.
//
// Lo único que comparten con el portal es de dónde sacan la configuración de
// Supabase, los colores de la marca del broker y cómo achican las fotos. Eso es
// lo que junta este archivo.
//
// Sobre el orden: `config.js` e `imagenes.js` no dependen de Supabase, así que
// no importa que los imports se hoisten por encima de la asignación de abajo.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

import "./config.js";
import "./marca.js";
import "./imagenes.js";

// Misma forma que exponía el bundle UMD del CDN, para no tocar el código de
// las páginas.
window.supabase = { createClient };
