import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { SIZE_LABELS, type ColorCard, type ProductSizeGuide, type PublicCategory, type PublicProductColor } from "@/modules/catalog/contracts";
import {
  CATALOG_CACHE_TAG,
  countPublishedColorCards,
  getPrimaryColorHref,
  getPublicCategory,
  getPublicProductColor,
  listPublicCategories,
  listPublicSitemapEntries,
  listPublishedColorCards,
  listPublishedColorPaths,
  listSizeGuideOptions,
} from "@/modules/catalog/server";
import { getStorefrontContent } from "@/modules/content/server";
import { getBalances } from "@/modules/inventory/server";
import { getPublicImagesByIds } from "@/modules/media/server";
import { packApplies } from "@/modules/sales/contracts";
import { getPublicPackPolicies } from "@/modules/sales/server";

/**
 * Lecturas públicas de la tienda: catálogo (catalog) + disponibilidad orientativa (inventory)
 * + URLs de imágenes (media) + contenido estático (content), cruzados por ids. Caché
 * compartida con la etiqueta del catálogo y TTL de 5 minutos (SDD §7): solo datos públicos.
 * La disponibilidad aquí es aproximada; la venta la autoriza la cotización/confirmación.
 */

function publicCatalogCache() {
  cacheTag(CATALOG_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
}

export type StoreImage = { url: string; width: number; height: number; alt: string };

export type StoreSize = {
  variantId: string;
  sku: string;
  sizeCode: string;
  sizeLabel: string;
  priceMinor: number;
  compareAtMinor: number | null;
  soldOut: boolean;
};

export type StoreCard = {
  key: string;
  href: string;
  productSlug: string;
  categorySlug: string | null;
  title: string;
  colorLabel: string;
  swatchHex: string | null;
  image: StoreImage | null;
  hoverImage: StoreImage | null;
  minPriceMinor: number;
  maxPriceMinor: number;
  compareAtMinor: number | null;
  soldOut: boolean;
  badge: string | null;
  /** Tallas para «agregar rápido»; SKU común a los eventos de ficha y carrito. */
  sizes: { variantId: string; sku: string; sizeCode: string; sizeLabel: string; priceMinor: number; soldOut: boolean }[];
};

export type StoreProduct = Omit<PublicProductColor, "images" | "colors" | "variants"> & {
  images: StoreImage[];
  colors: (PublicProductColor["colors"][number] & { image: StoreImage | null })[];
  sizes: StoreSize[];
  soldOut: boolean;
};

export const STORE_PAGE_SIZE = 24;

async function availableUnits(variantIds: string[]): Promise<Map<string, number>> {
  const balances = await getBalances(variantIds);
  return new Map([...balances.values()].map((b) => [b.variantId, b.available]));
}

async function toCards(cards: ColorCard[]): Promise<StoreCard[]> {
  const extras = (await getStorefrontContent()).products;
  const mediaIds = cards.flatMap((c) => [c.coverMediaId, c.secondMediaId]).filter((id): id is string => id !== null);
  const [units, images] = await Promise.all([availableUnits(cards.flatMap((c) => c.variantIds)), getPublicImagesByIds(mediaIds)]);
  const image = (mediaId: string | null, alt: string): StoreImage | null => {
    const m = mediaId ? images.get(mediaId) : undefined;
    return m ? { url: m.url, width: m.width, height: m.height, alt } : null;
  };
  return cards.map((c) => {
    const sizes = c.variants.map((v) => ({ variantId: v.id, sku: v.sku, sizeCode: v.sizeCode, sizeLabel: SIZE_LABELS[v.sizeCode] ?? v.sizeCode, priceMinor: v.priceMinor, soldOut: (units.get(v.id) ?? 0) <= 0 }));
    return {
      key: c.colorId,
      href: c.href,
      productSlug: c.productSlug,
      categorySlug: c.categorySlug,
      title: c.title,
      colorLabel: c.colorLabel,
      swatchHex: c.swatchHex,
      image: image(c.coverMediaId, c.coverAlt ?? `${c.title} ${c.colorLabel}`),
      hoverImage: image(c.secondMediaId, ""),
      minPriceMinor: c.minPriceMinor,
      maxPriceMinor: c.maxPriceMinor,
      compareAtMinor: c.compareAtMinor,
      soldOut: sizes.every((s) => s.soldOut),
      badge: extras[c.productSlug]?.badge ?? null,
      sizes,
    };
  });
}

/** Disponibles primero, agotados al final (como el prototipo); orden estable. */
const availableFirst = (cards: StoreCard[]) => [...cards].sort((a, b) => Number(a.soldOut) - Number(b.soldOut));

/** Página del catálogo (tarjetas por color, orden estable). */
export async function getStoreCards(filter: { categorySlug?: string; page: number }): Promise<{ cards: StoreCard[]; total: number; page: number; pageCount: number }> {
  "use cache";
  publicCatalogCache();
  const total = await countPublishedColorCards(filter.categorySlug);
  const pageCount = Math.max(1, Math.ceil(total / STORE_PAGE_SIZE));
  const page = Math.min(Math.max(1, filter.page), pageCount);
  const cards = await listPublishedColorCards({ categorySlug: filter.categorySlug, limit: STORE_PAGE_SIZE, offset: (page - 1) * STORE_PAGE_SIZE });
  return { cards: availableFirst(await toCards(cards)), total, page, pageCount };
}

export async function getStoreCategories(): Promise<PublicCategory[]> {
  "use cache";
  publicCatalogCache();
  return listPublicCategories();
}

export async function getStoreCategory(slug: string): Promise<PublicCategory | null> {
  "use cache";
  publicCatalogCache();
  return getPublicCategory(slug);
}

export type PackShowcase = {
  guides: ProductSizeGuide[];
  label: string;
  tierTotalsMinor: readonly [number, number, number];
  colors: { code: string; productSlug: string; productTitle: string; colorLabel: string; label: string; swatchHex: string | null; image: StoreImage | null; sizes: StoreCard["sizes"] }[];
};

export type HomeData = {
  drop: StoreCard[];
  circles: { slug: string | null; name: string; href: string; image: StoreImage | null }[];
  cards: StoreCard[];
  categories: PublicCategory[];
  pack: PackShowcase | null;
  reels: { title: string; href: string | null; priceMinor: number | null; videoUrl: string | null; posterUrl: string | null }[];
};

/** Todo lo que pinta la portada del prototipo, en una lectura cacheada. */
export async function getHomeData(): Promise<HomeData> {
  "use cache";
  publicCatalogCache();
  const content = await getStorefrontContent();
  const [categories, guides] = await Promise.all([listPublicCategories(), listSizeGuideOptions()]);
  const cards = await toCards(await listPublishedColorCards({ limit: 48 }));
  const firstOf = (slug: string) => cards.find((c) => c.productSlug === slug) ?? null;

  const drop = content.drop.productSlugs.map(firstOf).filter((c): c is StoreCard => c !== null);
  const policy = (await getPublicPackPolicies())[0] ?? null;
  const packRows = policy ? await listPublishedColorCards({ limit: 48, ...(policy.productSlugs ? { productSlugs: policy.productSlugs } : { categorySlug: policy.categorySlug }) }) : [];
  const packCards = await toCards(packRows);
  const packGuides: ProductSizeGuide[] = [...new Set(packRows.map((c) => c.productSlug))].flatMap((slug) => {
    const card = packRows.find((c) => c.productSlug === slug)!;
    const guide = guides.find((g) => g.id === card.sizeGuideId);
    return [{ productSlug: slug, productTitle: card.title, guide: guide ? { name: guide.name, rows: guide.rows } : null, availableSizes: [...new Set(packCards.filter((c) => c.productSlug === slug).flatMap((c) => c.sizes.filter((s) => !s.soldOut).map((s) => s.sizeCode)))] }];
  });
  // Enlaces de videos resueltos por slug aunque el producto no esté entre las primeras 48 tarjetas.
  const reelCards = content.reels.items.length ? await toCards(await listPublishedColorCards({ limit: 48, productSlugs: content.reels.items.map((r) => r.productSlug) })) : [];

  return {
    drop: drop.length ? drop : cards.slice(0, 6),
    circles: [
      { slug: null, name: "Todo", href: "/productos", image: cards[0]?.image ?? null },
      ...categories.map((cat) => ({ slug: cat.slug, name: cat.name, href: `/categorias/${cat.slug}`, image: cards.find((c) => c.categorySlug === cat.slug)?.image ?? null })),
    ],
    cards: availableFirst(cards),
    categories,
    pack:
      policy && packCards.length
        ? {
            label: policy.label,
            guides: packGuides,
            tierTotalsMinor: policy.tierTotalsMinor,
            colors: packCards.filter((c) => packApplies(policy, c)).map((c) => ({ code: c.key, productSlug: c.productSlug, productTitle: c.title, colorLabel: c.colorLabel, label: policy.productSlugs && policy.productSlugs.length > 1 ? `${c.title} · ${c.colorLabel}` : c.colorLabel, swatchHex: c.swatchHex, image: c.image, sizes: c.sizes })),
          }
        : null,
    reels: content.reels.items.flatMap((r) => {
      const card = reelCards.find((c) => c.productSlug === r.productSlug);
      if (!card) return [];
      return { title: r.title, href: card?.href ?? null, priceMinor: card?.minPriceMinor ?? null, videoUrl: r.videoUrl, posterUrl: r.posterUrl };
    }),
  };
}

/** Ficha por color con tallas, agotados (orientativo) e imágenes; null si no es visible. */
export async function getStoreProduct(slug: string, colorSlug: string): Promise<StoreProduct | null> {
  "use cache";
  publicCatalogCache();
  const product = await getPublicProductColor(slug, colorSlug);
  if (!product) return null;
  const mediaIds = [...product.images.map((i) => i.mediaId), ...product.colors.map((c) => c.coverMediaId).filter((id): id is string => id !== null)];
  const [units, media] = await Promise.all([availableUnits(product.variants.map((v) => v.id)), getPublicImagesByIds(mediaIds)]);
  const image = (mediaId: string | null, alt: string): StoreImage | null => {
    const m = mediaId ? media.get(mediaId) : undefined;
    return m ? { url: m.url, width: m.width, height: m.height, alt } : null;
  };
  const sizes = product.variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    sizeCode: v.sizeCode,
    sizeLabel: SIZE_LABELS[v.sizeCode] ?? v.sizeCode,
    priceMinor: v.priceMinor,
    compareAtMinor: v.compareAtMinor,
    soldOut: (units.get(v.id) ?? 0) <= 0,
  }));
  const { images, colors, variants: _variants, ...rest } = product;
  void _variants;
  return {
    ...rest,
    images: images.map((i) => image(i.mediaId, i.alt)).filter((i): i is StoreImage => i !== null),
    colors: colors.map((c) => ({ ...c, image: image(c.coverMediaId, `${product.title} ${c.label}`) })),
    sizes,
    soldOut: sizes.every((s) => s.soldOut),
  };
}

/**
 * Tarjetas de la categoría (para «Modelo»: diseños hermanos de un producto de un solo color)
 * y relacionadas para «Completa el look» (misma categoría primero, agotados al final).
 */
export async function getProductNeighbours(categorySlug: string | null, productSlug: string): Promise<{ siblings: StoreCard[]; related: StoreCard[] }> {
  "use cache";
  publicCatalogCache();
  const cards = await toCards(await listPublishedColorCards({ limit: 48 }));
  const siblings = categorySlug ? cards.filter((c) => c.categorySlug === categorySlug) : [];
  const related = cards
    .filter((c) => c.productSlug !== productSlug)
    .sort((a, b) => Number(b.categorySlug === categorySlug) - Number(a.categorySlug === categorySlug) || Number(a.soldOut) - Number(b.soldOut));
  return { siblings, related: related.slice(0, 10) };
}

export async function getStorePrimaryHref(slug: string): Promise<string | null> {
  "use cache";
  publicCatalogCache();
  return getPrimaryColorHref(slug);
}

/** Rutas a prerenderizar en el build (el resto se genera en la primera visita). */
export async function getStoreProductPaths(): Promise<{ slug: string; colorSlug: string }[]> {
  "use cache";
  publicCatalogCache();
  return listPublishedColorPaths(100);
}

export async function getStoreSitemapEntries() {
  "use cache";
  publicCatalogCache();
  return listPublicSitemapEntries();
}
