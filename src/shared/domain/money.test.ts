import { describe, expect, it } from "vitest";

import { assertMinorAmount, formatPEN, MAX_UNIT_PRICE_MINOR, multiplyMinor, sumMinor } from "./money";

describe("money", () => {
  it("formatea céntimos como soles en es-PE", () => {
    expect(formatPEN(4000)).toMatch(/^S\/\s?40\.00$/);
    expect(formatPEN(7550)).toMatch(/75\.50$/);
  });

  it("multiplica precio unitario por cantidad entera", () => {
    expect(multiplyMinor(4000, 3)).toBe(12000);
  });

  it("rechaza cantidades no enteras, cero o negativas", () => {
    expect(() => multiplyMinor(4000, 1.5)).toThrow(RangeError);
    expect(() => multiplyMinor(4000, 0)).toThrow(RangeError);
    expect(() => multiplyMinor(4000, -1)).toThrow(RangeError);
  });

  it("rechaza importes con decimales, negativos o fuera de rango", () => {
    expect(() => assertMinorAmount(10.5)).toThrow(RangeError);
    expect(() => assertMinorAmount(-1)).toThrow(RangeError);
    expect(() => multiplyMinor(MAX_UNIT_PRICE_MINOR + 1, 1)).toThrow(RangeError);
  });

  it("suma importes sin floats", () => {
    expect(sumMinor([1, 2, 4000])).toBe(4003);
    expect(sumMinor([])).toBe(0);
  });
});
