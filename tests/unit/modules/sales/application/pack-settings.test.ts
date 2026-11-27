import { describe, expect, it } from "vitest";

import { computePromotions, PACK_POLICIES } from "@/modules/sales/domain/promotions";
import { packSettingsSchema } from "@/modules/sales/application/pack-settings";

describe("pack administrable", () => {
  it("rechaza escalas incoherentes y productos vacíos o repetidos", () => {
    const data = { enabled: true, label: "Pack", productSlugs: ["boxy-essential"], tierTotalsMinor: [4000,7500,9900] };
    expect(packSettingsSchema.safeParse(data).success).toBe(true);
    for (const tierTotalsMinor of [[4000,3000,9900], [4000,8100,9900], [4000,7500,12000], [0,0,0]]) expect(packSettingsSchema.safeParse({ ...data, tierTotalsMinor }).success).toBe(false);
    expect(packSettingsSchema.safeParse({ ...data, productSlugs: [] }).success).toBe(false);
    expect(packSettingsSchema.safeParse({ ...data, productSlugs: ["boxy-essential", "boxy-essential"] }).success).toBe(false);
  });
  it("la selección explícita sustituye a la categoría; nunca mezcla productos excluidos", () => {
    const policies = [{ ...PACK_POLICIES[0], version: 2, productSlugs: ["producto-a", "producto-b"] }];
    const lines = [
      { productSlug: "producto-a", categorySlug: "otra", unitPriceMinor: 4000, quantity: 1 },
      { productSlug: "producto-b", categorySlug: "otra", unitPriceMinor: 4000, quantity: 1 },
      { productSlug: "excluido", categorySlug: "boxy-essential", unitPriceMinor: 4000, quantity: 1 },
    ];
    expect(computePromotions(lines, policies)).toMatchObject({ discountMinor: 500, applied: [{ version: 2, units: 2 }] });
    expect(computePromotions(lines, []).discountMinor).toBe(0);
  });
});
