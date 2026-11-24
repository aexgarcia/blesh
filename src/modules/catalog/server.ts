import "server-only";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";
import { getImagesByIds } from "@/modules/media/server";

import { publishProduct as publishProductUseCase } from "./application/product-editing";
import type { CatalogDeps } from "./application/ports";
import type { AdminProduct, ColorCard, ProductStatus, PublicationIssue, QuotableVariant } from "./contracts";
import { publicationIssues } from "./domain/rules";
import * as queries from "./infrastructure/catalog-queries";
import { createCatalogStore } from "./infrastructure/catalog-store";

export const CATALOG_CACHE_TAG = "catalog";

/** Dependencias de los casos de uso; la autorización la aporta identity. */
export function getCatalogDeps(): CatalogDeps {
  return {
    store: createCatalogStore(getDb()),
    authorize: (actor, capability) => actorCan(actor as AdminActor, capability),
    clock: { now: () => new Date() },
  };
}

export const listCategoryOptions = () => queries.listCategoryOptions(getDb());
export const listSizeGuideOptions = () => queries.listSizeGuideOptions(getDb());

export function listAdminProducts(filter: queries.AdminListFilter) {
  return queries.listAdminProducts(getDb(), filter);
}

/** Producto completo para el editor, con URLs de imágenes resueltas por media. */
export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const data = await queries.getProductForEditor(getDb(), id);
  if (!data) return null;
  const media = await getImagesByIds(data.images.map((i) => i.mediaId));
  const p = data.product;
  return {
    id: p.id,
    slug: p.slug,
    slugLocked: p.firstPublishedAt !== null,
    title: p.title,
    shortDescription: p.shortDescription,
    description: p.description,
    categoryId: p.categoryId,
    sizeGuideId: p.sizeGuideId,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    status: p.status as ProductStatus,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    version: p.version,
    updatedAt: p.updatedAt.toISOString(),
    colors: data.colors.map((c) => ({ id: c.id, colorCode: c.colorCode, label: c.label, slug: c.slug, swatchHex: c.swatchHex, active: c.active, isPrimary: c.isPrimary, position: c.position })),
    variants: data.variants.map((v) => ({ id: v.id, colorId: v.colorId, sku: v.sku, sizeCode: v.sizeCode, priceMinor: v.priceMinor, compareAtMinor: v.compareAtMinor, active: v.active, version: v.version })),
    images: data.images.map((i) => {
      const m = media.get(i.mediaId);
      return { id: i.id, mediaId: i.mediaId, colorId: i.colorId, alt: i.alt, position: i.position, isCover: i.isCover, url: m?.url ?? null, width: m?.width ?? null, height: m?.height ?? null };
    }),
  };
}

/** Requisitos pendientes para publicar (lista de verificación del editor). */
export async function getPublicationIssues(product: AdminProduct, variantsWithStockRecord: ReadonlySet<string>): Promise<PublicationIssue[]> {
  const categoriesList = await queries.listCategoryOptions(getDb());
  return publicationIssues({
    ...product,
    categoryActive: categoriesList.some((c) => c.id === product.categoryId),
    variantsWithStockRecord,
  });
}

/** Publicación: `variantsWithStockRecord` lo aporta la composición desde inventory. */
export function publishProduct(actor: AdminActor, input: { productId: string; expectedVersion: number; variantsWithStockRecord: ReadonlySet<string> }) {
  return publishProductUseCase(getCatalogDeps(), actor, input);
}

/** Tarjetas públicas por color (sin disponibilidad: la añade la composición desde inventory). */
export function listPublishedColorCards(filter: { categorySlug?: string; limit: number }): Promise<ColorCard[]> {
  return queries.listPublishedColorCards(getDb(), filter);
}

/** Para ventas: datos y precio vigente de variantes (cotización en servidor). */
export function getQuotableVariants(variantIds: readonly string[], db: AnyDatabase = getDb()): Promise<QuotableVariant[]> {
  return queries.getQuotableVariants(db, variantIds);
}

export function searchQuotableVariants(term: string, limit = 20): Promise<QuotableVariant[]> {
  return queries.searchQuotableVariants(getDb(), term, limit);
}
