import { describe, expect, it } from "vitest";

import { recommendByBody } from "@/modules/catalog/domain/size-recommendation";

describe("calculadora por altura y peso", () => {
  it("aplica rangos de altura y corrección por peso", () => {
    expect(recommendByBody({ heightCm: 172, weightKg: 70 })).toBe("M");
    expect(recommendByBody({ heightCm: 165, weightKg: 60 })).toBe("S");
    expect(recommendByBody({ heightCm: 165, weightKg: 68 })).toBe("M");
    expect(recommendByBody({ heightCm: 165, weightKg: 80 })).toBe("L");
    expect(recommendByBody({ heightCm: 178, weightKg: 60 })).toBe("L");
    expect(recommendByBody({ heightCm: 177, weightKg: 79 })).toBe("M");
  });
  it("rechaza datos fuera de rango", () => {
    expect(recommendByBody({ heightCm: 0, weightKg: 70 })).toBeNull();
    expect(recommendByBody({ heightCm: 170, weightKg: Number.NaN })).toBeNull();
    expect(recommendByBody({ heightCm: 250, weightKg: 70 })).toBeNull();
  });
});
