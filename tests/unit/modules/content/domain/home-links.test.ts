import { describe, expect, it } from "vitest";

import { homeTargetAvailable, isHomeTarget } from "@/modules/content/domain/home-links";

describe("destinos de portada y colecciones", () => {
  it("rechaza enlaces externos, scripts, rutas privadas y escapes", () => {
    for (const href of ["javascript:alert(1)", "//evil.test", "https://evil.test", "/admin", "/productos/../admin", "/categorias/%2fadmin", "/productos\\evil", "#inexistente"]) expect(isHomeTarget(href)).toBe(false);
    for (const href of ["/productos", "/productos/polo-peru", "/categorias/basicos", "#productos"]) expect(isHomeTarget(href)).toBe(true);
  });
  it("excluye categorías inactivas y productos retirados", () => {
    expect(homeTargetAvailable("/categorias/basicos", [{ slug: "basicos" }], [])).toBe(true);
    expect(homeTargetAvailable("/categorias/basicos", [], [])).toBe(false);
    expect(homeTargetAvailable("/productos/polo", [], [{ slug: "polo", status: "draft" }])).toBe(false);
    expect(homeTargetAvailable("/productos/polo", [], [{ slug: "polo", status: "published" }])).toBe(true);
  });
});
