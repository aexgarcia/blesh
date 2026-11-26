import { describe, expect, it } from "vitest";

import { computePromotions, packTotalMinor, PACK_POLICIES, promotionCode, type PackPolicy } from "@/modules/sales/domain/promotions";

const policy = PACK_POLICIES[0] as PackPolicy;
const boxy = (quantity: number, unitPriceMinor = 4000) => ({ categorySlug: "boxy-essential", unitPriceMinor, quantity });

describe("packs por cantidad", () => {
  it("escala 1 × S/40 · 2 × S/75 · 3 × S/99 y grupos de 3 + resto", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => packTotalMinor(policy, n))).toEqual([0, 4000, 7500, 9900, 13900, 17400, 19800, 23800]);
  });

  it("suma unidades de distintos colores/tallas de la categoría elegible", () => {
    const result = computePromotions([boxy(1), boxy(1), boxy(1), { categorySlug: "basicos", unitPriceMinor: 5200, quantity: 2 }]);
    expect(result.discountMinor).toBe(12000 - 9900);
    expect(result.applied[0]).toMatchObject({ units: 3, listMinor: 12000, packMinor: 9900 });
    expect(promotionCode(result)).toBe("pack-boxy-essential@1");
  });

  it("sin prendas elegibles o con 1 a precio normal no hay descuento", () => {
    expect(computePromotions([{ categorySlug: "basicos", unitPriceMinor: 5200, quantity: 3 }])).toEqual({ discountMinor: 0, applied: [] });
    expect(computePromotions([boxy(1)]).discountMinor).toBe(0);
    expect(promotionCode(computePromotions([boxy(1)]))).toBeNull();
  });

  it("nunca es negativo si el precio normal ya es menor que el del pack", () => {
    expect(computePromotions([boxy(3, 3000)]).discountMinor).toBe(0);
  });

  it("es determinista y en céntimos enteros", () => {
    const result = computePromotions([boxy(2), boxy(5)]);
    expect(result.discountMinor).toBe(7 * 4000 - 23800);
    expect(Number.isSafeInteger(result.discountMinor)).toBe(true);
  });
});

describe("packs solapados", () => {
  it("una prenda solo cuenta en el primer pack que la acepta", () => {
    const twin: PackPolicy = { ...PACK_POLICIES[0], code: "otro-pack", label: "Otro" };
    const lines = [{ categorySlug: "boxy-essential", unitPriceMinor: 5000, quantity: 3 }];
    const result = computePromotions(lines, [PACK_POLICIES[0], twin]);
    expect(result.applied).toHaveLength(1);
    expect(result.discountMinor).toBe(15000 - 9900);
  });
});
