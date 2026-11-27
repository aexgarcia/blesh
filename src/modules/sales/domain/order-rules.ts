/**
 * Reglas puras de pedidos y cobros. Dinero en céntimos enteros; sin I/O.
 * Ejes independientes: pedido, entrega, cobro, reembolso y reserva.
 */
import { MAX_ORDER_TOTAL_MINOR, MAX_UNIT_PRICE_MINOR } from "../../../shared/domain/money";
import type {
  CollectionResponsible,
  CollectionStatus,
  DeliveryMode,
  FulfillmentStatus,
  OrderStatus,
  PaymentMode,
  RefundStatus,
} from "../contracts";
import { MAX_ORDER_LINES, MAX_UNITS_PER_LINE } from "../contracts";

export type Problem = { code: string; message: string; field?: string };

export type RequestedLine = { variantId: string; quantity: number };

/** Une variantes repetidas y aplica límites antes de cotizar. */
export function normalizeRequestedLines(lines: readonly RequestedLine[]): RequestedLine[] | Problem {
  if (lines.length === 0) return { code: "VALIDATION_ERROR", message: "Agrega al menos un producto.", field: "lines" };
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) return { code: "VALIDATION_ERROR", message: "Las cantidades deben ser enteros positivos.", field: "lines" };
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  }
  if (totals.size > MAX_ORDER_LINES) return { code: "VALIDATION_ERROR", message: `Máximo ${MAX_ORDER_LINES} productos distintos por pedido.`, field: "lines" };
  for (const quantity of totals.values()) {
    if (quantity > MAX_UNITS_PER_LINE) return { code: "VALIDATION_ERROR", message: `Máximo ${MAX_UNITS_PER_LINE} unidades por talla.`, field: "lines" };
  }
  return [...totals.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export type PricedLine = { unitPriceMinor: number; quantity: number };

/** `promotionMinor`: descuento automático por packs (se resta antes del excepcional). */
export function computeTotals(lines: readonly PricedLine[], discountMinor: number, shippingMinor: number, promotionMinor = 0) {
  const subtotal = lines.reduce((sum, l) => {
    if (!Number.isSafeInteger(l.unitPriceMinor) || l.unitPriceMinor <= 0 || l.unitPriceMinor > MAX_UNIT_PRICE_MINOR) throw new RangeError("Precio inválido");
    return sum + l.unitPriceMinor * l.quantity;
  }, 0);
  if (!Number.isSafeInteger(promotionMinor) || promotionMinor < 0 || promotionMinor > subtotal) throw new RangeError("Promoción inválida");
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0 || discountMinor > subtotal - promotionMinor) {
    return { ok: false as const, problem: { code: "VALIDATION_ERROR", message: "El descuento no puede superar el subtotal.", field: "discount" } };
  }
  if (!Number.isSafeInteger(shippingMinor) || shippingMinor < 0 || shippingMinor > MAX_UNIT_PRICE_MINOR) {
    return { ok: false as const, problem: { code: "VALIDATION_ERROR", message: "Costo de envío inválido.", field: "shipping" } };
  }
  const total = subtotal - promotionMinor - discountMinor + shippingMinor;
  if (total > MAX_ORDER_TOTAL_MINOR) return { ok: false as const, problem: { code: "VALIDATION_ERROR", message: "El total supera el máximo permitido.", field: "lines" } };
  return { ok: true as const, subtotalMinor: subtotal, totalMinor: total };
}

export type CommercialTerms = {
  deliveryMode: DeliveryMode;
  deliveryAddress: string | null;
  paymentMode: PaymentMode | null;
  requiredDepositMinor: number;
  collectionResponsible: CollectionResponsible;
  shippingMinor: number;
};

/** Coherencia de entrega y modalidad de cobro de una revisión. */
export function termsProblem(terms: CommercialTerms, totalMinor: number): Problem | null {
  if (terms.deliveryMode !== "shipping" && terms.shippingMinor > 0) return { code: "VALIDATION_ERROR", message: "Solo los envíos tienen costo de envío.", field: "shipping" };
  if (terms.deliveryMode === "pickup" && terms.collectionResponsible === "carrier") {
    return { code: "VALIDATION_ERROR", message: "En recojo cobra la empresa.", field: "collectionResponsible" };
  }
  if (terms.paymentMode === "deposit_on_delivery") {
    if (terms.requiredDepositMinor <= 0 || terms.requiredDepositMinor >= totalMinor) {
      return { code: "VALIDATION_ERROR", message: "El adelanto debe ser mayor que 0 y menor que el total.", field: "deposit" };
    }
  } else if (terms.requiredDepositMinor !== 0) {
    return { code: "VALIDATION_ERROR", message: "El adelanto solo aplica a la modalidad adelanto + saldo.", field: "deposit" };
  }
  if (terms.paymentMode === "prepaid" && terms.collectionResponsible === "carrier") {
    return { code: "VALIDATION_ERROR", message: "En pago anticipado no cobra el transportista.", field: "collectionResponsible" };
  }
  return null;
}

/** Requisitos para confirmar una revisión aceptada. */
export function confirmationProblem(terms: CommercialTerms): Problem | null {
  if (terms.deliveryMode === "undecided") return { code: "AGREEMENT_REQUIRED", message: "Acuerda recojo o envío antes de confirmar." };
  if (terms.deliveryMode === "shipping" && !terms.deliveryAddress) return { code: "AGREEMENT_REQUIRED", message: "Registra la dirección de envío acordada." };
  if (!terms.paymentMode) return { code: "AGREEMENT_REQUIRED", message: "Acuerda la modalidad de cobro antes de confirmar." };
  return null;
}

/** Modalidades que dejan dinero por cobrar en la entrega: requieren autorización del propietario. */
export function termsNeedOwner(paymentMode: PaymentMode | null): boolean {
  return paymentMode === "deposit_on_delivery" || paymentMode === "cash_on_delivery";
}

export function collectionStatus(totalMinor: number, paidMinor: number): CollectionStatus {
  if (paidMinor <= 0) return "unpaid";
  return paidMinor >= totalMinor ? "paid" : "partially_paid";
}

export function refundStatus(obligations: readonly { authorizedMinor: number; refundedMinor: number }[]): RefundStatus {
  if (obligations.length === 0) return "none";
  const authorized = obligations.reduce((s, o) => s + o.authorizedMinor, 0);
  const refunded = obligations.reduce((s, o) => s + o.refundedMinor, 0);
  if (refunded === 0) return "pending";
  return refunded >= authorized ? "refunded" : "partially_refunded";
}

/**
 * ¿Se puede preparar/despachar según la modalidad? Anticipado: total verificado.
 * Adelanto: adelanto acordado verificado (el saldo queda autorizado para la entrega).
 * Contraentrega: autorizada al aceptar la revisión.
 */
export function fulfillmentPaymentProblem(input: { paymentMode: PaymentMode; requiredDepositMinor: number; totalMinor: number; paidMinor: number }): Problem | null {
  if (input.paymentMode === "prepaid" && input.paidMinor < input.totalMinor) {
    return { code: "PAYMENT_REVIEW_REQUIRED", message: "Pago anticipado: verifica el total antes de preparar o despachar." };
  }
  if (input.paymentMode === "deposit_on_delivery" && input.paidMinor < input.requiredDepositMinor) {
    return { code: "PAYMENT_REVIEW_REQUIRED", message: "Falta verificar el adelanto acordado." };
  }
  return null;
}

export type OrderState = {
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalMinor: number;
  paidMinor: number;
  reportedMinor: number;
  outstandingRefundMinor: number;
};

/** Completar exige entrega, cobro íntegro verificado y ninguna incidencia de dinero pendiente. */
export function completionProblems(order: OrderState): string[] {
  const problems: string[] = [];
  if (order.status !== "confirmed") problems.push("El pedido debe estar confirmado.");
  if (order.fulfillmentStatus !== "delivered") problems.push("Falta registrar la entrega.");
  if (order.paidMinor < order.totalMinor) problems.push("Falta verificar el cobro íntegro.");
  if (order.reportedMinor > 0) problems.push("Hay cobros de terceros pendientes de conciliar.");
  if (order.outstandingRefundMinor > 0) problems.push("Hay devoluciones de dinero pendientes.");
  return problems;
}

/** Transiciones de entrega permitidas por comando. */
export const FULFILLMENT_TRANSITIONS = {
  prepare: { from: ["arranged"], to: "preparing" },
  ready: { from: ["preparing"], to: "ready" },
  dispatch: { from: ["ready"], to: "dispatched" },
  deliverShipping: { from: ["dispatched"], to: "delivered" },
  handOverPickup: { from: ["ready"], to: "delivered" },
} as const satisfies Record<string, { from: readonly FulfillmentStatus[]; to: FulfillmentStatus }>;

/** Antes de salir del almacén se puede cancelar liberando reserva. */
export function cancellableBeforeDispatch(status: OrderStatus, fulfillment: FulfillmentStatus): boolean {
  return status === "requested" || (status === "confirmed" && (fulfillment === "arranged" || fulfillment === "preparing" || fulfillment === "ready"));
}

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"; // sin 0/O, 1/I/L, U

/** Referencia corta y no secuencial (no revela volumen de ventas): BL-XXXXXX. */
export function referenceFromBytes(bytes: Uint8Array): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length];
  return `BL-${code}`;
}
