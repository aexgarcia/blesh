import { describe, expect, it } from "vitest";

import { normalizeGuide, parseCentimeters } from "@/modules/catalog/domain/size-guide";

describe("medidas de una guía", () => {
  it("acepta cm con coma/punto y un decimal, sin redondear datos ambiguos", () => {
    expect(parseCentimeters("70")).toBe("70.0");
    expect(parseCentimeters(" 70,5 ")).toBe("70.5");
    for (const input of ["", "0", "-1", "200.1", "70.55", "70cm", "NaN"]) expect(parseCentimeters(input)).toBeNull();
  });
  it("normaliza y ordena las tallas", () => {
    expect(normalizeGuide({ name: " Hoodies ", rows: [{ sizeCode: "M", lengthCm: "70", widthCm: "62" }, { sizeCode: "S", lengthCm: "68", widthCm: "60" }] })).toEqual({ name: "Hoodies", rows: [{ sizeCode: "S", lengthCm: "68.0", widthCm: "60.0" }, { sizeCode: "M", lengthCm: "70.0", widthCm: "62.0" }] });
  });
  it("rechaza tallas repetidas, única combinada, dimensiones incompletas o tabla vacía", () => {
    const row = { sizeCode: "M", lengthCm: "70", widthCm: "62" };
    for (const rows of [[], [row, row], [{ ...row, sizeCode: "UNICA" }, row], [{ ...row, widthCm: "" }], [{ ...row, lengthCm: "201" }]]) expect(normalizeGuide({ name: "Guía", rows })).toHaveProperty("message");
  });
});
