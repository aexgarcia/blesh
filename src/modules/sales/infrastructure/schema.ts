import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, jsonb, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";
import { productVariants } from "../../catalog/infrastructure/schema";
import { customers } from "../../customers/infrastructure/schema";

export const packConfig = appSchema.table("pack_config", {
  code: text().primaryKey(),
  enabled: boolean().notNull(),
  policy: jsonb().$type<import("../domain/promotions").PackPolicy>().notNull(),
  version: integer().notNull(),
  operationKey: uuid().notNull(),
  fingerprint: text().notNull(),
  updatedBy: uuid().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("pack_config_code_check", sql`${t.code} = 'pack-boxy-essential'`), check("pack_config_version_check", sql`${t.version} > 0`)]);

/**
 * Pedido: snapshot de contacto de la solicitud, revisión vigente/aceptada y ejes de estado
 * independientes. Los importes cobrados/reportados/devueltos son agregados mantenidos bajo
 * bloqueo del pedido; la historia está en `payment_records`.
 */
export const orders = appSchema.table(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    reference: text().notNull(),
    source: text().notNull(),
    status: text().notNull().default("requested"),
    fulfillmentStatus: text().notNull().default("unarranged"),
    collectionStatus: text().notNull().default("unpaid"),
    refundStatus: text().notNull().default("none"),
    customerId: uuid().references(() => customers.id, { onDelete: "restrict" }),
    customerName: text().notNull(),
    customerPhone: text(),
    deliveryPreference: text().notNull().default("undecided"),
    currentRevision: integer().notNull().default(1),
    acceptedRevision: integer(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedBy: uuid(),
    acceptedNote: text(),
    totalMinor: integer().notNull(),
    paidMinor: integer().notNull().default(0),
    reportedMinor: integer().notNull().default(0),
    refundedMinor: integer().notNull().default(0),
    currency: text().notNull().default("PEN"),
    followUpAt: timestamp({ withTimezone: true }),
    carrier: text(),
    trackingCode: text(),
    cancelReason: text(),
    creationKey: uuid(),
    creationFingerprint: text(),
    createdBy: uuid(),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp({ withTimezone: true }),
    dispatchedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("orders_reference_key").on(t.reference),
    uniqueIndex("orders_creation_key_key").on(t.creationKey),
    index("orders_status_created_idx").on(t.status, t.createdAt),
    index("orders_customer_idx").on(t.customerId, t.createdAt),
    check("orders_reference_check", sql`${t.reference} ~ '^BL-[0-9A-Z]{6}$'`),
    check("orders_source_check", sql`${t.source} in ('web', 'whatsapp', 'presential')`),
    check("orders_status_check", sql`${t.status} in ('requested', 'confirmed', 'completed', 'cancelled')`),
    check("orders_fulfillment_check", sql`${t.fulfillmentStatus} in ('unarranged', 'arranged', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled')`),
    check("orders_collection_check", sql`${t.collectionStatus} in ('unpaid', 'partially_paid', 'paid')`),
    check("orders_refund_check", sql`${t.refundStatus} in ('none', 'pending', 'partially_refunded', 'refunded')`),
    check("orders_delivery_preference_check", sql`${t.deliveryPreference} in ('pickup', 'shipping', 'undecided')`),
    check("orders_amounts_check", sql`${t.totalMinor} >= 0 and ${t.paidMinor} >= 0 and ${t.reportedMinor} >= 0 and ${t.refundedMinor} >= 0 and ${t.refundedMinor} <= ${t.paidMinor}`),
    check("orders_confirmed_customer_check", sql`${t.status} = 'requested' or (${t.status} = 'cancelled' and ${t.confirmedAt} is null) or ${t.customerId} is not null`),
    check("orders_completed_check", sql`${t.status} <> 'completed' or (${t.fulfillmentStatus} = 'delivered' and ${t.paidMinor} >= ${t.totalMinor})`),
    check("orders_accepted_check", sql`${t.acceptedRevision} is null or ${t.acceptedRevision} <= ${t.currentRevision}`),
  ],
);

/** Revisión inmutable del acuerdo comercial (líneas, entrega y cobro). */
export const orderRevisions = appSchema.table(
  "order_revisions",
  {
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    number: integer().notNull(),
    subtotalMinor: integer().notNull(),
    discountMinor: integer().notNull().default(0),
    /** Descuento automático por packs (política versionada), separado del excepcional. */
    promotionDiscountMinor: integer().notNull().default(0),
    /** `codigo@version` de las políticas aplicadas; null sin promoción. */
    promotionCode: text(),
    promotionLabel: text(),
    shippingMinor: integer().notNull().default(0),
    totalMinor: integer().notNull(),
    deliveryMode: text().notNull(),
    deliveryAddress: text(),
    deliveryNote: text(),
    paymentMode: text(),
    requiredDepositMinor: integer().notNull().default(0),
    collectionResponsible: text().notNull().default("company"),
    note: text(),
    createdBy: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.number] }),
    check(
      "order_revisions_totals_check",
      sql`${t.discountMinor} >= 0 and ${t.promotionDiscountMinor} >= 0 and ${t.discountMinor} + ${t.promotionDiscountMinor} <= ${t.subtotalMinor} and ${t.shippingMinor} >= 0 and ${t.totalMinor} = ${t.subtotalMinor} - ${t.promotionDiscountMinor} - ${t.discountMinor} + ${t.shippingMinor}`,
    ),
    check("order_revisions_promotion_check", sql`(${t.promotionDiscountMinor} = 0) = (${t.promotionCode} is null)`),
    check("order_revisions_delivery_check", sql`${t.deliveryMode} in ('pickup', 'shipping', 'undecided')`),
    check("order_revisions_payment_mode_check", sql`${t.paymentMode} is null or ${t.paymentMode} in ('prepaid', 'deposit_on_delivery', 'cash_on_delivery')`),
    check("order_revisions_responsible_check", sql`${t.collectionResponsible} in ('company', 'carrier')`),
    check("order_revisions_deposit_check", sql`${t.requiredDepositMinor} >= 0 and ${t.requiredDepositMinor} <= ${t.totalMinor}`),
  ],
);

/** Líneas de cada revisión con snapshot de catálogo (SKU, título, color, talla, precio). */
export const orderItems = appSchema.table(
  "order_items",
  {
    orderId: uuid().notNull(),
    revision: integer().notNull(),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    sku: text().notNull(),
    productTitle: text().notNull(),
    colorLabel: text().notNull(),
    sizeCode: text().notNull(),
    unitPriceMinor: integer().notNull(),
    quantity: integer().notNull(),
    lineTotalMinor: integer().notNull(),
    position: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.revision, t.variantId] }),
    foreignKey({ name: "order_items_revision_fk", columns: [t.orderId, t.revision], foreignColumns: [orderRevisions.orderId, orderRevisions.number] }).onDelete("restrict"),
    check("order_items_amounts_check", sql`${t.quantity} > 0 and ${t.unitPriceMinor} > 0 and ${t.lineTotalMinor} = ${t.unitPriceMinor} * ${t.quantity}`),
  ],
);

/** Obligación del negocio de devolver dinero recibido (cancelación, exceso, devolución). */
export const refundObligations = appSchema.table(
  "refund_obligations",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    origin: text().notNull(),
    reason: text().notNull(),
    authorizedMinor: integer().notNull(),
    refundedMinor: integer().notNull().default(0),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("refund_obligations_order_idx").on(t.orderId),
    check("refund_obligations_origin_check", sql`${t.origin} in ('cancellation', 'overpayment', 'late_payment', 'return')`),
    check("refund_obligations_amounts_check", sql`${t.authorizedMinor} > 0 and ${t.refundedMinor} >= 0 and ${t.refundedMinor} <= ${t.authorizedMinor}`),
  ],
);

/** Cobros y devoluciones: movimientos con importe positivo; solo cambia reportado → verificado. */
export const paymentRecords = appSchema.table(
  "payment_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    kind: text().notNull(),
    status: text().notNull(),
    method: text().notNull(),
    amountMinor: integer().notNull(),
    reference: text(),
    note: text(),
    receivedAt: timestamp({ withTimezone: true }).notNull(),
    obligationId: uuid().references(() => refundObligations.id, { onDelete: "restrict" }),
    operationKey: text().notNull(),
    recordedBy: uuid().notNull(),
    verifiedBy: uuid(),
    verifiedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_records_operation_key").on(t.operationKey),
    index("payment_records_order_idx").on(t.orderId, t.createdAt),
    check("payment_records_kind_check", sql`${t.kind} in ('payment', 'refund')`),
    check("payment_records_status_check", sql`${t.status} in ('verified', 'reported')`),
    check("payment_records_method_check", sql`${t.method} in ('yape', 'plin', 'transfer', 'cash', 'other')`),
    check("payment_records_amount_check", sql`${t.amountMinor} > 0`),
    check("payment_records_verified_check", sql`(${t.status} = 'verified') = (${t.verifiedBy} is not null and ${t.verifiedAt} is not null)`),
    check("payment_records_refund_check", sql`${t.kind} <> 'refund' or (${t.status} = 'verified' and ${t.obligationId} is not null)`),
  ],
);

/** Recepción de prendas devueltas: acumulado por variante nunca mayor que lo entregado. */
export const returnReceipts = appSchema.table(
  "return_receipts",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    reason: text().notNull(),
    operationKey: text().notNull(),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("return_receipts_operation_key").on(t.operationKey), index("return_receipts_order_idx").on(t.orderId)],
);

export const returnReceiptItems = appSchema.table(
  "return_receipt_items",
  {
    receiptId: uuid()
      .notNull()
      .references(() => returnReceipts.id, { onDelete: "restrict" }),
    variantId: uuid().notNull(),
    received: integer().notNull(),
    restocked: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.receiptId, t.variantId] }),
    check("return_receipt_items_check", sql`${t.received} > 0 and ${t.restocked} >= 0 and ${t.restocked} <= ${t.received}`),
  ],
);

/** Historial funcional del pedido. `operation_key` hace idempotentes los comandos. */
export const orderEvents = appSchema.table(
  "order_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    event: text().notNull(),
    actorId: uuid(),
    revision: integer(),
    reason: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    operationKey: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("order_events_operation_key").on(t.operationKey), index("order_events_order_idx").on(t.orderId, t.createdAt)],
);
