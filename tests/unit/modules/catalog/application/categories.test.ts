import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { categoryInputSchema, saveCategory } from "@/modules/catalog/application/categories";

const input = { name: "  Polos  ", slug: "polos", description: "  Prendas  ", position: 0, active: true, operationKey: randomUUID() };
describe("categorías", () => {
  it("normaliza textos y valida URL, posición y versión", () => {
    expect(categoryInputSchema.parse(input)).toMatchObject({ name: "Polos", description: "Prendas" });
    for (const patch of [{ slug: "../admin" }, { slug: "Polos" }, { name: " " }, { position: -1 }, { position: 1.5 }, { id: randomUUID() }]) expect(categoryInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("rechaza la escritura sin autorización", async () => {
    const save = vi.fn();
    expect(await saveCategory({ authorize: () => false, store: { save } }, { membershipId: randomUUID(), role: "operator" }, input)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(save).not.toHaveBeenCalled();
  });
});
