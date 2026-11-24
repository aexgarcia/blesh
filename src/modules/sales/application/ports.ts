import type {
  CollectionResponsible,
  CollectionStatus,
  DeliveryMode,
  FulfillmentStatus,
  OrderLine,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentMode,
  RefundOrigin,
  RefundStatus,
  SalesErrorCode,
} from "../contracts";

export type OrderRow = {
  id: string;
  reference: string;
  source: OrderSource;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  collectionStatus: CollectionStatus;
  refundStatus: RefundStatus;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  deliveryPreference: DeliveryMode;
  currentRevision: number;
  acceptedRevision: number | null;
  totalMinor: number;
  paidMinor: number;
  reportedMinor: number;
  refundedMinor: number;
  followUpAt: Date | null;
  carrier: string | null;
  trackingCode: string | null;
  cancelReason: string | null;
  creationKey: string | null;
  creationFingerprint: string | null;
  version: number;
};

export type OrderPatch = Partial<
  Pick<
    OrderRow,
    | "status"
    | "fulfillmentStatus"
    | "collectionStatus"
    | "refundStatus"
    | "customerId"
    | "currentRevision"
    | "acceptedRevision"
    | "totalMinor"
    | "paidMinor"
    | "reportedMinor"
    | "refundedMinor"
    | "followUpAt"
    | "carrier"
    | "trackingCode"
    | "cancelReason"
  > & { acceptedAt: Date; acceptedBy: string; acceptedNote: string | null; confirmedAt: Date; completedAt: Date; cancelledAt: Date; dispatchedAt: Date; deliveredAt: Date }
>;

export type RevisionInput = {
  number: number;
  lines: OrderLine[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  deliveryMode: DeliveryMode;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  paymentMode: PaymentMode | null;
  requiredDepositMinor: number;
  collectionResponsible: CollectionResponsible;
  note: string | null;
};

export type PaymentRow = {
  id: string;
  orderId: string;
  kind: "payment" | "refund";
  status: "verified" | "reported";
  method: PaymentMethod;
  amountMinor: number;
  operationKey: string;
};

export type ObligationRow = {
  id: string;
  orderId: string;
  origin: RefundOrigin;
  authorizedMinor: number;
  refundedMinor: number;
};

/** Operaciones de ventas dentro de la transacción (el pedido se bloquea primero). */
export interface SalesTx {
  lockOrder(id: string): Promise<OrderRow | null>;
  lockCreationKey(key: string): Promise<void>;
  findOrderByCreationKey(key: string): Promise<OrderRow | null>;
  /** Devuelve null si la referencia generada ya existe (se reintenta con otra). */
  insertOrder(input: {
    reference: string;
    source: OrderSource;
    customerName: string;
    customerPhone: string;
    deliveryPreference: DeliveryMode;
    totalMinor: number;
    creationKey: string;
    creationFingerprint: string;
    createdBy: string | null;
  }): Promise<OrderRow | null>;
  /** Siempre incrementa la versión. */
  updateOrder(id: string, patch: OrderPatch): Promise<OrderRow>;
  insertRevision(orderId: string, revision: RevisionInput, actorId: string | null): Promise<void>;
  getRevision(orderId: string, number: number): Promise<RevisionInput>;
  hasEventKey(operationKey: string): Promise<boolean>;
  insertEvent(input: { orderId: string; event: string; actorId: string | null; revision?: number | null; reason?: string | null; data?: Record<string, unknown> | null; operationKey?: string | null }): Promise<void>;
  findPaymentByKey(operationKey: string): Promise<PaymentRow | null>;
  lockPayment(id: string): Promise<PaymentRow | null>;
  insertPayment(input: {
    orderId: string;
    kind: "payment" | "refund";
    status: "verified" | "reported";
    method: PaymentMethod;
    amountMinor: number;
    reference: string | null;
    note: string | null;
    receivedAt: Date;
    operationKey: string;
    obligationId: string | null;
    actorId: string;
  }): Promise<PaymentRow>;
  markPaymentVerified(id: string, actorId: string): Promise<void>;
  lockObligations(orderId: string): Promise<ObligationRow[]>;
  insertObligation(input: { orderId: string; origin: RefundOrigin; reason: string; authorizedMinor: number; actorId: string }): Promise<ObligationRow>;
  addRefundToObligation(id: string, amountMinor: number): Promise<void>;
  returnedUnits(orderId: string): Promise<Map<string, number>>;
  insertReturnReceipt(input: { orderId: string; reason: string; operationKey: string; actorId: string; items: { variantId: string; received: number; restocked: number }[] }): Promise<void>;
}

export type Shortage = { variantId: string; requested: number; available: number };

export interface InventoryPort {
  reserve(input: { orderId: string; lines: { variantId: string; quantity: number }[]; actorId: string }): Promise<{ ok: true } | { ok: false; shortages: Shortage[] }>;
  release(input: { orderId: string; actorId: string }): Promise<number>;
  consume(input: { orderId: string; actorId: string }): Promise<number>;
  restockReturn(input: { orderId: string; variantId: string; quantity: number; operationKey: string; actorId: string; note: string | null }): Promise<void>;
}

export type NewCustomerInput = { name: string; phone: string; email: string | null; confirmSharedPhone: boolean };

export interface CustomerPort {
  /** Ficha activa, bloqueada; error legible si no existe o está archivada. */
  requireLinkable(actor: SalesActor, customerId: string): Promise<{ ok: true; id: string } | { ok: false; message: string }>;
  create(actor: SalesActor, input: NewCustomerInput & { creationKey: string }): Promise<{ ok: true; id: string } | { ok: false; message: string; field?: string }>;
}

export type TxContext = { sales: SalesTx; inventory: InventoryPort; customers: CustomerPort };

export interface SalesStore {
  transaction<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T>;
}

export type QuotedVariant = {
  variantId: string;
  sku: string;
  productTitle: string;
  colorLabel: string;
  sizeCode: string;
  priceMinor: number;
  sellable: boolean;
};

export type SalesCapability =
  | "orders.operate"
  | "orders.manual_create"
  | "payments.record"
  | "orders.cancel_paid"
  | "orders.exceptional_discount"
  | "refunds.manage"
  | "payment_terms.authorize"
  | "customers.archive";

export type SalesActor = { membershipId: string; role: "owner" | "operator" };

export type SalesDeps = {
  store: SalesStore;
  /** Precios vigentes del catálogo (autoridad de precio). */
  quote: (variantIds: readonly string[]) => Promise<QuotedVariant[]>;
  authorize: (actor: SalesActor, capability: SalesCapability) => boolean;
  /** 6+ bytes aleatorios para la referencia. */
  randomBytes: () => Uint8Array;
  clock: { now: () => Date };
  /** Validación de contacto (la aporta customers: misma normalización de teléfono). */
  normalizeContact: (input: { name: string; phone: string }) => { ok: true; name: string; phone: string } | { ok: false; field: "name" | "phone"; message: string };
};

export class SalesFailure extends Error {
  constructor(
    readonly code: SalesErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "SalesFailure";
  }
}

export type SalesResult<T> = { ok: true; value: T } | { ok: false; code: SalesErrorCode; message: string; field?: string };

export async function salesResult<T>(run: () => Promise<T>): Promise<SalesResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof SalesFailure) return { ok: false, code: error.code, message: error.message, field: error.field };
    throw error;
  }
}
