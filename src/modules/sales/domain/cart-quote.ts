/**
 * Cotización del carrito público (QuoteCart): compara lo que la persona pidió y vio con el
 * catálogo vigente y la disponibilidad orientativa. Puro y sin I/O.
 */
import { MAX_ORDER_TOTAL_MINOR } from "../../../shared/domain/money";
import { MAX_ORDER_LINES, MAX_UNITS_PER_LINE } from "../contracts";
import { computePromotions, NO_PROMOTION, PACK_POLICIES, type PackPolicy, type PromotionResult } from "./promotions";

export type QuoteRequestLine = {
  variantId: string;
  quantity: number;
  /** Precio que la persona vio/aceptó; si difiere del vigente, debe aceptar el nuevo. */
  seenPriceMinor?: number | null;
};

export type PricedVariant = {
  productSlug?: string;
  variantId: string;
  sku: string;
  productTitle: string;
  colorLabel: string;
  sizeCode: string;
  priceMinor: number;
  categorySlug?: string | null;
  sellable: boolean;
};

/** `unavailable`: despublicada, inactiva o inexistente; `sold_out`: sin unidades hoy. */
export type QuoteLineStatus = "ok" | "unavailable" | "sold_out" | "insufficient";

export type EvaluatedLine = {
  variantId: string;
  quantity: number;
  status: QuoteLineStatus;
  /** Solo si faltan unidades: cuántas se pueden pedir hoy (orientativo, máx. 10). */
  maxQuantity: number | null;
  /** Precio anterior si cambió respecto de lo visto. */
  previousPriceMinor: number | null;
  variant: PricedVariant | null;
  lineTotalMinor: number;
};

export type EvaluatedQuote = {
  packPolicy?: PackPolicy | null;
  lines: EvaluatedLine[];
  /** Solo líneas vendibles. */
  subtotalMinor: number;
  /** Packs aplicados sobre las líneas vendibles (servidor). */
  promotion: PromotionResult;
  /** Subtotal − packs (envío por acordar). */
  totalMinor: number;
  units: number;
  /** Todas las líneas vendibles, con unidades y sin precios por aceptar. */
  ready: boolean;
};

export type QuoteProblem = { code: "VALIDATION_ERROR"; message: string };

/**
 * Une variantes repetidas (conserva el primer precio visto) y aplica los límites antes de
 * consultar nada. Un carrito manipulado se rechaza; nunca se recorta en silencio.
 */
export function normalizeQuoteLines(lines: readonly QuoteRequestLine[]): QuoteRequestLine[] | QuoteProblem {
  if (lines.length === 0) return { code: "VALIDATION_ERROR", message: "Tu carrito está vacío." };
  const merged = new Map<string, QuoteRequestLine>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) return { code: "VALIDATION_ERROR", message: "Las cantidades deben ser números enteros positivos." };
    const previous = merged.get(line.variantId);
    merged.set(line.variantId, {
      variantId: line.variantId,
      quantity: (previous?.quantity ?? 0) + line.quantity,
      seenPriceMinor: previous?.seenPriceMinor ?? line.seenPriceMinor ?? null,
    });
  }
  if (merged.size > MAX_ORDER_LINES) return { code: "VALIDATION_ERROR", message: `Máximo ${MAX_ORDER_LINES} productos distintos por solicitud.` };
  for (const line of merged.values()) {
    if (line.quantity > MAX_UNITS_PER_LINE) return { code: "VALIDATION_ERROR", message: `Máximo ${MAX_UNITS_PER_LINE} unidades por talla.` };
  }
  return [...merged.values()];
}

/**
 * Evalúa cada línea: no vendible (despublicada, inactiva o inexistente), sin unidades
 * suficientes (disponibilidad orientativa: la reserva ocurre al confirmar) o con precio
 * distinto del visto. El subtotal usa precios del servidor.
 */
export function evaluateQuote(
  lines: readonly QuoteRequestLine[],
  variants: ReadonlyMap<string, PricedVariant>,
  available: ReadonlyMap<string, number>,
  policies: readonly PackPolicy[] = PACK_POLICIES,
): EvaluatedQuote {
  const evaluated = lines.map((line): EvaluatedLine => {
    const variant = variants.get(line.variantId) ?? null;
    if (!variant || !variant.sellable) {
      return { variantId: line.variantId, quantity: line.quantity, status: "unavailable", maxQuantity: null, previousPriceMinor: null, variant, lineTotalMinor: 0 };
    }
    const units = Math.max(0, available.get(line.variantId) ?? 0);
    const previousPriceMinor = line.seenPriceMinor != null && line.seenPriceMinor !== variant.priceMinor ? line.seenPriceMinor : null;
    if (units === 0) {
      return { variantId: line.variantId, quantity: line.quantity, status: "sold_out", maxQuantity: 0, previousPriceMinor, variant, lineTotalMinor: 0 };
    }
    const insufficient = units < line.quantity;
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      status: insufficient ? "insufficient" : "ok",
      maxQuantity: insufficient ? Math.min(units, MAX_UNITS_PER_LINE) : null,
      previousPriceMinor,
      variant,
      lineTotalMinor: variant.priceMinor * line.quantity,
    };
  });
  const sellable = evaluated.filter((l) => l.status === "ok" || l.status === "insufficient");
  const subtotalMinor = sellable.reduce((sum, l) => sum + l.lineTotalMinor, 0);
  const promotion = sellable.length
    ? computePromotions(sellable.map((l) => ({ productSlug: l.variant!.productSlug, categorySlug: l.variant!.categorySlug ?? null, unitPriceMinor: l.variant!.priceMinor, quantity: l.quantity })), policies)
    : NO_PROMOTION;
  const ready =
    evaluated.length > 0 &&
    evaluated.every((l) => l.status === "ok" && l.previousPriceMinor === null) &&
    subtotalMinor > 0 &&
    subtotalMinor <= MAX_ORDER_TOTAL_MINOR;
  return {
    packPolicy: policies[0] ?? null,
    lines: evaluated,
    subtotalMinor,
    promotion,
    totalMinor: subtotalMinor - promotion.discountMinor,
    units: sellable.reduce((sum, l) => sum + l.quantity, 0),
    ready,
  };
}
