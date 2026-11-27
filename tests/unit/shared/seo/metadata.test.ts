import { describe, expect, it } from "vitest";

import { buildRobots, buildSitemap } from "@/shared/seo/crawling";
import { listingPath, pageMetadata, serializeJsonLd } from "@/shared/seo/metadata";

describe("SEO público", () => {
  it("canonical por color y solo parámetro de paginación conocido", () => {
    const page = pageMetadata({ origin: "https://blesh.example", path: "/productos/boxy/negro", title: "Boxy Negro", description: "Prenda", image: { url: "https://images.example/negro.webp", alt: "Boxy Negro" } });
    expect(page.alternates?.canonical).toBe("https://blesh.example/productos/boxy/negro");
    expect(listingPath("/productos", "2")).toBe("/productos?pagina=2");
    expect(listingPath("/productos", "2&phone=987654321")).toBe("/productos");
  });
  it("no permite cerrar un script desde contenido administrable", () => {
    const payload = { name: '</script><script>alert("x")</script>\u2028' };
    const json = serializeJsonLd(payload);
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual(payload);
  });
  it("sitemap local vacío; producción conserva todo el catálogo sin límite de prerender 100", () => {
    const data = { origin: "https://blesh.example", categories: [{ slug: "ropa" }], products: Array.from({ length: 150 }, (_, i) => ({ href: `/productos/prenda-${i}/negro`, updatedAt: "2026-11-23T10:00:00Z" })) };
    expect(buildSitemap({ ...data, indexable: false })).toEqual([]);
    const sitemap = buildSitemap({ ...data, indexable: true });
    expect(sitemap).toHaveLength(153);
    expect(sitemap.at(-1)?.url).toContain("prenda-149/negro");
    expect(sitemap.some((s) => /admin|solicitud|carrito/.test(s.url))).toBe(false);
    expect(buildRobots(data.origin, false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});
