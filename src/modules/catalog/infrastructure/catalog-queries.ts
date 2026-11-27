import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import {
  PUBLIC_PAGE_SIZE_MAX,
  SIZE_CODES,
  type AdminProductListItem,
  type CartVariantDisplay,
  type CategoryOption,
  type ColorCard,
  type ProductStatus,
  type PublicCategory,
  type PublicProductColor,
  type SizeCode,
  type SizeGuideOption,
} from "../contracts";
import { categories, productColors, productImages, products, productVariants, sizeGuideRows, sizeGuides } from "./schema";

export async function listCategoryOptions(db: AnyDatabase): Promise<CategoryOption[]> {
  return db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.position), asc(categories.slug));
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

/** Color activo, con alguna talla activa, de un producto publicado (opcionalmente de una categoría). */
function publicCardWhere(categorySlug?: string) {
  return and(
    eq(products.status, "published"),
    sql`exists (select 1 from ${productVariants} v where v.color_id = ${productColors.id} and v.active)`,
    categorySlug ? eq(categories.slug, categorySlug) : undefined,
  );
}

/** Número de tarjetas públicas (paginación del catálogo: cuenta colores, no productos ni SKU). */
export async function countPublishedColorCards(db: AnyDatabase, categorySlug?: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .innerJoin(productColors, and(eq(productColors.productId, products.id), eq(productColors.active, true)))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(publicCardWhere(categorySlug));
  return total;
}

/** Categorías activas con al menos una tarjeta publicada, en su orden. */
export async function listPublicCategories(db: AnyDatabase): Promise<PublicCategory[]> {
  return db
    .select({ slug: categories.slug, name: categories.name, description: categories.description })
    .from(categories)
    .where(
      and(
        eq(categories.active, true),
        sql`exists (
          select 1 from ${products} p join ${productColors} c on c.product_id = p.id and c.active
          where p.category_id = ${categories.id} and p.status = 'published'
            and exists (select 1 from ${productVariants} v where v.color_id = c.id and v.active))`,
      ),
    )
    .orderBy(asc(categories.position), asc(categories.slug));
}

export async function getPublicCategory(db: AnyDatabase, slug: string): Promise<PublicCategory | null> {
  const [row] = await db
    .select({ slug: categories.slug, name: categories.name, description: categories.description })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.active, true)));
  return row ?? null;
}

const sizeOrder = (code: string) => {
  const index = SIZE_CODES.indexOf(code as SizeCode);
  return index === -1 ? SIZE_CODES.length : index;
};

/** Ficha pública de un color: null si el producto no está publicado o el color no es visible. */
export async function getPublicProductColor(db: AnyDatabase, slug: string, colorSlug: string): Promise<PublicProductColor | null> {
  const [product] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.status, "published")));
  if (!product) return null;
  const [colors, variants, images, category, guide] = await Promise.all([
    db
      .select()
      .from(productColors)
      .where(and(eq(productColors.productId, product.id), eq(productColors.active, true)))
      .orderBy(asc(productColors.position), asc(productColors.id)),
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true))),
    db.select().from(productImages).where(eq(productImages.productId, product.id)).orderBy(asc(productImages.position), asc(productImages.id)),
    product.categoryId
      ? db.select({ slug: categories.slug, name: categories.name }).from(categories).where(and(eq(categories.id, product.categoryId), eq(categories.active, true)))
      : Promise.resolve([]),
    product.sizeGuideId ? db.select().from(sizeGuides).where(eq(sizeGuides.id, product.sizeGuideId)) : Promise.resolve([]),
  ]);
  const visibleColors = colors.filter((c) => variants.some((v) => v.colorId === c.id));
  const color = visibleColors.find((c) => c.slug === colorSlug);
  if (!color) return null;
  const guideRows = guide[0]
    ? await db.select().from(sizeGuideRows).where(eq(sizeGuideRows.guideId, guide[0].id)).orderBy(asc(sizeGuideRows.position))
    : [];
  const covers = new Map(images.filter((i) => i.isCover && i.colorId).map((i) => [i.colorId!, i.mediaId]));

  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    category: category[0] ?? null,
    sizeGuide: guide[0] ? { name: guide[0].name, rows: guideRows.map((r) => ({ sizeCode: r.sizeCode, lengthCm: r.lengthCm, widthCm: r.widthCm })) } : null,
    color: { id: color.id, slug: color.slug, label: color.label, swatchHex: color.swatchHex },
    colors: visibleColors.map((c) => ({
      slug: c.slug,
      label: c.label,
      swatchHex: c.swatchHex,
      href: `/productos/${product.slug}/${c.slug}`,
      current: c.id === color.id,
      coverMediaId: covers.get(c.id) ?? null,
    })),
    variants: variants
      .filter((v) => v.colorId === color.id)
      .sort((a, b) => sizeOrder(a.sizeCode) - sizeOrder(b.sizeCode) || a.position - b.position)
      .map((v) => ({ id: v.id, sku: v.sku, sizeCode: v.sizeCode as SizeCode, priceMinor: v.priceMinor, compareAtMinor: v.compareAtMinor })),
    images: [
      ...images.filter((i) => i.colorId === color.id).sort((a, b) => Number(b.isCover) - Number(a.isCover)),
      ...images.filter((i) => i.colorId === null),
    ].map((i) => ({ mediaId: i.mediaId, alt: i.alt })),
  };
}

/** URL del color principal de un producto publicado (el padre redirige a ella). */
export async function getPrimaryColorHref(db: AnyDatabase, slug: string): Promise<string | null> {
  const [row] = await db
    .select({ colorSlug: productColors.slug })
    .from(products)
    .innerJoin(productColors, and(eq(productColors.productId, products.id), eq(productColors.active, true)))
    .where(and(eq(products.slug, slug), eq(products.status, "published")))
    .orderBy(desc(productColors.isPrimary), asc(productColors.position), asc(productColors.id))
    .limit(1);
  return row ? `/productos/${slug}/${row.colorSlug}` : null;
}

/** Rutas publicadas (prerender inicial de fichas). */
export async function listPublishedColorPaths(db: AnyDatabase, limit: number): Promise<{ slug: string; colorSlug: string }[]> {
  return db
    .select({ slug: products.slug, colorSlug: productColors.slug })
    .from(products)
    .innerJoin(productColors, and(eq(productColors.productId, products.id), eq(productColors.active, true)))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(publicCardWhere())
    .orderBy(desc(products.publishedAt), asc(products.id), asc(productColors.position))
    .limit(limit);
}

/** Sitemap completo, independiente del límite de 100 rutas usadas para prerender inicial. */
export async function listPublicSitemapEntries(db: AnyDatabase) {
  const rows = await db.select({ slug: products.slug, colorSlug: productColors.slug, updatedAt: products.updatedAt })
    .from(products)
    .innerJoin(productColors, and(eq(productColors.productId, products.id), eq(productColors.active, true)))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(publicCardWhere())
    .orderBy(asc(products.id), asc(productColors.id));
  return rows.map((r) => ({ href: `/productos/${r.slug}/${r.colorSlug}`, updatedAt: r.updatedAt.toISOString() }));
}

/** Enlace y portada de variantes para el carrito; `href` null si ya no es visible al público. */
export async function getCartVariantDisplay(db: AnyDatabase, variantIds: readonly string[]): Promise<CartVariantDisplay[]> {
  if (variantIds.length === 0) return [];
  const rows = await db
    .select({
      variantId: productVariants.id,
      colorId: productVariants.colorId,
      productSlug: products.slug,
      colorSlug: productColors.slug,
      visible: sql<boolean>`(${products.status} = 'published' and ${productColors.active})`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColors, eq(productColors.id, productVariants.colorId))
    .where(inArray(productVariants.id, [...variantIds]));
  const colorIds = [...new Set(rows.map((r) => r.colorId))];
  const covers = colorIds.length
    ? await db
        .select({ colorId: productImages.colorId, mediaId: productImages.mediaId, alt: productImages.alt })
        .from(productImages)
        .where(and(inArray(productImages.colorId, colorIds), eq(productImages.isCover, true)))
    : [];
  return rows.map((r) => {
    const cover = covers.find((c) => c.colorId === r.colorId);
    return {
      variantId: r.variantId,
      href: r.visible ? `/productos/${r.productSlug}/${r.colorSlug}` : null,
      coverMediaId: cover?.mediaId ?? null,
      coverAlt: cover?.alt ?? null,
    };
  });
}

/**
 * Tarjetas públicas: una por color activo de producto publicado (no copias del producto).
 * Rango de precio calculado solo con las tallas activas de ese color.
 */
export async function listPublishedColorCards(db: AnyDatabase, filter: { categorySlug?: string; productSlugs?: readonly string[]; limit: number; offset?: number }): Promise<ColorCard[]> {
  const rows = await db
    .select({
      productId: products.id,
      sizeGuideId: products.sizeGuideId,
      productSlug: products.slug,
      title: products.title,
      publishedAt: products.publishedAt,
      categorySlug: categories.slug,
      colorId: productColors.id,
      colorSlug: productColors.slug,
      colorLabel: productColors.label,
      swatchHex: productColors.swatchHex,
      colorPosition: productColors.position,
    })
    .from(products)
    .innerJoin(productColors, and(eq(productColors.productId, products.id), eq(productColors.active, true)))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(publicCardWhere(filter.categorySlug), filter.productSlugs ? inArray(products.slug, [...filter.productSlugs]) : undefined))
    .orderBy(desc(products.publishedAt), asc(products.id), asc(productColors.position), asc(productColors.id))
    .limit(Math.min(filter.limit, PUBLIC_PAGE_SIZE_MAX))
    .offset(Math.max(0, filter.offset ?? 0));

  const colorIds = rows.map((r) => r.colorId);
  if (colorIds.length === 0) return [];
  const [variants, covers] = await Promise.all([
    db
      .select({ id: productVariants.id, sku: productVariants.sku, colorId: productVariants.colorId, sizeCode: productVariants.sizeCode, price: productVariants.priceMinor, compareAt: productVariants.compareAtMinor })
      .from(productVariants)
      .where(and(inArray(productVariants.colorId, colorIds), eq(productVariants.active, true))),
    db
      .select({ colorId: productImages.colorId, mediaId: productImages.mediaId, alt: productImages.alt, isCover: productImages.isCover })
      .from(productImages)
      .where(inArray(productImages.colorId, colorIds))
      .orderBy(desc(productImages.isCover), asc(productImages.position), asc(productImages.id)),
  ]);

  return rows.flatMap((r) => {
    const own = variants.filter((v) => v.colorId === r.colorId).sort((a, b) => sizeOrder(a.sizeCode) - sizeOrder(b.sizeCode));
    if (own.length === 0) return [];
    const prices = own.map((v) => v.price);
    const images = covers.filter((c) => c.colorId === r.colorId);
    const cover = images.find((c) => c.isCover) ?? images[0];
    const second = images.find((c) => c !== cover);
    const compare = own.map((v) => v.compareAt).filter((c): c is number => c !== null);
    return [
      {
        productId: r.productId,
        sizeGuideId: r.sizeGuideId,
        colorId: r.colorId,
        href: `/productos/${r.productSlug}/${r.colorSlug}`,
        title: r.title,
        colorLabel: r.colorLabel,
        coverMediaId: cover?.mediaId ?? null,
        coverAlt: cover?.alt ?? null,
        secondMediaId: second?.mediaId ?? null,
        swatchHex: r.swatchHex,
        productSlug: r.productSlug,
        variants: own.map((v) => ({ id: v.id, sku: v.sku, sizeCode: v.sizeCode as SizeCode, priceMinor: v.price })),
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
  productSlug: products.slug,
  variantId: productVariants.id,
  sku: productVariants.sku,
  productTitle: products.title,
  colorLabel: productColors.label,
  sizeCode: productVariants.sizeCode,
  priceMinor: productVariants.priceMinor,
  categorySlug: categories.slug,
  sellable: sql<boolean>`(${products.status} = 'published' and ${productColors.active} and ${productVariants.active})`,
};

export async function listStorefrontProductOptions(db: AnyDatabase) {
  return db.select({ slug: products.slug, title: products.title, status: products.status }).from(products).orderBy(asc(products.title));
}

/** Precios y datos vigentes de variantes: la autoridad de precio para cotizar pedidos. */
export async function getQuotableVariants(db: AnyDatabase, variantIds: readonly string[]) {
  if (variantIds.length === 0) return [];
  const rows = await db
    .select(quotableColumns)
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColors, eq(productColors.id, productVariants.colorId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(productVariants.id, [...variantIds]));
  return rows.map((r) => ({ ...r, sizeCode: r.sizeCode as SizeCode }));
}

/** Búsqueda de variantes vendibles por título o SKU (alta de pedidos manuales). */
export async function searchQuotableVariants(db: AnyDatabase, term: string, limit: number) {
  const text = term.trim().slice(0, 80);
  if (!text) return [];
  const pattern = `%${text.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select({
      ...quotableColumns,
      // Foto del color (portada primero) o, si no tiene, la foto común del producto.
      imageMediaId: sql<string | null>`(select pi.media_id from ${productImages} pi where pi.product_id = ${products.id} and (pi.color_id = ${productColors.id} or pi.color_id is null) order by (pi.color_id is null), pi.is_cover desc, pi.position limit 1)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColors, eq(productColors.id, productVariants.colorId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
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
