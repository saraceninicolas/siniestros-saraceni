// demo-envio.js — Reemplaza a Supabase en las páginas públicas de la demo
// ─────────────────────────────────────────────────────────────────────────────
// `denuncia.html` y `cotizar-hogar.html` normalmente escriben en la base. En la
// demo no hay base: este archivo finge el cliente de Supabase para que el
// formulario se pueda completar y enviar de punta a punta —con sus validaciones,
// su barra de "subiendo archivo" y su pantalla de confirmación— sin que salga
// nada de la computadora del que lo está probando.
// ─────────────────────────────────────────────────────────────────────────────

window.DEMO = true;

(function () {
  const demora = (ms) => new Promise((r) => setTimeout(r, ms));

  window.DEMO_SB = {
    storage: {
      from: function () {
        return {
          upload: async function () { await demora(350); return { data: { path: "demo" }, error: null }; },
        };
      },
    },
    from: function () {
      return {
        insert: async function (fila) {
          await demora(600);
          console.log("[demo] no se envió nada; esto es lo que se hubiera guardado:", fila);
          return { data: null, error: null };
        },
      };
    },
  };

  // Cartel fijo, para que nadie crea que mandó una denuncia de verdad
  document.addEventListener("DOMContentLoaded", function () {
    const cinta = document.createElement("div");
    cinta.className = "demo-cinta-publica";
    cinta.innerHTML = "<b>DEMOSTRACIÓN</b><span>Formulario de ejemplo: podés completarlo y enviarlo, pero no se guarda ni se envía nada.</span>";
    document.body.appendChild(cinta);
    const css = document.createElement("style");
    css.textContent = ".demo-cinta-publica{position:fixed;left:0;right:0;bottom:0;z-index:90;display:flex;" +
      "align-items:center;justify-content:center;gap:10px;padding:9px 16px;background:#FED403;color:#2B2B2D;" +
      "font-size:12.5px;font-weight:600;font-family:inherit;text-align:center;box-shadow:0 -2px 10px rgba(16,20,28,.16)}" +
      ".demo-cinta-publica b{font-weight:800;letter-spacing:.03em}" +
      "body{padding-bottom:52px}";
    document.head.appendChild(css);
  });
})();
