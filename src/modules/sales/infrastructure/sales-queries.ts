import { and, asc, count, desc, eq, inArray, isNotNull, lte, sql, type SQL } from "drizzle-orm";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import type {
  CollectionStatus,
  CustomerOrderRow,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
  RefundObligationView,
} from "../contracts";
import { loadRevisions, toOrderRow } from "./sales-store";
import { orderEvents, orderItems, orders, paymentRecords, refundObligations, returnReceiptItems, returnReceipts } from "./schema";

/** Unidades de la revisión vigente de cada pedido. */
function unitsExpr() {
  return sql<number>`coalesce((select sum(i.quantity)::int from ${orderItems} i where i.order_id = ${orders.id} and i.revision = ${orders.currentRevision}), 0)`;
}

const summaryColumns = {
  id: orders.id,
  reference: orders.reference,
  source: orders.source,
  status: orders.status,
  fulfillmentStatus: orders.fulfillmentStatus,
  collectionStatus: orders.collectionStatus,
  refundStatus: orders.refundStatus,
  customerName: orders.customerName,
  totalMinor: orders.totalMinor,
  paidMinor: orders.paidMinor,
  followUpAt: orders.followUpAt,
  createdAt: orders.createdAt,
};

type SummaryRow = { [K in keyof typeof summaryColumns]: unknown } & { units: number };

const toSummary = (r: SummaryRow): OrderSummary =>
  ({
    ...r,
    followUpAt: (r.followUpAt as Date | null)?.toISOString() ?? null,
    createdAt: (r.createdAt as Date).toISOString(),
  }) as OrderSummary;

export type OrderListFilter = {
  reference?: string;
  status?: OrderStatus;
  collection?: CollectionStatus;
  /** Solo pedidos abiertos con seguimiento vencido. */
  followUpDue?: Date;
  page: number;
  pageSize: number;
};

export async function listOrders(db: AnyDatabase, filter: OrderListFilter): Promise<{ rows: OrderSummary[]; total: number }> {
  const conditions: (SQL | undefined)[] = [
    filter.status ? eq(orders.status, filter.status) : undefined,
    filter.collection ? eq(orders.collectionStatus, filter.collection) : undefined,
    filter.reference ? sql`${orders.reference} like ${`%${filter.reference.toUpperCase().replace(/[^0-9A-Z-]/g, "")}%`}` : undefined,
    filter.followUpDue ? and(isNotNull(orders.followUpAt), lte(orders.followUpAt, filter.followUpDue), inArray(orders.status, ["requested", "confirmed"])) : undefined,
  ];
  const where = and(...conditions);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ ...summaryColumns, units: unitsExpr() })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize),
    db.select({ total: count() }).from(orders).where(where),
  ]);
  return { rows: rows.map(toSummary), total };
}

/** Detalle con revisiones, cobros, obligaciones, eventos y devoluciones. Ids de actor sin resolver. */
export async function getOrderDetail(db: AnyDatabase, id: string): Promise<(OrderDetail & { actorIds: string[]; revisionAuthors: (string | null)[]; eventActors: (string | null)[] }) | null> {
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  if (!row) return null;
  const [revisions, payments, obligations, events, returned] = await Promise.all([
    loadRevisions(db, id),
    db.select().from(paymentRecords).where(eq(paymentRecords.orderId, id)).orderBy(asc(paymentRecords.createdAt)),
    db.select().from(refundObligations).where(eq(refundObligations.orderId, id)).orderBy(asc(refundObligations.createdAt)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(desc(orderEvents.createdAt)),
    db
      .select({
        variantId: returnReceiptItems.variantId,
        received: sql<number>`sum(${returnReceiptItems.received})::int`,
        restocked: sql<number>`sum(${returnReceiptItems.restocked})::int`,
      })
      .from(returnReceiptItems)
      .innerJoin(returnReceipts, eq(returnReceipts.id, returnReceiptItems.receiptId))
      .where(eq(returnReceipts.orderId, id))
      .groupBy(returnReceiptItems.variantId),
  ]);
  const o = toOrderRow(row);
  const current = revisions.find((r) => r.number === o.currentRevision);
  return {
    id: o.id,
    reference: o.reference,
    source: o.source,
    status: o.status,
    fulfillmentStatus: o.fulfillmentStatus,
    collectionStatus: o.collectionStatus,
    refundStatus: o.refundStatus,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerId: o.customerId,
    units: current?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0,
    totalMinor: o.totalMinor,
    paidMinor: o.paidMinor,
    reportedMinor: o.reportedMinor,
    refundedMinor: o.refundedMinor,
    followUpAt: o.followUpAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    version: o.version,
    deliveryPreference: o.deliveryPreference,
    currentRevision: o.currentRevision,
    acceptedRevision: o.acceptedRevision,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    acceptedNote: row.acceptedNote,
    carrier: o.carrier,
    trackingCode: o.trackingCode,
    cancelReason: o.cancelReason,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    // El nombre del autor lo resuelve la composición (identity) a partir de revisionAuthors.
    revisions: revisions.map((r) => ({
      number: r.number,
      lines: r.lines,
      subtotalMinor: r.subtotalMinor,
      discountMinor: r.discountMinor,
      shippingMinor: r.shippingMinor,
      totalMinor: r.totalMinor,
      deliveryMode: r.deliveryMode,
      deliveryAddress: r.deliveryAddress,
      deliveryNote: r.deliveryNote,
      paymentMode: r.paymentMode,
      requiredDepositMinor: r.requiredDepositMinor,
      collectionResponsible: r.collectionResponsible,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      createdByName: null,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind as "payment" | "refund",
      status: p.status as "verified" | "reported",
      method: p.method as PaymentMethod,
      amountMinor: p.amountMinor,
      reference: p.reference,
      note: p.note,
      receivedAt: p.receivedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    obligations: obligations.map(
      (b): RefundObligationView => ({
        id: b.id,
        origin: b.origin as RefundObligationView["origin"],
        reason: b.reason,
        authorizedMinor: b.authorizedMinor,
        refundedMinor: b.refundedMinor,
        status: b.refundedMinor === 0 ? "pending" : b.refundedMinor >= b.authorizedMinor ? "refunded" : "partially_refunded",
        createdAt: b.createdAt.toISOString(),
      }),
    ),
    events: events.map((e) => ({ id: e.id, event: e.event, actorName: null, reason: e.reason, revision: e.revision, createdAt: e.createdAt.toISOString() })),
    returned,
    actorIds: [...new Set([...revisions.map((r) => r.createdBy), ...events.map((e) => e.actorId)].filter((x): x is string => Boolean(x)))],
    revisionAuthors: revisions.map((r) => r.createdBy),
    eventActors: events.map((e) => e.actorId),
  };
}

export async function listOrdersByCustomer(db: AnyDatabase, customerId: string, limit = 50): Promise<CustomerOrderRow[]> {
  const rows = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      collectionStatus: orders.collectionStatus,
      refundStatus: orders.refundStatus,
      totalMinor: orders.totalMinor,
      paidMinor: orders.paidMinor,
      refundedMinor: orders.refundedMinor,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }) as CustomerOrderRow);
}
