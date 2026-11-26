/** Tipos públicos del módulo catalog (DTOs sin runtime de servidor). */

export type ProductStatus = "draft" | "published" | "archived";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

/** Tallas admitidas en orden de presentación. `UNICA` para prendas sin talla. */
export const SIZE_CODES = ["XS", "S", "M", "L", "XL", "XXL", "UNICA"] as const;
export type SizeCode = (typeof SIZE_CODES)[number];
export const SIZE_LABELS: Record<SizeCode, string> = { XS: "XS", S: "S", M: "M", L: "L", XL: "XL", XXL: "XXL", UNICA: "Única" };

export type CatalogErrorCode =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_SKU"
  | "DUPLICATE_COLOR"
  | "DUPLICATE_COMBINATION"
  | "SLUG_LOCKED"
  | "NOT_PUBLISHABLE"
  | "INVALID_TRANSITION";

export type CategoryOption = { id: string; slug: string; name: string };
export type AdminCategory = CategoryOption & { description: string | null; position: number; active: boolean; version: number; productCount: number; publishedCount: number };
export type SizeGuideOption = { id: string; name: string; rows: { sizeCode: string; lengthCm: string; widthCm: string }[] };
export type AdminSizeGuide = SizeGuideOption & { code: string; version: number; products: { id: string; title: string; status: string }[] };
export type SizeGuideListItem = SizeGuideOption & { version: number; productCount: number };
export type SizeGuideData = Pick<SizeGuideOption, "name" | "rows">;
export type ProductSizeGuide = { productSlug: string; productTitle: string; guide: SizeGuideData | null; availableSizes: string[] };
/** Comunicación local de la guía con selectores de talla; nunca se envía a Analytics. */
export const SIZE_SELECTION_EVENT = "blesh:size-selected";
export type SizeSelection = { productSlug: string; sizeCode: string };

export type PublicationIssue = { code: string; message: string };

export type AdminVariant = {
  id: string;
  colorId: string;
  sku: string;
  sizeCode: SizeCode;
  priceMinor: number;
  compareAtMinor: number | null;
  active: boolean;
  version: number;
};

export type AdminColor = {
  id: string;
  colorCode: string;
  label: string;
  slug: string;
  swatchHex: string | null;
  active: boolean;
  isPrimary: boolean;
  position: number;
};

export type AdminImage = {
  id: string;
  mediaId: string;
  colorId: string | null;
  alt: string;
  position: number;
  isCover: boolean;
  url: string | null;
  width: number | null;
  height: number | null;
};

export type AdminProduct = {
  id: string;
  slug: string;
  slugLocked: boolean;
  title: string;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  sizeGuideId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: ProductStatus;
  publishedAt: string | null;
  version: number;
  updatedAt: string;
  colors: AdminColor[];
  variants: AdminVariant[];
  images: AdminImage[];
};

export type AdminProductListItem = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  categoryName: string | null;
  colorCount: number;
  variantCount: number;
  coverMediaId: string | null;
  variantIds: string[];
  updatedAt: string;
};

/** Tarjeta pública: una por (producto, color) publicado. */
export type ColorCard = {
  sizeGuideId: string | null;
  productId: string;
  colorId: string;
  href: string;
  title: string;
  colorLabel: string;
  coverMediaId: string | null;
  coverAlt: string | null;
  /** Segunda foto del color (se muestra al pasar el cursor). */
  secondMediaId: string | null;
  swatchHex: string | null;
  productSlug: string;
  /** Tallas activas en orden (para «agregar rápido»). */
  variants: { id: string; sku: string; sizeCode: SizeCode; priceMinor: number }[];
  minPriceMinor: number;
  maxPriceMinor: number;
  compareAtMinor: number | null;
  variantIds: string[];
  categorySlug: string | null;
};

/** Tamaño máximo de página del catálogo público (contrato ListProducts). */
export const PUBLIC_PAGE_SIZE_MAX = 48;

/** Categoría activa con al menos una tarjeta publicada. */
export type PublicCategory = { slug: string; name: string; description: string | null };

/** Solo URLs de colores públicos con tallas activas; sin snapshots privados. */
export type PublicSitemapEntry = { href: string; updatedAt: string };

/** Ficha pública de un color publicado (GetProductColor). Sin stock: lo añade la composición. */
export type PublicProductColor = {
  productId: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { slug: string; name: string } | null;
  sizeGuide: { name: string; rows: { sizeCode: string; lengthCm: string; widthCm: string }[] } | null;
  color: { id: string; slug: string; label: string; swatchHex: string | null };
  /** Colores activos del producto (incluido el actual), en orden. */
  colors: { slug: string; label: string; swatchHex: string | null; href: string; current: boolean; coverMediaId: string | null }[];
  /** Tallas activas de este color, en orden de talla. */
  variants: { id: string; sku: string; sizeCode: SizeCode; priceMinor: number; compareAtMinor: number | null }[];
  /** Fotos del color y, después, las comunes al producto. */
  images: { mediaId: string; alt: string }[];
};

/** Datos de visualización de una variante en el carrito. `href` solo si es visible al público. */
export type CartVariantDisplay = { variantId: string; href: string | null; coverMediaId: string | null; coverAlt: string | null };

/** Variante para cotizar un pedido. `sellable`: producto publicado, color y talla activos. */
export type QuotableVariant = {
  productSlug?: string;
  variantId: string;
  sku: string;
  productTitle: string;
  colorLabel: string;
  sizeCode: SizeCode;
  priceMinor: number;
  /** Para políticas de pack por categoría (sales). */
  categorySlug: string | null;
  sellable: boolean;
};
