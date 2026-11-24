import { MAX_UNIT_PRICE_MINOR } from "../../../shared/domain/money";
import { SIZE_CODES, type PublicationIssue, type SizeCode } from "../contracts";

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/;

export function normalizeSku(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function isSizeCode(value: string): value is SizeCode {
  return (SIZE_CODES as readonly string[]).includes(value);
}

export function sizeOrder(code: string): number {
  const index = (SIZE_CODES as readonly string[]).indexOf(code);
  return index === -1 ? SIZE_CODES.length : index;
}

/** Precio efectivo > 0 y comparativo (si existe) estrictamente mayor. */
export function priceProblem(priceMinor: number, compareAtMinor: number | null): string | null {
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) return "El precio debe ser mayor que 0.";
  if (priceMinor > MAX_UNIT_PRICE_MINOR) return "El precio supera el máximo permitido.";
  if (compareAtMinor !== null && (compareAtMinor <= priceMinor || compareAtMinor > MAX_UNIT_PRICE_MINOR)) {
    return "El precio anterior debe ser mayor que el precio actual.";
  }
  return null;
}

export type ReadinessSnapshot = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryActive: boolean;
  colors: { id: string; label: string; active: boolean; isPrimary: boolean }[];
  variants: { id: string; colorId: string; active: boolean }[];
  images: { colorId: string | null; isCover: boolean; alt: string }[];
  /** Variantes con balance de inventario registrado (lo aporta la composición). */
  variantsWithStockRecord?: ReadonlySet<string>;
};

/**
 * Requisitos de publicación (docs/modelo-de-datos.md): textos, categoría activa, color
 * principal activo, variante activa por color visible, portada con alt por color visible
 * y balance inicial registrado. Stock 0 se permite (se muestra agotado).
 */
export function publicationIssues(p: ReadinessSnapshot): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  if (!p.title.trim()) issues.push({ code: "title", message: "Falta el título." });
  if (!p.shortDescription.trim()) issues.push({ code: "short_description", message: "Falta la descripción corta." });
  if (!p.description.trim()) issues.push({ code: "description", message: "Falta la descripción." });
  if (!p.categoryActive) issues.push({ code: "category", message: "Elige una categoría activa." });

  const activeColors = p.colors.filter((c) => c.active);
  if (activeColors.length === 0) issues.push({ code: "colors", message: "Agrega al menos un color activo." });
  else if (!activeColors.some((c) => c.isPrimary)) issues.push({ code: "primary_color", message: "Marca un color principal activo." });

  for (const color of activeColors) {
    const variants = p.variants.filter((v) => v.colorId === color.id && v.active);
    if (variants.length === 0) issues.push({ code: `variants:${color.id}`, message: `${color.label}: agrega al menos una talla activa.` });
    const cover = p.images.find((i) => i.colorId === color.id && i.isCover);
    if (!cover) issues.push({ code: `cover:${color.id}`, message: `${color.label}: elige una foto de portada.` });
    else if (!cover.alt.trim()) issues.push({ code: `alt:${color.id}`, message: `${color.label}: la portada necesita texto alternativo.` });
    if (p.variantsWithStockRecord) {
      const missing = variants.filter((v) => !p.variantsWithStockRecord!.has(v.id));
      if (missing.length > 0) issues.push({ code: `stock:${color.id}`, message: `${color.label}: registra el stock inicial (puede ser 0).` });
    }
  }
  return issues;
}
