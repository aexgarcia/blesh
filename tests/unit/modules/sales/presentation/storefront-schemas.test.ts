import { describe, expect, it } from "vitest";

import { quoteLinesSchema, requestFormSchema } from "@/modules/sales/presentation/storefront-schemas";

const A = "00000000-0000-4000-8000-00000000000a";
const key = "11111111-1111-4111-8111-111111111111";

const form = (over: Record<string, unknown> = {}) => ({
  customerName: "Ana",
  customerPhone: "987654321",
  deliveryPreference: "undecided",
  acceptedTerms: "on",
  termsVersion: "v1",
  creationKey: key,
  acceptedTotalMinor: "4000",
  lines: JSON.stringify([{ variantId: A, quantity: 1, acceptedPriceMinor: 4000 }]),
  ...over,
});

describe("entradas públicas de la tienda", () => {
  it("acepta un carrito bien formado", () => {
    expect(quoteLinesSchema.safeParse([{ variantId: A, quantity: 2, seenPriceMinor: 4000 }]).success).toBe(true);
    expect(requestFormSchema.safeParse(form()).success).toBe(true);
  });

  it("rechaza ids falsos, cantidades no enteras o fuera de rango y exceso de líneas", () => {
    expect(quoteLinesSchema.safeParse([{ variantId: "1; drop table", quantity: 1 }]).success).toBe(false);
    expect(quoteLinesSchema.safeParse([{ variantId: A, quantity: 1.5 }]).success).toBe(false);
    expect(quoteLinesSchema.safeParse([{ variantId: A, quantity: 11 }]).success).toBe(false);
    expect(quoteLinesSchema.safeParse([{ variantId: A, quantity: "2" }]).success).toBe(false);
    expect(quoteLinesSchema.safeParse(Array.from({ length: 51 }, () => ({ variantId: A, quantity: 1 }))).success).toBe(false);
    expect(quoteLinesSchema.safeParse("x").success).toBe(false);
  });

  it("rechaza solicitudes con carrito manipulado o cuerpo enorme", () => {
    expect(requestFormSchema.safeParse(form({ lines: "no-json" })).success).toBe(false);
    expect(requestFormSchema.safeParse(form({ lines: JSON.stringify([{ variantId: A, quantity: 0, acceptedPriceMinor: 4000 }]) })).success).toBe(false);
    expect(requestFormSchema.safeParse(form({ lines: JSON.stringify([{ variantId: A, quantity: 1, acceptedPriceMinor: 0.5 }]) })).success).toBe(false);
    expect(requestFormSchema.safeParse(form({ lines: "[" + " ".repeat(30_000) + "]" })).success).toBe(false);
    expect(requestFormSchema.safeParse(form({ creationKey: "corta" })).success).toBe(false);
    expect(requestFormSchema.safeParse(form({ deliveryPreference: "drone" })).success).toBe(false);
    expect(requestFormSchema.safeParse(form({ acceptedTotalMinor: "40.5" })).success).toBe(false);
  });
});
