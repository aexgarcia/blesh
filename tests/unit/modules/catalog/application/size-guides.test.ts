import { describe, expect, it, vi } from "vitest";

import { saveSizeGuide } from "@/modules/catalog/application/size-guides";

describe("registro de guía", () => {
  it("rechaza permiso o datos inválidos antes de escribir", async () => {
    const save = vi.fn();
    const actor = { membershipId: "actor", role: "operator" as const };
    const input = { name: "Hoodie", rows: [{ sizeCode: "M", lengthCm: "70", widthCm: "62" }], operationKey: "00000000-0000-4000-8000-000000000001" };
    expect(await saveSizeGuide({ store: { save }, authorize: () => false }, actor, input)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await saveSizeGuide({ store: { save }, authorize: () => true }, actor, { ...input, rows: [] })).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(save).not.toHaveBeenCalled();
  });
});
