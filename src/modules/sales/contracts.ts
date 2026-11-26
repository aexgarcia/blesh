/** Tipos públicos del módulo sales (pedidos, cobros, reembolsos y devoluciones). */

export const ORDER_SOURCES = ["web", "whatsapp", "presential"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export type OrderStatus = "requested" | "confirmed" | "completed" | "cancelled";
export type FulfillmentStatus = "unarranged" | "arranged" | "preparing" | "ready" | "dispatched" | "delivered" | "cancelled";
export type CollectionStatus = "unpaid" | "partially_paid" | "paid";
export type RefundStatus = "none" | "pending" | "partially_refunded" | "refunded";

export const DELIVERY_MODES = ["pickup", "shipping", "undecided"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const PAYMENT_MODES = ["prepaid", "deposit_on_delivery", "cash_on_delivery"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/** Quién cobra en la entrega: la empresa o un tercero (transportista) que luego rinde cuentas. */
export const COLLECTION_RESPONSIBLES = ["company", "carrier"] as const;
export type CollectionResponsible = (typeof COLLECTION_RESPONSIBLES)[number];

/** Medios iniciales propuestos; sin cuentas ni números publicados. */
export const PAYMENT_METHODS = ["yape", "plin", "transfer", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type RefundOrigin = "cancellation" | "overpayment" | "late_payment" | "return";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  requested: "Solicitud",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
};
export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  unarranged: "Por acordar",
  arranged: "Acordada",
  preparing: "En preparación",
  ready: "Listo",
  dispatched: "Despachado",
  delivered: "Entregado",
  cancelled: "Cancelada",
};
export const COLLECTION_LABELS: Record<CollectionStatus, string> = { unpaid: "Impago", partially_paid: "Abono parcial", paid: "Pagado" };
export const REFUND_LABELS: Record<RefundStatus, string> = {
  none: "Sin devolución",
  pending: "Devolución pendiente",
  partially_refunded: "Devuelto en parte",
  refunded: "Devuelto",
};
export const SOURCE_LABELS: Record<OrderSource, string> = { web: "Web", whatsapp: "WhatsApp", presential: "Presencial" };
export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = { pickup: "Recojo", shipping: "Envío", undecided: "Por definir" };
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  prepaid: "Anticipado",
  deposit_on_delivery: "Adelanto + saldo en entrega",
  cash_on_delivery: "Contraentrega",
};
export const COLLECTION_RESPONSIBLE_LABELS: Record<CollectionResponsible, string> = { company: "La empresa", carrier: "Transportista (tercero)" };
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { yape: "Yape", plin: "Plin", transfer: "Transferencia", cash: "Efectivo", other: "Otro" };
export const REFUND_ORIGIN_LABELS: Record<RefundOrigin, string> = {
  cancellation: "Cancelación",
  overpayment: "Pago en exceso",
  late_payment: "Pago sobre pedido cancelado",
  return: "Devolución de prendas",
};

/** Línea cotizada por el servidor (snapshot: no cambia si luego cambia el catálogo). */
export type OrderLine = {
  variantId: string;
  sku: string;
  productTitle: string;
  colorLabel: string;
  sizeCode: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
};

export type OrderRevision = {
  number: number;
  lines: OrderLine[];
  subtotalMinor: number;
  discountMinor: number;
  /** Descuento automático por packs (`promotionCode` = política@versión). */
  promotionDiscountMinor: number;
  promotionCode: string | null;
  promotionLabel?: string | null;
  shippingMinor: number;
  totalMinor: number;
  deliveryMode: DeliveryMode;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  paymentMode: PaymentMode | null;
  requiredDepositMinor: number;
  collectionResponsible: CollectionResponsible;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type PaymentRecordView = {
  id: string;
  kind: "payment" | "refund";
  status: "verified" | "reported";
  method: PaymentMethod;
  amountMinor: number;
  reference: string | null;
  note: string | null;
  receivedAt: string;
  createdAt: string;
};

export type RefundObligationView = {
  id: string;
  origin: RefundOrigin;
  reason: string;
  authorizedMinor: number;
  refundedMinor: number;
  status: "pending" | "partially_refunded" | "refunded";
  createdAt: string;
};

export type OrderEventView = { id: string; event: string; actorName: string | null; reason: string | null; revision: number | null; createdAt: string };

export type ReturnedLine = { variantId: string; received: number; restocked: number };

export type OrderSummary = {
  id: string;
  reference: string;
  source: OrderSource;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  collectionStatus: CollectionStatus;
  refundStatus: RefundStatus;
  customerName: string;
  units: number;
  totalMinor: number;
  paidMinor: number;
  followUpAt: string | null;
  createdAt: string;
};

export type OrderDetail = OrderSummary & {
  version: number;
  customerPhone: string | null;
  customerId: string | null;
  deliveryPreference: DeliveryMode;
  currentRevision: number;
  acceptedRevision: number | null;
  acceptedAt: string | null;
  acceptedNote: string | null;
  reportedMinor: number;
  refundedMinor: number;
  carrier: string | null;
  trackingCode: string | null;
  cancelReason: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  revisions: OrderRevision[];
  payments: PaymentRecordView[];
  obligations: RefundObligationView[];
  events: OrderEventView[];
  returned: ReturnedLine[];
};

/** Fila del historial de pedidos de un cliente (pantalla de Clientes). */
export type CustomerOrderRow = {
  id: string;
  reference: string;
  status: OrderStatus;
  collectionStatus: CollectionStatus;
  refundStatus: RefundStatus;
  totalMinor: number;
  paidMinor: number;
  refundedMinor: number;
  createdAt: string;
};

export type SalesErrorCode =
  | "VALIDATION_ERROR"
  | "PRODUCT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_TRANSITION"
  | "AGREEMENT_REQUIRED"
  | "PAYMENT_REVIEW_REQUIRED"
  | "OVERPAYMENT"
  | "CUSTOMER_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "QUOTE_CHANGED"
  | "TERMS_OUTDATED"
  | "RATE_LIMITED"
  | "ORDERING_DISABLED";

export const ORDERS_PAGE_SIZE = 20;
/** Límites por pedido (antiabuso y legibilidad del mensaje). */
export const MAX_ORDER_LINES = 50;
export const MAX_UNITS_PER_LINE = 10;

// ---------------------------------------------------------------------------
// Tienda pública: carrito, cotización y solicitud web (fase 6)

/**
 * Condiciones que la persona acepta al registrar una solicitud web. Versionadas: la versión
 * aceptada queda en el evento `order.requested`. Resumen fiel de las reglas aprobadas
 * (SDD 5.1, políticas en borrador); NO son las políticas finales del negocio.
 * `status: "draft"` impide habilitar solicitudes en producción hasta su revisión.
 */
export const REQUEST_TERMS = {
  version: "2026-11-23-borrador",
  status: "draft" as "draft" | "final",
  points: [
    "Registrar esta solicitud o abrir WhatsApp no confirma la compra, el pago ni la reserva de las prendas.",
    "BLESH te contactará por WhatsApp para confirmar disponibilidad, forma y costo de entrega (recojo o envío) y modalidad de pago. Si algo cambia, te pediremos una nueva aceptación.",
    "Los precios están en soles (PEN). El envío se acuerda aparte: el total mostrado es provisional.",
    "Las prendas se apartan solo cuando BLESH confirma el pedido.",
    "Usamos tu nombre solo para coordinar esta solicitud. Al abrir WhatsApp, tú decides enviar el resumen por ese servicio.",
  ],
} as const;

export type CartQuoteImage = { url: string; width: number; height: number; alt: string };

/** Línea cotizada para la tienda (DTO público: sin stock exacto salvo el máximo pedible). */
export type CartQuoteLine = {
  variantId: string;
  quantity: number;
  status: "ok" | "unavailable" | "sold_out" | "insufficient";
  /** Máximo que se puede pedir hoy cuando faltan unidades (orientativo). */
  maxQuantity: number | null;
  /** Precio anterior si cambió desde que la persona lo vio. */
  previousPriceMinor: number | null;
  /** Cuenta para un pack por cantidad. */
  packEligible: boolean;
  item: {
    sku: string;
    productTitle: string;
    colorLabel: string;
    sizeCode: string;
    unitPriceMinor: number;
    lineTotalMinor: number;
    href: string | null;
    image: CartQuoteImage | null;
  } | null;
};

export type CartQuote = {
  lines: CartQuoteLine[];
  subtotalMinor: number;
  /** Descuento por packs calculado en el servidor. */
  promotionMinor: number;
  promotionLabel: string | null;
  /** Subtotal − packs; envío por acordar. */
  totalMinor: number;
  /** Progreso del pack (unidades elegibles y escala) para mostrarlo en el carrito. */
  pack: { label: string; units: number; tierTotalsMinor: readonly [number, number, number] } | null;
  units: number;
  /** Lista para registrar: todo vendible, con unidades y precios aceptados. */
  ready: boolean;
};

/** Resultado de registrar (o recuperar por reintento) una solicitud web. */
export type WebRequestReceipt = {
  reference: string;
  message: string;
  totalMinor: number;
  /** Enlace con el texto completo, o null si supera el tamaño seguro (copiar y pegar). */
  whatsappUrl: string | null;
  whatsappChatUrl: string;
  subtotalMinor: number;
  units: number;
};

/** Estado de las solicitudes en este despliegue (configuración, no datos del negocio). */
/** Política de packs vigente (para mostrar la escala; el cálculo autoritativo es del servidor). */
export { PACK_POLICIES, packTotalMinor, packApplies, type PackPolicy } from "./domain/promotions";

export type PackSettingsInput = { enabled: boolean; label: string; productSlugs: string[]; tierTotalsMinor: [number, number, number] };
export type PackSettings = { enabled: boolean; policy: import("./domain/promotions").PackPolicy; version: number };

export type OrderingStatus =
  | { enabled: true; testMode: boolean }
  | { enabled: false; testMode: boolean; reason: string };
