import type { ProductStatus, SizeCode } from "../contracts";

export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  sizeGuideId: string | null;
  status: ProductStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
  version: number;
  updatedAt: Date;
};

export type ColorRow = {
  id: string;
  productId: string;
  colorCode: string;
  label: string;
  slug: string;
  swatchHex: string | null;
  active: boolean;
  isPrimary: boolean;
  position: number;
};

export type VariantRow = {
  id: string;
  productId: string;
  colorId: string;
  sku: string;
  sizeCode: SizeCode;
  priceMinor: number;
  compareAtMinor: number | null;
  active: boolean;
  position: number;
  version: number;
};

export type ImageRow = {
  id: string;
  productId: string;
  colorId: string | null;
  mediaId: string;
  alt: string;
  position: number;
  isCover: boolean;
};

export type ProductPatch = Partial<
  Pick<ProductRow, "slug" | "title" | "shortDescription" | "description" | "categoryId" | "sizeGuideId" | "status" | "seoTitle" | "seoDescription" | "publishedAt" | "firstPublishedAt">
>;

export type CatalogAudit = { actorId: string; action: string; productId: string; changes?: Record<string, unknown>; reason?: string | null };

/** Operaciones dentro de una transacción con el producto bloqueado (FOR UPDATE). */
export interface CatalogTx {
  lockProduct(id: string): Promise<ProductRow | null>;
  insertProduct(input: Omit<ProductRow, "id" | "version" | "updatedAt" | "publishedAt" | "firstPublishedAt" | "status"> & { actorId: string }): Promise<ProductRow>;
  /** Incrementa versión; `expectedVersion` opcional para concurrencia optimista. */
  updateProduct(id: string, patch: ProductPatch, actorId: string, expectedVersion?: number): Promise<ProductRow | null>;
  categoryIsActive(id: string): Promise<boolean>;
  sizeGuideExists(id: string): Promise<boolean>;

  listColors(productId: string): Promise<ColorRow[]>;
  insertColor(input: Omit<ColorRow, "id">): Promise<ColorRow>;
  updateColor(id: string, patch: Partial<Omit<ColorRow, "id" | "productId">>): Promise<ColorRow>;

  listVariants(productId: string): Promise<VariantRow[]>;
  insertVariant(input: Omit<VariantRow, "id" | "version">): Promise<VariantRow>;
  updateVariant(id: string, patch: Partial<Pick<VariantRow, "sku" | "priceMinor" | "compareAtMinor" | "active">>, expectedVersion: number): Promise<VariantRow | null>;

  listImages(productId: string): Promise<ImageRow[]>;
  insertImage(input: Omit<ImageRow, "id">): Promise<ImageRow>;
  updateImage(id: string, patch: Partial<Pick<ImageRow, "alt" | "colorId" | "position" | "isCover">>): Promise<ImageRow>;
  deleteImage(id: string): Promise<void>;

  audit(entry: CatalogAudit): Promise<void>;
}

export interface CatalogStore {
  withProduct<T>(fn: (tx: CatalogTx) => Promise<T>): Promise<T>;
}

/** Comprueba la capacidad del actor (lo implementa identity mediante la composición). */
export type Authorize = (actor: CatalogActor, capability: "catalog.manage") => boolean;
export type CatalogActor = { membershipId: string; role: "owner" | "operator" };

export type CatalogDeps = {
  store: CatalogStore;
  authorize: Authorize;
  clock: { now: () => Date };
};
