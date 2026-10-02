// tests/firmas.test.js — Que las fotos se firmen en un pedido y no en seis
// ─────────────────────────────────────────────────────────────────────────────
// Las fotos de un siniestro viven en un bucket privado, así que cada una
// necesita una URL firmada. Firmarlas de a una costaba un viaje al servidor por
// foto —~250 ms cada uno desde Argentina, y más de un segundo el primero— y eso
// pasaba ANTES de que empezara a bajar la primera imagen.
//
// Esto no se nota leyendo el código: `Promise.all` da la sensación de que ya
// está resuelto, y las seis salían en paralelo igual. Lo que importa es cuántos
// pedidos se hacen, y eso es justo lo que mide este test.
//
// No pega contra la red: el cliente de Supabase está reemplazado por uno falso
// que cuenta las llamadas.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from "vitest";

let DB;
let llamadas;
let fallar;   // paths que el servidor va a rechazar de a uno

beforeAll(async () => {
  llamadas = [];
  fallar = new Set();

  const almacen = {
    from(bucket) {
      return {
        createSignedUrls: async (paths, vida) => {
          llamadas.push({ bucket, paths: [...paths], vida });
          return {
            data: paths.map((p) =>
              fallar.has(p)
                ? { error: "Object not found", path: p, signedUrl: null }
                : { error: null, path: p, signedUrl: `https://falso/${bucket}/${p}?token=x` }),
            error: null,
          };
        },
      };
    },
  };

  // db.js se evalúa al importarse y mira `window` apenas arranca, así que la
  // ventana falsa tiene que existir antes. Por eso el import es dinámico: los
  // `import` de arriba se hoistean y llegarían primero.
  global.window = {
    SUPABASE_URL: "https://falso.supabase.co",
    SUPABASE_ANON_KEY: "clave-de-mentira",
    supabase: { createClient: () => ({ storage: almacen }) },
  };
  await import("../src/db.js");
  DB = global.window.DB;
});

describe("firmar los adjuntos de un siniestro", () => {
  it("seis fotos del mismo bucket son UN pedido, no seis", async () => {
    const fotos = ["a1.webp", "a2.webp", "a3.webp", "a4.webp", "a5.webp", "a6.webp"]
      .map((p) => ({ path: p, bucket: "solicitudes" }));

    const urls = await DB.files.signedUrls(fotos, 3600);

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].bucket).toBe("solicitudes");
    expect(llamadas[0].paths).toHaveLength(6);
    expect(Object.keys(urls)).toHaveLength(6);
    expect(urls["a3.webp"]).toContain("solicitudes/a3.webp");
  });

  it("no vuelve a pedir lo que ya firmó", async () => {
    const antes = llamadas.length;
    const urls = await DB.files.signedUrls(
      [{ path: "a1.webp", bucket: "solicitudes" }, { path: "a2.webp", bucket: "solicitudes" }], 3600);

    expect(llamadas).toHaveLength(antes);          // ni un viaje más
    expect(urls["a1.webp"]).toContain("a1.webp");  // y las devuelve igual
  });

  // Un siniestro convertido tiene las fotos que subió el asegurado en un bucket
  // y las que sumó el broker en otro. Firmarlas juntas daría 404 en la mitad.
  it("separa por bucket: un pedido para cada uno", async () => {
    const antes = llamadas.length;
    await DB.files.signedUrls([
      { path: "del-asegurado.webp", bucket: "solicitudes" },
      { path: "del-broker.webp", bucket: "adjuntos" },
    ], 3600);

    const nuevas = llamadas.slice(antes);
    expect(nuevas).toHaveLength(2);
    expect(nuevas.map((l) => l.bucket).sort()).toEqual(["adjuntos", "solicitudes"]);
    expect(nuevas.every((l) => l.paths.length === 1)).toBe(true);
  });

  // Que falte un archivo no puede dejar sin fotos a la denuncia entera.
  it("si el servidor rechaza una, las otras llegan igual", async () => {
    fallar.add("rota.webp");
    const urls = await DB.files.signedUrls([
      { path: "rota.webp", bucket: "solicitudes" },
      { path: "sana.webp", bucket: "solicitudes" },
    ], 3600);

    expect(urls["rota.webp"]).toBeUndefined();
    expect(urls["sana.webp"]).toContain("sana.webp");
  });

  it("sin adjuntos no habla con el servidor", async () => {
    const antes = llamadas.length;
    expect(await DB.files.signedUrls([], 3600)).toEqual({});
    expect(llamadas).toHaveLength(antes);
  });
});
