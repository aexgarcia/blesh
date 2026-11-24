import { describe, expect, it } from "vitest";

import { formatPhone, normalizeEmail, normalizeName, normalizePhone, parseReason, parseSearch } from "./customer";

const ok = (raw: string) => {
  const r = normalizePhone(raw);
  return r.ok ? r.value : null;
};

describe("normalizePhone", () => {
  it("normaliza celulares peruanos en sus formas habituales", () => {
    for (const raw of ["987654321", "987 654 321", "987-654-321", "+51 987 654 321", "51987654321", "0051 987654321", "(+51) 987654321"]) {
      expect(ok(raw), raw).toBe("+51987654321");
    }
  });

  it("acepta fijos con código de área y números internacionales", () => {
    expect(ok("+51 1 4567890")).toBe("+5114567890");
    expect(ok("+34 612 345 678")).toBe("+34612345678");
    expect(ok("+1 (415) 555-0100")).toBe("+14155550100");
  });

  it("rechaza formatos ambiguos o inválidos", () => {
    for (const raw of ["", "12345", "887654321", "98765432", "9876543210", "+51 98765432", "+0 123456789", "98765a321", "9876+54321"]) {
      expect(ok(raw), raw).toBeNull();
    }
  });

  it("formatea para lectura", () => {
    expect(formatPhone("+51987654321")).toBe("+51 987 654 321");
    expect(formatPhone("+34612345678")).toBe("+34612345678");
  });
});

describe("nombre, correo y motivo", () => {
  it("normaliza espacios y exige longitud", () => {
    expect(normalizeName("  Ana   Pérez ")).toEqual({ ok: true, value: "Ana Pérez" });
    expect(normalizeName("A").ok).toBe(false);
    expect(normalizeName("x".repeat(121)).ok).toBe(false);
  });

  it("correo opcional en minúsculas", () => {
    expect(normalizeEmail("")).toEqual({ ok: true, value: null });
    expect(normalizeEmail(" Ana@Correo.PE ")).toEqual({ ok: true, value: "ana@correo.pe" });
    expect(normalizeEmail("ana@correo").ok).toBe(false);
  });

  it("motivo obligatorio u opcional", () => {
    expect(parseReason("", true).ok).toBe(false);
    expect(parseReason("", false)).toEqual({ ok: true, value: null });
    expect(parseReason("Duplicada por error", true)).toEqual({ ok: true, value: "Duplicada por error" });
  });
});

describe("parseSearch", () => {
  it("distingue teléfono de texto", () => {
    expect(parseSearch("  ")).toEqual({ kind: "none" });
    expect(parseSearch("987 654")).toEqual({ kind: "phone", digits: "987654" });
    expect(parseSearch("+51 987")).toEqual({ kind: "phone", digits: "51987" });
    expect(parseSearch("Ana 2")).toEqual({ kind: "text", text: "Ana 2" });
    expect(parseSearch("ana@correo.pe")).toEqual({ kind: "text", text: "ana@correo.pe" });
  });
});
