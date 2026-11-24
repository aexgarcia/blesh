import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { AdminProductListItem, CategoryOption, ColorCard, ProductStatus, SizeCode, SizeGuideOption } from "../contracts";
import { categories, productColors, productImages, products, productVariants, sizeGuideRows, sizeGuides } from "./schema";

export async function listCategoryOptions(db: AnyDatabase): Promise<CategoryOption[]> {
  return db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.position));
}

export async function listSizeGuideOptions(db: AnyDatabase): Promise<SizeGuideOption[]> {
  const guides = await db.select().from(sizeGuides).orderBy(asc(sizeGuides.name));
  const rows = await db.select().from(sizeGuideRows).orderBy(asc(sizeGuideRows.position));
  return guides.map((g) => ({
    id: g.id,
    name: g.name,
    rows: rows.filter((r) => r.guideId === g.id).map((r) => ({ sizeCode: r.sizeCode, lengthCm: r.lengthCm, widthCm: r.widthCm })),
  }));
}

export type AdminListFilter = { search?: string; status?: ProductStatus; categoryId?: string; page: number; pageSize: number };

/** Listado administrativo con búsqueda por título o SKU, filtros y paginación estable. */
export async function listAdminProducts(db: AnyDatabase, filter: AdminListFilter): Promise<{ items: AdminProductListItem[]; total: number }> {
  const conditions = [];
  if (filter.status) conditions.push(eq(products.status, filter.status));
  if (filter.categoryId) conditions.push(eq(products.categoryId, filter.categoryId));
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(products.title, term),
        sql`exists (select 1 from ${productVariants} v where v.product_id = ${products.id} and v.sku ilike ${term})`,
      ),
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(products).where(where);
  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
      categoryName: categories.name,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(desc(products.updatedAt), desc(products.id))
    .limit(filter.pageSize)
    .offset((filter.page - 1) * filter.pageSize);

  const ids = rows.map((r) => r.id);
  const [colors, variants, covers] = ids.length
    ? await Promise.all([
        db.select({ productId: productColors.productId }).from(productColors).where(inArray(productColors.productId, ids)),
        db.select({ productId: productVariants.productId, id: productVariants.id }).from(productVariants).where(inArray(productVariants.productId, ids)),
        db
          .select({ productId: productImages.productId, mediaId: productImages.mediaId, colorId: productImages.colorId, isPrimary: productColors.isPrimary })
          .from(productImages)
          .leftJoin(productColors, eq(productColors.id, productImages.colorId))
          .where(and(inArray(productImages.productId, ids), eq(productImages.isCover, true))),
      ])
    : [[], [], []];

  return {
    total,
    items: rows.map((r) => {
      const productCovers = covers.filter((c) => c.productId === r.id);
      const cover = productCovers.find((c) => c.isPrimary) ?? productCovers[0];
      return {
        ...r,
        updatedAt: r.updatedAt.toISOString(),
        colorCount: colors.filter((c) => c.productId === r.id).length,
        variantCount: variants.filter((v) => v.productId === r.id).length,
        variantIds: variants.filter((v) => v.productId === r.id).map((v) => v.id),
        coverMediaId: cover?.mediaId ?? null,
      };
    }),
  };
}

export async function getProductForEditor(db: AnyDatabase, id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const [colors, variants, images] = await Promise.all([
    db.select().from(productColors).where(eq(productColors.productId, id)).orderBy(asc(productColors.position)),
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.position)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
  ]);
  return { product, colors, variants: variants.map((v) => ({ ...v, sizeCode: v.sizeCode as SizeCode })), images };
}

/**
 * Tarjetas públicas: una por color activo de producto publicado (no copias del producto).
 * Rango de precio calculado solo con las tallas activas de ese color.
 */
export async function listPublishedColorCards(db: AnyDatabase, filter: { categorySlug?: string; limit: number }): Promise<ColorCard[]> {
  const rows = await db
    .select({
      productId: products.id,
      productSlug: products.slug,
      title: products.title,
      publishedAt: products.publishedAt,
      categorySlug: categories.slug,
      colorId: productColors.id,
      colorSlug: productColors.slug,
      colorLabel: productColors.label,
      colorPosition: productColors.position,
    })
    .from(products)
    .innerJoin(productColors, and(eq(productColors.productId, products.id), eq(productColors.active, true)))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.status, "published"), filter.categorySlug ? eq(categories.slug, filter.categorySlug) : undefined))
    .orderBy(desc(products.publishedAt), asc(products.id), asc(productColors.position))
    .limit(Math.min(filter.limit, 48));

  const colorIds = rows.map((r) => r.colorId);
  if (colorIds.length === 0) return [];
  const [variants, covers] = await Promise.all([
    db
      .select({ id: productVariants.id, colorId: productVariants.colorId, price: productVariants.priceMinor, compareAt: productVariants.compareAtMinor })
      .from(productVariants)
      .where(and(inArray(productVariants.colorId, colorIds), eq(productVariants.active, true))),
    db
      .select({ colorId: productImages.colorId, mediaId: productImages.mediaId, alt: productImages.alt })
      .from(productImages)
      .where(and(inArray(productImages.colorId, colorIds), eq(productImages.isCover, true))),
  ]);

  return rows.flatMap((r) => {
    const own = variants.filter((v) => v.colorId === r.colorId);
    if (own.length === 0) return [];
    const prices = own.map((v) => v.price);
    const cover = covers.find((c) => c.colorId === r.colorId);
    const compare = own.map((v) => v.compareAt).filter((c): c is number => c !== null);
    return [
      {
        productId: r.productId,
        colorId: r.colorId,
        href: `/productos/${r.productSlug}/${r.colorSlug}`,
        title: r.title,
        colorLabel: r.colorLabel,
        coverMediaId: cover?.mediaId ?? null,
        coverAlt: cover?.alt ?? null,
        minPriceMinor: Math.min(...prices),
        maxPriceMinor: Math.max(...prices),
        compareAtMinor: compare.length ? Math.max(...compare) : null,
        variantIds: own.map((v) => v.id),
        categorySlug: r.categorySlug,
      },
    ];
  });
}

const quotableColumns = {
  variantId: productVariants.id,
  sku: productVariants.sku,
  productTitle: products.title,
  colorLabel: productColors.label,
  sizeCode: productVariants.sizeCode,
  priceMinor: productVariants.priceMinor,
  sellable: sql<boolean>`(${products.status} = 'published' and ${productColors.active} and ${productVariants.active})`,
};

/** Precios y datos vigentes de variantes: la autoridad de precio para cotizar pedidos. */
export async function getQuotableVariants(db: AnyDatabase, variantIds: readonly string[]) {
  if (variantIds.length === 0) return [];
  const rows = await db
    .select(quotableColumns)
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColors, eq(productColors.id, productVariants.colorId))
    .where(inArray(productVariants.id, [...variantIds]));
  return rows.map((r) => ({ ...r, sizeCode: r.sizeCode as SizeCode }));
}

/** Búsqueda de variantes vendibles por título o SKU (alta de pedidos manuales). */
export async function searchQuotableVariants(db: AnyDatabase, term: string, limit: number) {
  const text = term.trim().slice(0, 80);
  if (!text) return [];
  const pattern = `%${text.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select(quotableColumns)
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColors, eq(productColors.id, productVariants.colorId))
    .where(
      and(
        eq(products.status, "published"),
        eq(productColors.active, true),
        eq(productVariants.active, true),
        or(ilike(products.title, pattern), ilike(productVariants.sku, pattern), ilike(productColors.label, pattern)),
      ),
    )
    .orderBy(asc(products.title), asc(productColors.position), asc(productVariants.position))
    .limit(limit);
  return rows.map((r) => ({ ...r, sizeCode: r.sizeCode as SizeCode }));
}
