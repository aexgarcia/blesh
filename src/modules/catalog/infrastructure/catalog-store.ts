import { and, asc, eq, sql } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import { CatalogFailure } from "../application/errors";
import type { CatalogStore, CatalogTx, ColorRow, ImageRow, ProductRow, VariantRow } from "../application/ports";
import type { SizeCode } from "../contracts";
import { categories, productColors, productImages, products, productVariants, sizeGuides } from "./schema";

/** Traduce violaciones de unicidad de PostgreSQL a errores de negocio (red de seguridad bajo concurrencia). */
function mapUniqueViolation(error: unknown): never {
  const cause = (error as { cause?: { code?: string; constraint_name?: string } }).cause ?? (error as { code?: string; constraint_name?: string });
  if (cause?.code === "23505") {
    const constraint = cause.constraint_name ?? "";
    if (constraint.includes("sku")) throw new CatalogFailure("DUPLICATE_SKU", "Ese SKU ya existe en otro producto o talla.", "sku");
    if (constraint.includes("products_slug")) throw new CatalogFailure("DUPLICATE_SLUG", "Ya existe un producto con esa URL.", "slug");
    if (constraint.includes("color_size")) throw new CatalogFailure("DUPLICATE_COMBINATION", "Ese color ya tiene esa talla.", "sizeCode");
    if (constraint.includes("product_colors")) throw new CatalogFailure("DUPLICATE_COLOR", "Ese color ya existe en el producto.", "label");
    if (constraint.includes("media")) throw new CatalogFailure("VALIDATION_ERROR", "Esa imagen ya está asignada.");
  }
  throw error;
}

async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return mapUniqueViolation(error);
  }
}

const productColumns = {
  id: products.id,
  slug: products.slug,
  title: products.title,
  shortDescription: products.shortDescription,
  description: products.description,
  categoryId: products.categoryId,
  sizeGuideId: products.sizeGuideId,
  status: products.status,
  seoTitle: products.seoTitle,
  seoDescription: products.seoDescription,
  publishedAt: products.publishedAt,
  firstPublishedAt: products.firstPublishedAt,
  version: products.version,
  updatedAt: products.updatedAt,
};

function txOperations(db: AnyDatabase): CatalogTx {
  return {
    async lockProduct(id) {
      const [row] = await db.select(productColumns).from(products).where(eq(products.id, id)).for("update");
      return (row as ProductRow) ?? null;
    },
    insertProduct: ({ actorId, ...input }) =>
      guard(async () => {
        const [row] = await db
          .insert(products)
          .values({ ...input, createdBy: actorId, updatedBy: actorId })
          .returning(productColumns);
        return row as ProductRow;
      }),
    updateProduct: (id, patch, actorId, expectedVersion) =>
      guard(async () => {
        const where = expectedVersion === undefined ? eq(products.id, id) : and(eq(products.id, id), eq(products.version, expectedVersion));
        const [row] = await db
          .update(products)
          .set({ ...patch, updatedBy: actorId, version: sql`${products.version} + 1`, updatedAt: sql`now()` })
          .where(where)
          .returning(productColumns);
        return (row as ProductRow) ?? null;
      }),
    async categoryIsActive(id) {
      const [row] = await db.select({ active: categories.active }).from(categories).where(eq(categories.id, id));
      return row?.active ?? false;
    },
    async sizeGuideExists(id) {
      const [row] = await db.select({ id: sizeGuides.id }).from(sizeGuides).where(eq(sizeGuides.id, id));
      return Boolean(row);
    },

    async listColors(productId) {
      return db.select().from(productColors).where(eq(productColors.productId, productId)).orderBy(asc(productColors.position));
    },
    insertColor: (input) => guard(async () => (await db.insert(productColors).values(input).returning())[0] as ColorRow),
    updateColor: (id, patch) => guard(async () => (await db.update(productColors).set(patch).where(eq(productColors.id, id)).returning())[0] as ColorRow),

    async listVariants(productId) {
      const rows = await db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(asc(productVariants.position));
      return rows.map((r) => ({ ...r, sizeCode: r.sizeCode as SizeCode })) as VariantRow[];
    },
    insertVariant: (input) =>
      guard(async () => {
        const [row] = await db.insert(productVariants).values(input).returning();
        return { ...row, sizeCode: row.sizeCode as SizeCode } as VariantRow;
      }),
    updateVariant: (id, patch, expectedVersion) =>
      guard(async () => {
        const [row] = await db
          .update(productVariants)
          .set({ ...patch, version: sql`${productVariants.version} + 1` })
          .where(and(eq(productVariants.id, id), eq(productVariants.version, expectedVersion)))
          .returning();
        return row ? ({ ...row, sizeCode: row.sizeCode as SizeCode } as VariantRow) : null;
      }),

    async listImages(productId) {
      return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.position));
    },
    insertImage: (input) => guard(async () => (await db.insert(productImages).values(input).returning())[0] as ImageRow),
    updateImage: (id, patch) => guard(async () => (await db.update(productImages).set(patch).where(eq(productImages.id, id)).returning())[0] as ImageRow),
    async deleteImage(id) {
      await db.delete(productImages).where(eq(productImages.id, id));
    },

    async audit(entry) {
      await db.insert(auditEvents).values({
        actorType: "admin",
        actorId: entry.actorId,
        action: entry.action,
        resourceType: "product",
        resourceId: entry.productId,
        changes: entry.changes ?? null,
        reason: entry.reason ?? null,
      });
    },
  };
}

export function createCatalogStore(db: AnyDatabase): CatalogStore {
  return {
    withProduct: (fn) => db.transaction((tx) => fn(txOperations(tx as unknown as AnyDatabase))),
  };
}
