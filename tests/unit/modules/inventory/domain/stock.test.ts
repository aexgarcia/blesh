import { describe, expect, it } from "vitest";

import { checkResultingBalance, validateAdjustment } from "@/modules/inventory/domain/stock";

describe("ajustes de stock", () => {
  it("rechaza cantidades nulas o no enteras", () => {
    expect(validateAdjustment({ delta: 0, reason: "restock", note: null })?.code).toBe("VALIDATION_ERROR");
    expect(validateAdjustment({ delta: 1.5, reason: "restock", note: null })?.code).toBe("VALIDATION_ERROR");
  });

  it("coherencia entre motivo y sentido", () => {
    expect(validateAdjustment({ delta: -1, reason: "restock", note: null })).not.toBeNull();
    expect(validateAdjustment({ delta: 2, reason: "damage", note: null })).not.toBeNull();
    expect(validateAdjustment({ delta: -1, reason: "damage", note: null })).toBeNull();
  });

  it("exige nota en correcciones, pérdidas y otros", () => {
    expect(validateAdjustment({ delta: -1, reason: "loss", note: " " })?.field).toBe("note");
    expect(validateAdjustment({ delta: 3, reason: "count_correction", note: "Recuento" })).toBeNull();
  });

  it("nunca deja el físico bajo 0 ni bajo lo reservado", () => {
    expect(checkResultingBalance(5, 0, -6)?.code).toBe("NEGATIVE_STOCK");
    expect(checkResultingBalance(5, 3, -3)?.code).toBe("BELOW_RESERVED");
    expect(checkResultingBalance(5, 3, -2)).toBeNull();
  });
});
