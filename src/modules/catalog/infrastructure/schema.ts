import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";
import { mediaAssets } from "../../media/infrastructure/schema";

/** Categorías administrables; el slug se conserva para mantener enlaces estables. */
export const categories = appSchema.table(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    position: integer().notNull().default(0),
    active: boolean().notNull().default(true),
    version: integer().notNull().default(1),
    creationKey: uuid(),
    creationFingerprint: text(),
    lastOperationKey: uuid(),
    lastFingerprint: text(),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug), uniqueIndex("categories_creation_key").on(t.creationKey), uniqueIndex("categories_operation_key").on(t.lastOperationKey)],
);

export const sizeGuides = appSchema.table(
  "size_guides",
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    name: text().notNull(),
    version: integer().notNull().default(1),
    lastOperationKey: uuid(),
    lastFingerprint: text(),
    creationKey: uuid(),
    creationFingerprint: text(),
  },
  (t) => [uniqueIndex("size_guides_code_key").on(t.code), uniqueIndex("size_guides_operation_key").on(t.lastOperationKey), uniqueIndex("size_guides_creation_key").on(t.creationKey)],
);

export const sizeGuideRows = appSchema.table(
  "size_guide_rows",
  {
    guideId: uuid().notNull().references(() => sizeGuides.id, { onDelete: "cascade" }),
    sizeCode: text().notNull(),
    lengthCm: numeric({ precision: 5, scale: 1 }).notNull(),
    widthCm: numeric({ precision: 5, scale: 1 }).notNull(),
    position: integer().notNull(),
  },
  (t) => [unique("size_guide_rows_guide_size_key").on(t.guideId, t.sizeCode)],
);

export const products = appSchema.table(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    title: text().notNull(),
    shortDescription: text().notNull().default(""),
    description: text().notNull().default(""),
    categoryId: uuid().references(() => categories.id, { onDelete: "restrict" }),
    sizeGuideId: uuid().references(() => sizeGuides.id, { onDelete: "restrict" }),
    status: text().$type<"draft" | "published" | "archived">().notNull().default("draft"),
    seoTitle: text(),
    seoDescription: text(),
    publishedAt: timestamp({ withTimezone: true }),
    /** Fija los slugs: tras la primera publicación no se cambian (URLs estables). */
    firstPublishedAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(1),
    createdBy: uuid().notNull(),
    updatedBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    index("products_listing_idx").on(t.status, t.categoryId, t.publishedAt, t.id),
    check("products_status_check", sql`${t.status} in ('draft', 'published', 'archived')`),
    check("products_title_check", sql`char_length(${t.title}) between 1 and 160`),
    check("products_short_description_check", sql`char_length(${t.shortDescription}) <= 300`),
    check("products_description_check", sql`char_length(${t.description}) <= 5000`),
    check("products_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("products_published_check", sql`${t.status} <> 'published' or (${t.publishedAt} is not null and ${t.categoryId} is not null)`),
  ],
);

export const productColors = appSchema.table(
  "product_colors",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    colorCode: text().notNull(),
    label: text().notNull(),
    slug: text().notNull(),
    swatchHex: text(),
    active: boolean().notNull().default(true),
    position: integer().notNull().default(0),
    isPrimary: boolean().notNull().default(false),
  },
  (t) => [
    // Destino de FKs compuestas: garantiza que variante/imagen y color son del mismo producto.
    unique("product_colors_id_product_key").on(t.id, t.productId),
    unique("product_colors_product_code_key").on(t.productId, t.colorCode),
    unique("product_colors_product_slug_key").on(t.productId, t.slug),
    uniqueIndex("product_colors_one_primary_idx").on(t.productId).where(sql`${t.isPrimary}`),
    check("product_colors_label_check", sql`char_length(${t.label}) between 1 and 40`),
    check("product_colors_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("product_colors_code_check", sql`${t.colorCode} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("product_colors_swatch_check", sql`${t.swatchHex} is null or ${t.swatchHex} ~ '^#[0-9a-f]{6}$'`),
    check("product_colors_primary_active_check", sql`not ${t.isPrimary} or ${t.active}`),
  ],
);

export const productVariants = appSchema.table(
  "product_variants",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid().notNull(),
    colorId: uuid().notNull(),
    sku: text().notNull(),
    sizeCode: text().notNull(),
    priceMinor: integer().notNull(),
    compareAtMinor: integer(),
    currency: text().notNull().default("PEN"),
    active: boolean().notNull().default(true),
    position: integer().notNull().default(0),
    version: integer().notNull().default(1),
  },
  (t) => [
    foreignKey({ name: "product_variants_color_fk", columns: [t.colorId, t.productId], foreignColumns: [productColors.id, productColors.productId] }).onDelete("restrict"),
    uniqueIndex("product_variants_sku_key").on(t.sku),
    unique("product_variants_color_size_key").on(t.colorId, t.sizeCode),
    index("product_variants_product_idx").on(t.productId),
    check("product_variants_sku_check", sql`${t.sku} ~ '^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$'`),
    check("product_variants_price_check", sql`${t.priceMinor} > 0 and ${t.priceMinor} <= 10000000`),
    check("product_variants_compare_check", sql`${t.compareAtMinor} is null or (${t.compareAtMinor} > ${t.priceMinor} and ${t.compareAtMinor} <= 10000000)`),
    check("product_variants_currency_check", sql`${t.currency} = 'PEN'`),
  ],
);

export const productImages = appSchema.table(
  "product_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid().notNull(),
    /** null = foto común a todos los colores (explícito, no un fallback). */
    colorId: uuid(),
    mediaId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    alt: text().notNull(),
    position: integer().notNull().default(0),
    isCover: boolean().notNull().default(false),
  },
  (t) => [
    foreignKey({ name: "product_images_color_fk", columns: [t.colorId, t.productId], foreignColumns: [productColors.id, productColors.productId] }).onDelete("restrict"),
    foreignKey({ name: "product_images_product_fk", columns: [t.productId], foreignColumns: [products.id] }).onDelete("restrict"),
    uniqueIndex("product_images_media_key").on(t.mediaId),
    // Una portada por color (y una para las fotos comunes).
    uniqueIndex("product_images_one_cover_idx")
      .on(t.productId, sql`coalesce(${t.colorId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where(sql`${t.isCover}`),
    index("product_images_product_idx").on(t.productId, t.colorId, t.position),
    check("product_images_alt_check", sql`char_length(${t.alt}) between 1 and 200`),
  ],
);
