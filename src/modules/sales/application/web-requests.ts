/**
 * Tienda pública: QuoteCart y CreateOrderRequest web (SDD 5.1). Sin actor: la entrada llega
 * del navegador y se valida aquí; precios, publicación y disponibilidad salen del servidor.
 * Registrar una solicitud no reserva stock.
 */
import { evaluateQuote, normalizeQuoteLines, type EvaluatedQuote, type PricedVariant, type QuoteRequestLine } from "../domain/cart-quote";
import { PACK_POLICIES, promotionLabelFromCode } from "../domain/promotions";
import { buildWhatsAppMessage, couponFromNote, couponNote } from "../domain/whatsapp-message";
import { REQUEST_TERMS, type DeliveryMode } from "../contracts";
import { createOrderRequest } from "./order-commands";
import type { SalesDeps } from "./ports";

export type WebSalesDeps = SalesDeps & {
  /** Unidades disponibles por variante (orientativo: la reserva ocurre al confirmar). */
  availability: (variantIds: readonly string[]) => Promise<Map<string, number>>;
};

export type QuoteResult = { ok: true; quote: EvaluatedQuote } | { ok: false; code: "VALIDATION_ERROR"; message: string };

export async function quoteCart(deps: WebSalesDeps, requested: readonly QuoteRequestLine[]): Promise<QuoteResult> {
  const lines = normalizeQuoteLines(requested);
  if (!Array.isArray(lines)) return { ok: false, code: lines.code, message: lines.message };
  const ids = lines.map((l) => l.variantId);
  const [priced, available] = await Promise.all([deps.quote(ids), deps.availability(ids)]);
  const variants = new Map<string, PricedVariant>(priced.map((v) => [v.variantId, v]));
  const policies = deps.packPolicies ? await deps.packPolicies() : PACK_POLICIES;
  return { ok: true, quote: evaluateQuote(lines, variants, available, policies) };
}

export type WebRequestInput = {
  /** Líneas con el precio unitario que la persona aceptó al revisar el carrito. */
  lines: { variantId: string; quantity: number; acceptedPriceMinor: number }[];
  /** Total provisional aceptado (incluye packs): si la política cambió, se pide aceptar de nuevo. */
  acceptedTotalMinor: number;
  customerName: string;
  /** Ya no se pide en la tienda: la conversación sigue por WhatsApp. */
  customerPhone?: string | null;
  deliveryPreference: DeliveryMode;
  termsVersion: string;
  acceptedTerms: boolean;
  /** UUID por intención, conservado en el navegador para reintentar. */
  creationKey: string;
  /** Cupón ya validado contra la configuración vigente (o null). */
  couponCode?: string | null;
};

export type WebRequestRecord = {
  reference: string;
  message: string;
  subtotalMinor: number;
  /** Subtotal − packs (envío por acordar). */
  totalMinor: number;
  units: number;
};

export type WebRequestResult =
  | { ok: true; request: WebRequestRecord; replayed: boolean }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "QUOTE_CHANGED" | "TERMS_OUTDATED" | "RATE_LIMITED" | "IDEMPOTENCY_CONFLICT" | "PRODUCT_UNAVAILABLE" | "FORBIDDEN" | "NOT_FOUND" | string;
      message: string;
      field?: string;
      /** Con QUOTE_CHANGED: la cotización vigente para volver a aceptar. */
      quote?: EvaluatedQuote;
    };

export type WebRequestGuards = {
  /** Límite de tasa; solo se consume para intenciones nuevas (los reintentos no cuentan). */
  consumeRateLimit: () => Promise<boolean>;
};

/**
 * Registra la solicitud web de forma idempotente y devuelve el mensaje completo.
 * Orden: condiciones → contacto → ¿reintento? → límite de tasa → cotización aceptada →
 * registro (revisión 1 = cotización aceptada) → mensaje desde el snapshot guardado.
 */
export async function submitWebRequest(deps: WebSalesDeps, input: WebRequestInput, guards: WebRequestGuards): Promise<WebRequestResult> {
  if (input.termsVersion !== REQUEST_TERMS.version) {
    return { ok: false, code: "TERMS_OUTDATED", message: "Las condiciones se actualizaron. Revísalas y acéptalas de nuevo." };
  }
  if (!input.acceptedTerms) return { ok: false, code: "VALIDATION_ERROR", message: "Debes aceptar las condiciones de la solicitud.", field: "acceptedTerms" };
  const contact = deps.normalizeContact({ name: input.customerName, phone: input.customerPhone?.trim() ? input.customerPhone : null });
  if (!contact.ok) return { ok: false, code: "VALIDATION_ERROR", message: contact.message, field: contact.field === "name" ? "customerName" : "customerPhone" };

  const prior = await deps.store.transaction(({ sales }) => sales.findOrderByCreationKey(input.creationKey));
  if (!prior) {
    if (!(await guards.consumeRateLimit())) {
      return { ok: false, code: "RATE_LIMITED", message: "Recibimos muchas solicitudes desde tu conexión. Espera unos minutos e inténtalo de nuevo." };
    }
    const quoted = await quoteCart(
      deps,
      input.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, seenPriceMinor: l.acceptedPriceMinor })),
    );
    if (!quoted.ok) return { ok: false, code: quoted.code, message: quoted.message, field: "lines" };
    if (!quoted.quote.ready || quoted.quote.totalMinor !== input.acceptedTotalMinor) {
      return {
        ok: false,
        code: "QUOTE_CHANGED",
        message: "Tu carrito cambió: revisa precios y disponibilidad antes de enviar.",
        quote: quoted.quote,
      };
    }
  }

  const created = await createOrderRequest(deps, null, {
    acceptedTotalMinor: input.acceptedTotalMinor,
    source: "web",
    lines: input.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
    customerName: input.customerName,
    customerPhone: input.customerPhone ?? null,
    deliveryPreference: input.deliveryPreference,
    creationKey: input.creationKey,
    termsVersion: input.termsVersion,
    note: input.couponCode ? couponNote(input.couponCode) : null,
  });
  if (!created.ok) return { ok: false, code: created.code, message: created.message, field: created.field };

  const revision = await deps.store.transaction(({ sales }) => sales.getRevision(created.value.id, 1));
  const message = buildWhatsAppMessage({
    reference: created.value.reference,
    lines: revision.lines,
    subtotalMinor: revision.subtotalMinor,
    discountMinor: revision.discountMinor,
    promotion: revision.promotionDiscountMinor > 0 ? { label: revision.promotionLabel ?? promotionLabelFromCode(revision.promotionCode) ?? "Pack", discountMinor: revision.promotionDiscountMinor } : null,
    deliveryPreference: revision.deliveryMode,
    coupon: couponFromNote(revision.note),
  });
  return {
    ok: true,
    replayed: prior !== null,
    request: {
      reference: created.value.reference,
      message,
      subtotalMinor: revision.subtotalMinor,
      totalMinor: revision.totalMinor,
      units: revision.lines.reduce((sum, l) => sum + l.quantity, 0),
    },
  };
}
