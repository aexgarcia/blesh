import "server-only";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";
import { getImagesByIds } from "@/modules/media/server";

import { publishProduct as publishProductUseCase } from "./application/product-editing";
import type { CatalogDeps } from "./application/ports";
import type {
  AdminProduct,
  CartVariantDisplay,
  ColorCard,
  ProductStatus,
  PublicationIssue,
  PublicCategory,
  PublicProductColor,
  QuotableVariant,
} from "./contracts";
import { publicationIssues } from "./domain/rules";
import * as queries from "./infrastructure/catalog-queries";
import { createCatalogStore } from "./infrastructure/catalog-store";
import { guideStore, listGuides, readGuide } from "./infrastructure/size-guide-store";
import { saveSizeGuide as saveGuide, type SaveGuideInput } from "./application/size-guides";
import { saveCategory as saveCategoryUseCase, type SaveCategoryInput } from "./application/categories";
import { categoryStore, listCategories, readCategory } from "./infrastructure/category-store";

export function getCategoryDeps(db: AnyDatabase = getDb()) {
  return { store: categoryStore(db), authorize: (actor: { membershipId: string; role: "owner" | "operator" }) => actorCan(actor as AdminActor, "catalog.manage") };
}
export function listAdminCategories(actor: AdminActor, db: AnyDatabase = getDb()) {
  if (!actorCan(actor, "catalog.manage")) throw new Error("FORBIDDEN");
  return listCategories(db);
}
export function getAdminCategory(actor: AdminActor, id: string) {
  if (!actorCan(actor, "catalog.manage")) throw new Error("FORBIDDEN");
  return readCategory(getDb(), id);
}
export function saveCategory(actor: AdminActor, input: SaveCategoryInput) {
  return saveCategoryUseCase(getCategoryDeps(), actor, input);
}

export function getSizeGuideDeps(db: AnyDatabase = getDb()) {
  return { store: guideStore(db), authorize: (actor: { membershipId: string; role: "owner" | "operator" }) => actorCan(actor as AdminActor, "catalog.manage") };
}
export function listAdminSizeGuides(actor: AdminActor) {
  if (!actorCan(actor, "catalog.manage")) throw new Error("FORBIDDEN");
  return listGuides(getDb());
}
export function getAdminSizeGuide(actor: AdminActor, id: string) {
  if (!actorCan(actor, "catalog.manage")) throw new Error("FORBIDDEN");
  return readGuide(getDb(), id);
}
export function saveSizeGuide(actor: AdminActor, input: SaveGuideInput) {
  return saveGuide(getSizeGuideDeps(), actor, input);
}

export { CATALOG_CACHE_TAG } from "@/shared/cache/tags";

/** Dependencias de los casos de uso; la autorización la aporta identity. */
export function getCatalogDeps(): CatalogDeps {
  return {
    store: createCatalogStore(getDb()),
    authorize: (actor, capability) => actorCan(actor as AdminActor, capability),
    clock: { now: () => new Date() },
  };
}

export const listCategoryOptions = () => queries.listCategoryOptions(getDb());
export const listStorefrontProductOptions = () => queries.listStorefrontProductOptions(getDb());
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
export function listPublishedColorCards(filter: { categorySlug?: string; productSlugs?: readonly string[]; limit: number; offset?: number }): Promise<ColorCard[]> {
  return queries.listPublishedColorCards(getDb(), filter);
}

export const countPublishedColorCards = (categorySlug?: string) => queries.countPublishedColorCards(getDb(), categorySlug);
export const listPublicCategories = (): Promise<PublicCategory[]> => queries.listPublicCategories(getDb());
export const getPublicCategory = (slug: string): Promise<PublicCategory | null> => queries.getPublicCategory(getDb(), slug);
export const getPublicProductColor = (slug: string, colorSlug: string): Promise<PublicProductColor | null> => queries.getPublicProductColor(getDb(), slug, colorSlug);
export const getPrimaryColorHref = (slug: string) => queries.getPrimaryColorHref(getDb(), slug);
export const listPublishedColorPaths = (limit = 100) => queries.listPublishedColorPaths(getDb(), limit);
export const listPublicSitemapEntries = () => queries.listPublicSitemapEntries(getDb());

/** Enlace y portada de variantes para mostrar el carrito (la cotización la hace sales). */
export function getCartVariantDisplay(variantIds: readonly string[], db: AnyDatabase = getDb()): Promise<CartVariantDisplay[]> {
  return queries.getCartVariantDisplay(db, variantIds);
}

/** Para ventas: datos y precio vigente de variantes (cotización en servidor). */
export function getQuotableVariants(variantIds: readonly string[], db: AnyDatabase = getDb()): Promise<QuotableVariant[]> {
  return queries.getQuotableVariants(db, variantIds);
}

export function searchQuotableVariants(term: string, limit = 20): Promise<(QuotableVariant & { imageMediaId: string | null })[]> {
  return queries.searchQuotableVariants(getDb(), term, limit);
}
