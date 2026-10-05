// tests/importes.test.js — Que un importe sobreviva la ida y la vuelta
// ─────────────────────────────────────────────────────────────────────────────
// En Facturación el mismo número viaja en dos formas: como lo guarda la base
// (2673574.83) y como lo lee una persona (2.673.574,83). El campo muestra la
// segunda y guarda la primera, así que cada corrección que alguien escribe sale
// del campo con puntos de miles y coma decimal y tiene que volver a entrar como
// número sin perder un centavo.
//
// Es plata: un separador leído al revés no rompe nada, devuelve otro número.
// Por eso se prueba el viaje completo y no cada función por su lado.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from "vitest";

let parseMonto, fmtMonto;

beforeAll(async () => {
  // facturas.jsx se cuelga de `window` (paso 1 de la migración a módulos ES).
  global.window = {};
  await import("../src/facturas.jsx");
  ({ parseMonto, fmtMonto } = global.window);
});

describe("leer lo que escribió una persona", () => {
  it("entiende las dos formas de escribir el mismo importe", () => {
    expect(parseMonto("2673574.83")).toBe(2673574.83);    // como viene de la base
    expect(parseMonto("2.673.574,83")).toBe(2673574.83);  // como lo ve y lo corrige
    expect(parseMonto("$ 2.673.574,83")).toBe(2673574.83); // si copió el signo
    expect(parseMonto(" 1000 ")).toBe(1000);
  });

  // El punto es ambiguo y es donde se pierde plata sin que nadie se entere:
  // "1.500" a la argentina son mil quinientos, pero "1234567.89" viene de la
  // base con el punto decimal. Se decide por los grupos: de a tres es miles.
  it("un punto de miles no es un decimal", () => {
    expect(parseMonto("1.500")).toBe(1500);
    expect(parseMonto("2.673.574")).toBe(2673574);
    expect(parseMonto("1,50")).toBe(1.5);
  });

  it("pero el punto decimal de la base sigue siendo decimal", () => {
    expect(parseMonto("2673574.83")).toBe(2673574.83);
    expect(parseMonto("1.5")).toBe(1.5);
    expect(parseMonto("0.01")).toBe(0.01);
  });

  it("vacío es vacío, no cero", () => {
    // Importa: cero facturado y "todavía no lo cargué" son cosas distintas, y
    // la columna de cobrado se deja en blanco todos los meses.
    expect(parseMonto("")).toBe(null);
    expect(parseMonto(null)).toBe(null);
    expect(parseMonto(undefined)).toBe(null);
    expect(parseMonto("no es un numero")).toBe(null);
  });
});

describe("mostrarlo para que se lea", () => {
  it("pone los puntos y siempre los dos centavos", () => {
    expect(fmtMonto(2673574.83)).toBe("2.673.574,83");
    expect(fmtMonto("2673574.83")).toBe("2.673.574,83");
    expect(fmtMonto(1000)).toBe("1.000,00");
    expect(fmtMonto(0)).toBe("0,00");
  });

  it("no toca lo que no es un número", () => {
    // Devolverlo tal cual es a propósito: si alguien dejó escrita una palabra,
    // que la vea y la corrija, no que el campo se la convierta en un importe.
    expect(fmtMonto("-")).toBe("-");
    expect(fmtMonto("no es un numero")).toBe("no es un numero");
    expect(fmtMonto("")).toBe("");
    expect(fmtMonto(null)).toBe("");
  });

  it("una coma a medio escribir se completa al salir", () => {
    // "12," no es basura: es alguien que iba a escribir los centavos y se fue.
    expect(fmtMonto("12,")).toBe("12,00");
  });

  it("la ida y la vuelta no pierden un centavo", () => {
    for (const n of [0.01, 1, 1500, 987654.5, 2673574.83, 3235025.54, 12345678.9]) {
      expect(parseMonto(fmtMonto(n))).toBe(n);
    }
  });
});
