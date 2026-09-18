// config.js — A qué base de datos se conecta el portal
// ─────────────────────────────────────────────────────────────────────────────
// Hay DOS bases de Supabase:
//
//   PRODUCCIÓN  supabase-lightBlue-garden   → los datos reales del broker
//   TEST        saraceni-portal-test        → una copia vacía del esquema
//
// ¿Por qué se elige por dominio y no con variables de entorno de Vercel?
// Porque el portal no tiene paso de compilación: es HTML y JSX que se transpila
// en el navegador. Las variables de entorno de Vercel solo llegan al sitio si
// alguien las inyecta durante un build, y acá no hay build. Este archivo se
// publica tal cual, así que la decisión tiene que tomarla el propio navegador.
//
// La regla es deliberadamente cerrada: SOLO el dominio exacto de producción usa
// la base real. Cualquier otra cosa —un preview de la rama test, una demo, un
// dominio nuevo, abrir el archivo local— cae en la base de test. Si algún día
// aparece una URL que nadie previó, lo peor que puede pasar es que escriba en
// test. Nunca al revés.
//
// La clave "anon" es PÚBLICA por diseño (viaja al navegador) y está protegida
// por las policies de RLS: es correcto versionarla. La "service_role" jamás.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  var BASES = {
    produccion: {
      url: "https://yscvpdogjgfvllizbyxp.supabase.co",
      key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY3ZwZG9namdmdmxsaXpieXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDA2NTEsImV4cCI6MjA5NTkxNjY1MX0.mv5q-LJ73nm9TnfSq9pWC-sM5mBIwsJ6i7QM0d0JNLk",
    },
    test: {
      url: "https://ykqnthxwawmoadvoywgl.supabase.co",
      key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcW50aHh3YXdtb2Fkdm95d2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTM4ODMsImV4cCI6MjEwNDM4OTg4M30.dl0BsoQkRJoNr2mqD0nUf5pdTVIOxsWz_anroJJVBO4",
    },
  };

  // Únicos dominios que hablan con la base real
  var DOMINIOS_PRODUCCION = ["siniestros-saraceni.vercel.app"];

  var host = (window.location && window.location.hostname || "").toLowerCase();
  var esProduccion = DOMINIOS_PRODUCCION.indexOf(host) >= 0;
  var elegida = esProduccion ? BASES.produccion : BASES.test;

  window.SUPABASE_URL = elegida.url;
  window.SUPABASE_ANON_KEY = elegida.key;
  window.AMBIENTE = esProduccion ? "produccion" : "test";

  // Queda en la consola para poder verificar de un vistazo dónde está escribiendo
  console.log("[portal] ambiente:", window.AMBIENTE, "· base:", elegida.url);
})();
