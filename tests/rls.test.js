// tests/rls.test.js — Que `anon` no pueda leer lo que no debe
// ─────────────────────────────────────────────────────────────────────────────
// Este es EL test del proyecto. Toda la seguridad del portal son las policies
// de RLS: no hay backend donde poner una regla, el navegador habla directo con
// la base. Si una policy queda mal, no hay nada más que la contenga.
//
// Ya pasó una vez: la migración de RBAC dejó `solicitudes` sin INSERT para
// usuarios logueados y nadie se enteró hasta que un cliente no pudo denunciar.
// Se revisó leyendo el SQL y aun así se escapó. Por eso esto se prueba
// ejecutándolo, no leyéndolo.
//
// Cuando el portal pase a multi-tenant, este archivo es el que crece: ahí va a
// haber que verificar que el cliente A no ve NADA del cliente B, tabla por
// tabla. Empieza chico a propósito, pero empieza.
//
// ⚠️ Pega contra la base de TEST de verdad, por red. No corre offline, y nunca
// debe apuntar a producción: la URL está clavada acá abajo justamente para que
// no pueda tomarla de una variable de entorno equivocada.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";

const URL_TEST = "https://ykqnthxwawmoadvoywgl.supabase.co";
const ANON_TEST =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcW50aHh3YXdtb2Fkdm95d2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MTM4ODMsImV4cCI6MjEwNDM4OTg4M30.dl0BsoQkRJoNr2mqD0nUf5pdTVIOxsWz_anroJJVBO4";

function comoAnon(ruta, opciones = {}) {
  return fetch(`${URL_TEST}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: ANON_TEST,
      Authorization: `Bearer ${ANON_TEST}`,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });
}

// Todo lo que un visitante sin cuenta NO tiene por qué ver.
const TABLAS_PRIVADAS = [
  "siniestros",
  "perfiles",
  "objetivos",
  "solicitudes",
  "cotizaciones",
  "pendientes",
  "renovaciones",
  "fact_companias",
  "fact_mensual",
  "notificaciones",
  "asegurados",
  "asegurados_duplicados",
];

describe("RLS · un visitante sin cuenta no lee nada", () => {
  it.each(TABLAS_PRIVADAS)("no puede leer %s", async (tabla) => {
    const r = await comoAnon(`${tabla}?select=*&limit=5`);
    // Dos respuestas son aceptables: que la policy lo deje pasar pero sin
    // filas (lista vacía), o que rechace directamente. Lo que NO puede pasar
    // es que devuelva datos.
    if (r.ok) {
      const filas = await r.json();
      expect(Array.isArray(filas)).toBe(true);
      expect(filas).toHaveLength(0);
    } else {
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe("RLS · las funciones de trigger no se pueden invocar por REST", () => {
  // Son `security definer`: corren salteándose RLS. No tienen por qué estar
  // expuestas como endpoint.
  it.each([
    "handle_new_user",
    "trg_notif_siniestro",
    "trg_notif_pendiente",
    "trg_notif_solicitud",
    "trg_notif_cotizacion",
    "notificar",
  ])("%s no responde", async (fn) => {
    const r = await comoAnon(`rpc/${fn}`, { method: "POST", body: "{}" });
    expect(r.status).toBe(404);
  });
});

describe("RLS · un visitante sin cuenta no toca la API de asegurados", () => {
  // Son security definer: se saltean RLS y chequean los permisos adentro.
  // Además de ese chequeo, anon ni siquiera tiene que poder llamarlas.
  it.each([
    ["asegurado_buscar_o_crear", { p_nombre: "INTRUSO", p_documento: "11111111" }],
    ["asegurados_unificar", { id_final: 1, id_absorbido: 2 }],
    ["asegurados_no_son_duplicados", { a: 1, b: 2 }],
    ["asegurados_buscar_parecidos", { umbral: 0.7 }],
    ["asegurados_enganchar_siniestros", { solo_simular: false }],
    // Los helpers de rol solo los necesitan las policies de usuarios logueados.
    ["es_activo", {}],
    ["es_organizador", {}],
  ])("%s no responde", async (fn, args) => {
    const r = await comoAnon(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("RLS · las páginas públicas siguen pudiendo escribir", () => {
  // La contracara: si al cerrar permisos se cierra de más, un asegurado deja
  // de poder denunciar y nadie se entera hasta que llama por teléfono.
  // ⚠️ Deja una fila por corrida y `anon` no puede borrarla (a propósito: si
  // pudiera, cualquiera borraría las denuncias reales). Se limpian con:
  //   delete from solicitudes where nombre = 'PRUEBA AUTOMATICA - borrable';
  it("anon puede insertar una denuncia", async () => {
    const r = await comoAnon("solicitudes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ref: "TEST" + Date.now().toString().slice(-6),
        nombre: "PRUEBA AUTOMATICA - borrable",
        ramo: "AUTO",
      }),
    });
    expect(r.status).toBeLessThan(300);
  });

  it("anon NO puede leer las denuncias que inserta", async () => {
    const r = await comoAnon("solicitudes?select=nombre&limit=5");
    const filas = r.ok ? await r.json() : [];
    expect(filas).toHaveLength(0);
  });
});
