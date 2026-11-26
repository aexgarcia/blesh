import { describe, expect, it } from "vitest";

import { evaluateQuote, normalizeQuoteLines, type PricedVariant } from "@/modules/sales/domain/cart-quote";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

const variant = (variantId: string, over: Partial<PricedVariant> = {}): PricedVariant => ({
  variantId,
  sku: `SKU-${variantId.slice(-1)}`,
  productTitle: "Boxy Essential",
  colorLabel: "Negro",
  sizeCode: "M",
  priceMinor: 4000,
  sellable: true,
  ...over,
});

describe("normalización de la cotización", () => {
  it("une repetidas conservando el primer precio visto", () => {
    expect(
      normalizeQuoteLines([
        { variantId: A, quantity: 2, seenPriceMinor: 4000 },
        { variantId: A, quantity: 3, seenPriceMinor: 3000 },
      ]),
    ).toEqual([{ variantId: A, quantity: 5, seenPriceMinor: 4000 }]);
  });

  it("rechaza carritos manipulados en vez de recortarlos", () => {
    expect(normalizeQuoteLines([])).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(normalizeQuoteLines([{ variantId: A, quantity: 1.5 }])).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(normalizeQuoteLines([{ variantId: A, quantity: 6 }, { variantId: A, quantity: 6 }])).toMatchObject({ message: expect.stringContaining("10 unidades") });
    const many = Array.from({ length: 51 }, (_, i) => ({ variantId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, quantity: 1 }));
    expect(normalizeQuoteLines(many)).toMatchObject({ message: expect.stringContaining("50 productos") });
  });
});

describe("evaluación de la cotización", () => {
  it("lista para enviar si todo es vendible, con unidades y precios aceptados", () => {
    const quote = evaluateQuote([{ variantId: A, quantity: 2, seenPriceMinor: 4000 }], new Map([[A, variant(A)]]), new Map([[A, 5]]));
    expect(quote).toMatchObject({ ready: true, subtotalMinor: 8000, units: 2 });
    expect(quote.lines[0]).toMatchObject({ status: "ok", maxQuantity: null, previousPriceMinor: null, lineTotalMinor: 8000 });
  });

  it("marca despublicados, inexistentes, agotados y faltantes; no suma lo no vendible", () => {
    const quote = evaluateQuote(
      [
        { variantId: A, quantity: 3 },
        { variantId: B, quantity: 1 },
        { variantId: C, quantity: 1 },
        { variantId: "00000000-0000-4000-8000-0000000000ff", quantity: 1 },
      ],
      new Map([
        [A, variant(A)],
        [B, variant(B, { sellable: false })],
        [C, variant(C)],
      ]),
      new Map([
        [A, 2],
        [B, 9],
        [C, 0],
      ]),
    );
    expect(quote.lines.map((l) => l.status)).toEqual(["insufficient", "unavailable", "sold_out", "unavailable"]);
    expect(quote.lines[0].maxQuantity).toBe(2);
    expect(quote.lines[3].variant).toBeNull();
    expect(quote).toMatchObject({ ready: false, subtotalMinor: 12000, units: 3 });
  });

  it("un precio distinto del visto exige nueva aceptación", () => {
    const quote = evaluateQuote([{ variantId: A, quantity: 1, seenPriceMinor: 3500 }], new Map([[A, variant(A)]]), new Map([[A, 5]]));
    expect(quote.lines[0].previousPriceMinor).toBe(3500);
    expect(quote.ready).toBe(false);
    expect(quote.subtotalMinor).toBe(4000);
  });

  it("sin precio visto no hay aviso de cambio (primera cotización)", () => {
    const quote = evaluateQuote([{ variantId: A, quantity: 1 }], new Map([[A, variant(A)]]), new Map([[A, 1]]));
    expect(quote.ready).toBe(true);
  });

  it("aplica el pack del servidor sobre las líneas vendibles (no sobre agotados)", () => {
    const boxy = (id: string) => variant(id, { categorySlug: "boxy-essential" });
    const quote = evaluateQuote(
      [{ variantId: A, quantity: 2 }, { variantId: B, quantity: 1 }, { variantId: C, quantity: 1 }],
      new Map([[A, boxy(A)], [B, boxy(B)], [C, boxy(C)]]),
      new Map([[A, 5], [B, 5], [C, 0]]),
    );
    expect(quote).toMatchObject({ subtotalMinor: 12000, totalMinor: 9900, promotion: { discountMinor: 2100 } });
  });
});
