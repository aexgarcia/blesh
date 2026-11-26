import { describe, expect, it } from "vitest";

import { minorToInput, parsePENInput } from "@/shared/domain/money";
import { isValidSlug, slugify } from "@/shared/domain/slug";

describe("parsePENInput", () => {
  it("acepta formatos habituales sin floats", () => {
    expect(parsePENInput("70")).toBe(7000);
    expect(parsePENInput("70.5")).toBe(7050);
    expect(parsePENInput("70,50")).toBe(7050);
    expect(parsePENInput("S/ 99.90")).toBe(9990);
    expect(parsePENInput("0.10")).toBe(10);
  });

  it("rechaza ambigüedades y basura", () => {
    expect(parsePENInput("1.250,00")).toBeNull();
    expect(parsePENInput("70.555")).toBeNull();
    expect(parsePENInput("-5")).toBeNull();
    expect(parsePENInput("abc")).toBeNull();
    expect(parsePENInput("")).toBeNull();
  });

  it("ida y vuelta para editar", () => {
    expect(minorToInput(7050)).toBe("70.50");
    expect(parsePENInput(minorToInput(12345))).toBe(12345);
  });
});

describe("slug", () => {
  it("genera URLs limpias en español", () => {
    expect(slugify('Longsleeve "Archivés" Ñandú')).toBe("longsleeve-archives-nandu");
    expect(slugify("  Boxy   Essential  ")).toBe("boxy-essential");
    expect(isValidSlug("boxy-essential")).toBe(true);
    expect(isValidSlug("Boxy")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
  });
});
