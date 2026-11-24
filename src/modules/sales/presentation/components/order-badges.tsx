import { Badge } from "@/shared/ui/surface";

import {
  COLLECTION_LABELS,
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  REFUND_LABELS,
  type CollectionStatus,
  type FulfillmentStatus,
  type OrderStatus,
  type RefundStatus,
} from "../../contracts";

const STATUS_TONE = { requested: "violet", confirmed: "ink", completed: "success", cancelled: "warning" } as const;
const COLLECTION_TONE = { unpaid: "neutral", partially_paid: "warning", paid: "success" } as const;

/** Ejes independientes con texto (el estado nunca depende solo del color). */
export function OrderBadges({
  status,
  fulfillmentStatus,
  collectionStatus,
  refundStatus,
  compact,
}: {
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  collectionStatus: CollectionStatus;
  refundStatus: RefundStatus;
  compact?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>
      {!compact || status === "confirmed" ? <Badge>{FULFILLMENT_LABELS[fulfillmentStatus]}</Badge> : null}
      <Badge tone={COLLECTION_TONE[collectionStatus]}>{COLLECTION_LABELS[collectionStatus]}</Badge>
      {refundStatus !== "none" ? <Badge tone={refundStatus === "refunded" ? "neutral" : "danger"}>{REFUND_LABELS[refundStatus]}</Badge> : null}
    </span>
  );
}
