import type { MetadataRoute } from "next";

type SitemapData = { origin: string; indexable: boolean; products: { href: string; updatedAt: string }[]; categories: { slug: string }[] };

export function buildSitemap({ origin, indexable, products, categories }: SitemapData): MetadataRoute.Sitemap {
  if (!indexable) return [];
  const entries: MetadataRoute.Sitemap = [
    { url: `${origin}/` }, { url: `${origin}/productos` },
    ...categories.map((c) => ({ url: `${origin}/categorias/${c.slug}` })),
    ...products.map((p) => ({ url: new URL(p.href, origin).href, lastModified: p.updatedAt })),
  ];
  if (entries.length > 50_000) throw new Error("El sitemap supera 50.000 URLs: dividir antes de publicar");
  return entries;
}

export function buildRobots(origin: string, indexable: boolean): MetadataRoute.Robots {
  return indexable
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/admin", "/carrito"] }, sitemap: `${origin}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };
  // /solicitud no se bloquea aquí en producción: el crawler debe poder leer su noindex.
}
