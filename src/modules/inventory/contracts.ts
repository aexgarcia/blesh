/** Tipos públicos del módulo inventory. Conoce variantes solo por id opaco. */

export type StockBalance = { variantId: string; onHand: number; reserved: number; available: number; version: number };

/** Motivos de ajuste manual (los de pedidos los registra sales en fases posteriores). */
export const ADJUSTMENT_REASONS = ["initial_count", "restock", "count_correction", "damage", "loss", "other"] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const REASON_LABELS: Record<string, string> = {
  initial_count: "Conteo inicial",
  restock: "Ingreso de producción",
  count_correction: "Corrección de conteo",
  damage: "Prenda dañada",
  loss: "Pérdida",
  other: "Otro",
  reservation: "Reserva de pedido",
  release: "Liberación de reserva",
  consumption: "Despacho/entrega",
  return_inspected: "Devolución inspeccionada",
};

export type StockMovementView = {
  id: string;
  variantId: string;
  deltaOnHand: number;
  deltaReserved: number;
  onHandAfter: number;
  reservedAfter: number;
  reason: string;
  note: string | null;
  createdAt: string;
};

export type InventoryErrorCode = "FORBIDDEN" | "VALIDATION_ERROR" | "BELOW_RESERVED" | "NEGATIVE_STOCK" | "NOT_REGISTERED" | "ALREADY_REGISTERED" | "IDEMPOTENCY_CONFLICT";
