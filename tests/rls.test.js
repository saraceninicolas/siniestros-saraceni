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
  // Multiempresa: acá viven los datos del negocio (quién es cliente, qué paga).
  // `modulos`, `planes` y `plan_modulos` son el catálogo, que sí lee cualquier
  // usuario logueado para armarse el menú, pero un visitante sin cuenta no.
  "organizaciones",
  "oficinas",
  "membresias",
  "super_admins",
  "suscripciones",
  "org_modulos",
  "cobros",
  "modulos",
  "planes",
  "plan_modulos",
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
    ["asegurado_completar_documento", { p_id: 1, p_documento: "11111111" }],
    // Los helpers de rol solo los necesitan las policies de usuarios logueados.
    ["es_activo", {}],
    ["es_organizador", {}],
    // Los del multiempresa, igual: deciden qué empresa sos y qué módulos tenés.
    ["org_actual", {}],
    ["es_super_admin", {}],
    ["tiene_modulo", { p_clave: "siniestros" }],
    ["mis_modulos", {}],
    ["archivo_de_mi_org", { p_name: "algo.jpg" }],
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

describe("Multiempresa · lo poco que un visitante SÍ puede saber", () => {
  // La denuncia pública necesita saber a qué broker le está escribiendo: su
  // nombre y su marca, para mostrar el logo correcto. Eso es público por
  // definición (está impreso en la puerta de la oficina). Lo que no puede es
  // listar las empresas del sistema ni saber qué paga cada una.
  it("org_publica devuelve UNA empresa y solo sus datos de vidriera", async () => {
    const r = await comoAnon("rpc/org_publica", {
      method: "POST",
      body: JSON.stringify({ p_slug: "aicardi" }),
    });
    expect(r.status).toBeLessThan(300);
    const filas = await r.json();
    expect(Array.isArray(filas)).toBe(true);
    expect(filas.length).toBe(1);
    // `modulos` son los de cara al publico (siniestros, comercial): la pagina
    // los necesita para no ofrecer un formulario que el broker no puede leer.
    expect(Object.keys(filas[0]).sort()).toEqual(["id", "marca", "modulos", "nombre", "slug"]);
    expect(filas[0].modulos.every((m) => ["siniestros", "comercial"].includes(m))).toBe(true);
  });

  // Aicardi contrato solo Siniestros. Si su formulario de cotizacion siguiera
  // abierto, juntaria consultas que nadie de Aicardi puede leer: la policy de
  // lectura pide el modulo. Un pozo de consultas es peor que no tener link.
  it("una empresa sin el modulo Comercial no figura como que lo tiene", async () => {
    const r = await comoAnon("rpc/org_publica", {
      method: "POST",
      body: JSON.stringify({ p_slug: "aicardi" }),
    });
    const filas = await r.json();
    expect(filas[0].modulos).toContain("siniestros");
    expect(filas[0].modulos).not.toContain("comercial");
  });

  it("no puede dejarle una cotizacion de hogar a una empresa sin ese modulo", async () => {
    const r0 = await comoAnon("rpc/org_publica", {
      method: "POST",
      body: JSON.stringify({ p_slug: "aicardi" }),
    });
    const org = (await r0.json())[0];
    const r = await comoAnon("cotizaciones", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ref: "TEST" + Date.now().toString().slice(-6),
        nombre: "PRUEBA AUTOMATICA - borrable",
        org_id: org.id,
      }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it("un slug que no existe cae en la empresa de casa, no en el vacío", async () => {
    const r = await comoAnon("rpc/org_publica", {
      method: "POST",
      body: JSON.stringify({ p_slug: "no-existe-este-broker" }),
    });
    const filas = await r.json();
    expect(filas.length).toBe(1);
  });

  it("no puede dejar una denuncia a nombre de una empresa inventada", async () => {
    const r = await comoAnon("solicitudes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ref: "TEST" + Date.now().toString().slice(-6),
        nombre: "PRUEBA AUTOMATICA - borrable",
        org_id: "00000000-0000-4000-8000-000000000000",
      }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  // Con quien trabaja un broker no es asunto de un visitante, y ademas deja
  // ver el tamano de su cartera.
  it("no puede leer las companias de ningun broker", async () => {
    const r = await comoAnon("companias?select=nombre&limit=5");
    const filas = r.ok ? await r.json() : [];
    expect(filas).toHaveLength(0);
  });

  it("no puede agregarle una compania a un broker", async () => {
    const r = await comoAnon("companias", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ clave: "INTRUSA", nombre: "Intrusa" }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it("no puede escribirle a la tabla de empresas", async () => {
    const r = await comoAnon("organizaciones", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ nombre: "Intrusa", slug: "intrusa" }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
