import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { OrderRow, RevisionInput, SalesTx } from "../application/ports";
import type { CollectionResponsible, DeliveryMode, PaymentMode, RefundOrigin } from "../contracts";
import { orderEvents, orderItems, orderRevisions, orders, paymentRecords, refundObligations, returnReceiptItems, returnReceipts } from "./schema";

type Row = typeof orders.$inferSelect;

export const toOrderRow = (r: Row): OrderRow => ({
  id: r.id,
  reference: r.reference,
  source: r.source as OrderRow["source"],
  status: r.status as OrderRow["status"],
  fulfillmentStatus: r.fulfillmentStatus as OrderRow["fulfillmentStatus"],
  collectionStatus: r.collectionStatus as OrderRow["collectionStatus"],
  refundStatus: r.refundStatus as OrderRow["refundStatus"],
  customerId: r.customerId,
  customerName: r.customerName,
  customerPhone: r.customerPhone,
  deliveryPreference: r.deliveryPreference as DeliveryMode,
  currentRevision: r.currentRevision,
  acceptedRevision: r.acceptedRevision,
  totalMinor: r.totalMinor,
  paidMinor: r.paidMinor,
  reportedMinor: r.reportedMinor,
  refundedMinor: r.refundedMinor,
  followUpAt: r.followUpAt,
  carrier: r.carrier,
  trackingCode: r.trackingCode,
  cancelReason: r.cancelReason,
  creationKey: r.creationKey,
  creationFingerprint: r.creationFingerprint,
  version: r.version,
});

export async function loadRevisions(db: AnyDatabase, orderId: string, numbers?: number[]) {
  const revs = await db
    .select()
    .from(orderRevisions)
    .where(and(eq(orderRevisions.orderId, orderId), numbers ? inArray(orderRevisions.number, numbers) : undefined))
    .orderBy(asc(orderRevisions.number));
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), numbers ? inArray(orderItems.revision, numbers) : undefined))
    .orderBy(asc(orderItems.position));
  return revs.map((r) => ({
    number: r.number,
    lines: items
      .filter((i) => i.revision === r.number)
      .map((i) => ({
        variantId: i.variantId,
        sku: i.sku,
        productTitle: i.productTitle,
        colorLabel: i.colorLabel,
        sizeCode: i.sizeCode,
        unitPriceMinor: i.unitPriceMinor,
        quantity: i.quantity,
        lineTotalMinor: i.lineTotalMinor,
      })),
    subtotalMinor: r.subtotalMinor,
    discountMinor: r.discountMinor,
    shippingMinor: r.shippingMinor,
    totalMinor: r.totalMinor,
    deliveryMode: r.deliveryMode as DeliveryMode,
    deliveryAddress: r.deliveryAddress,
    deliveryNote: r.deliveryNote,
    paymentMode: r.paymentMode as PaymentMode | null,
    requiredDepositMinor: r.requiredDepositMinor,
    collectionResponsible: r.collectionResponsible as CollectionResponsible,
    note: r.note,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

export function salesTx(db: AnyDatabase): SalesTx {
  return {
    async lockOrder(id) {
      const [row] = await db.select().from(orders).where(eq(orders.id, id)).for("update");
      return row ? toOrderRow(row) : null;
    },
    async lockCreationKey(key) {
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`order-create:${key}`}, 0))`);
    },
    async findOrderByCreationKey(key) {
      const [row] = await db.select().from(orders).where(eq(orders.creationKey, key));
      return row ? toOrderRow(row) : null;
    },
    async insertOrder(input) {
      const [row] = await db
        .insert(orders)
        .values(input)
        .onConflictDoNothing({ target: orders.reference })
        .returning();
      return row ? toOrderRow(row) : null;
    },
    async updateOrder(id, patch) {
      const [row] = await db
        .update(orders)
        .set({ ...patch, version: sql`${orders.version} + 1`, updatedAt: sql`now()` })
        .where(eq(orders.id, id))
        .returning();
      return toOrderRow(row);
    },
    async insertRevision(orderId, revision: RevisionInput, actorId) {
      const { lines, ...rest } = revision;
      await db.insert(orderRevisions).values({ ...rest, orderId, createdBy: actorId });
      await db.insert(orderItems).values(lines.map((l, position) => ({ ...l, orderId, revision: revision.number, position })));
    },
    async getRevision(orderId, number) {
      const [rev] = await loadRevisions(db, orderId, [number]);
      if (!rev) throw new Error(`Revisión ${number} inexistente`);
      return rev;
    },
    async hasEventKey(operationKey) {
      const [row] = await db.select({ id: orderEvents.id }).from(orderEvents).where(eq(orderEvents.operationKey, operationKey));
      return Boolean(row);
    },
    async insertEvent(input) {
      await db.insert(orderEvents).values({ ...input, revision: input.revision ?? null, reason: input.reason ?? null, data: input.data ?? null, operationKey: input.operationKey ?? null });
    },
    async findPaymentByKey(operationKey) {
      const [row] = await db.select().from(paymentRecords).where(eq(paymentRecords.operationKey, operationKey));
      return row ? { ...row, kind: row.kind as "payment" | "refund", status: row.status as "verified" | "reported", method: row.method as never } : null;
    },
    async lockPayment(id) {
      const [row] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, id)).for("update");
      return row ? { ...row, kind: row.kind as "payment" | "refund", status: row.status as "verified" | "reported", method: row.method as never } : null;
    },
    async insertPayment(input) {
      const { actorId, ...values } = input;
      const verified = values.status === "verified";
      const [row] = await db
        .insert(paymentRecords)
        .values({ ...values, recordedBy: actorId, verifiedBy: verified ? actorId : null, verifiedAt: verified ? sql`now()` : null })
        .returning();
      return { ...row, kind: row.kind as "payment" | "refund", status: row.status as "verified" | "reported", method: row.method as never };
    },
    async markPaymentVerified(id, actorId) {
      await db.update(paymentRecords).set({ status: "verified", verifiedBy: actorId, verifiedAt: sql`now()` }).where(and(eq(paymentRecords.id, id), eq(paymentRecords.status, "reported")));
    },
    async lockObligations(orderId) {
      const rows = await db.select().from(refundObligations).where(eq(refundObligations.orderId, orderId)).orderBy(asc(refundObligations.createdAt)).for("update");
      return rows.map((r) => ({ id: r.id, orderId: r.orderId, origin: r.origin as RefundOrigin, authorizedMinor: r.authorizedMinor, refundedMinor: r.refundedMinor }));
    },
    async insertObligation(input) {
      const { actorId, ...values } = input;
      const [row] = await db.insert(refundObligations).values({ ...values, reason: values.reason.slice(0, 300), createdBy: actorId }).returning();
      return { id: row.id, orderId: row.orderId, origin: row.origin as RefundOrigin, authorizedMinor: row.authorizedMinor, refundedMinor: row.refundedMinor };
    },
    async addRefundToObligation(id, amountMinor) {
      await db
        .update(refundObligations)
        .set({ refundedMinor: sql`${refundObligations.refundedMinor} + ${amountMinor}` })
        .where(eq(refundObligations.id, id));
    },
    async returnedUnits(orderId) {
      const rows = await db
        .select({ variantId: returnReceiptItems.variantId, received: sql<number>`sum(${returnReceiptItems.received})::int` })
        .from(returnReceiptItems)
        .innerJoin(returnReceipts, eq(returnReceipts.id, returnReceiptItems.receiptId))
        .where(eq(returnReceipts.orderId, orderId))
        .groupBy(returnReceiptItems.variantId);
      return new Map(rows.map((r) => [r.variantId, r.received]));
    },
    async insertReturnReceipt(input) {
      const [receipt] = await db
        .insert(returnReceipts)
        .values({ orderId: input.orderId, reason: input.reason.slice(0, 300), operationKey: input.operationKey, createdBy: input.actorId })
        .returning({ id: returnReceipts.id });
      await db.insert(returnReceiptItems).values(input.items.map((i) => ({ receiptId: receipt.id, ...i })));
    },
  };
}
