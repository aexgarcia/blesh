import { describe, expect, it, vi } from "vitest";

import { collectionsSectionSchema, heroSectionSchema, packSectionSchema, reelsSectionSchema, saveSection } from "@/modules/content/application/section-settings";

const data = { enabled: false, eyebrow: "", title: "Videos", handle: "@blesh", moreUrl: "", items: [] };
describe("configuración de secciones", () => {
  it("portada exige textos alternativos y las colecciones visibles necesitan tarjetas completas", () => {
    const hero = { enabled: true, title: "Portada", eyebrow: "", imageKey: "hero/banner.webp", imageAlt: "Prenda", ctaLabel: "Ver", ctaHref: "/productos", meta: [], metaRight: "" };
    expect(heroSectionSchema.safeParse(hero).success).toBe(true);
    expect(heroSectionSchema.safeParse({ ...hero, imageAlt: "" }).success).toBe(false);
    expect(heroSectionSchema.safeParse({ ...hero, imageKey: "hero/../secret.webp" }).success).toBe(false);
    const empty = { enabled: true, title: "Colecciones", eyebrow: "", items: [] };
    expect(collectionsSectionSchema.safeParse(empty).success).toBe(false);
    expect(collectionsSectionSchema.safeParse({ ...empty, enabled: false }).success).toBe(true);
    const item = { id: "00000000-0000-4000-8000-000000000001", title: "Colección", text: "", href: "/productos", imageKey: "collections/a.webp", imageAlt: "Prenda" };
    expect(collectionsSectionSchema.safeParse({ ...empty, items: [item] }).success).toBe(true);
    expect(collectionsSectionSchema.safeParse({ ...empty, items: [item, item] }).success).toBe(false);
    expect(collectionsSectionSchema.safeParse({ ...empty, items: [{ ...item, href: "#pack" }] }).success).toBe(false);
  });
  it("una sección de videos vacía se puede ocultar, pero no publicar", () => {
    expect(reelsSectionSchema.safeParse(data).success).toBe(true);
    expect(reelsSectionSchema.safeParse({ ...data, enabled: true }).success).toBe(false);
    expect(packSectionSchema.safeParse({ enabled: true, eyebrow: "", title: "" }).success).toBe(false);
  });
  it("rechaza enlaces de scripts, credenciales y dominios ajenos", () => {
    for (const moreUrl of ["javascript:alert(1)", "http://tiktok.com/x", "https://evil.example", "https://user:pass@instagram.com/x"]) expect(reelsSectionSchema.safeParse({ ...data, moreUrl }).success).toBe(false);
    expect(reelsSectionSchema.safeParse({ ...data, moreUrl: "https://www.instagram.com/blesh_pe/" }).success).toBe(true);
  });
  it("autoriza en el caso de uso antes de escribir", async () => {
    const save = vi.fn();
    await expect(saveSection({ store: { save }, authorize: () => false }, { membershipId: "actor", role: "operator" }, "pack", { data: { enabled: true, title: "Pack", eyebrow: "" }, expectedVersion: 0, operationKey: "00000000-0000-4000-8000-000000000001" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(save).not.toHaveBeenCalled();
  });
});
