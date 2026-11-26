import "server-only";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";

import { closeOrderReservations, reserveForOrder, restockReturnedUnits } from "./application/reservations";
import type { InventoryDeps } from "./application/stock-adjustments";
import type { ReservationLine, ReserveResult, StockBalance, StockMovementView } from "./contracts";
import { createInventoryStore } from "./infrastructure/inventory-store";
import { reservationTx } from "./infrastructure/reservation-store";

export function getInventoryDeps(): InventoryDeps {
  return {
    store: createInventoryStore(getDb()),
    authorize: (actor, capability) => actorCan(actor as AdminActor, capability),
  };
}

/** Balances por variante (lectura transaccional, sin caché compartida). */
export async function getBalances(variantIds: readonly string[], db: AnyDatabase = getDb()): Promise<Map<string, StockBalance>> {
  const rows = await createInventoryStore(db).balances(variantIds);
  return new Map(rows.map((b) => [b.variantId, b]));
}

export function getRecentMovements(variantIds: readonly string[], limit = 50): Promise<StockMovementView[]> {
  return createInventoryStore(getDb()).movements(variantIds, limit);
}

/**
 * Para ventas: reservas dentro de SU transacción (pedido bloqueado primero, luego balances
 * en orden de id). Inventory conoce el pedido solo por id opaco.
 */
export function inventoryWithin(tx: AnyDatabase) {
  const port = reservationTx(tx);
  return {
    reserve: (input: { orderId: string; lines: readonly ReservationLine[]; actorId: string }): Promise<ReserveResult> => reserveForOrder(port, input),
    release: (input: { orderId: string; actorId: string }) => closeOrderReservations(port, { ...input, mode: "release" }),
    consume: (input: { orderId: string; actorId: string }) => closeOrderReservations(port, { ...input, mode: "consume" }),
    restockReturn: (input: { orderId: string; variantId: string; quantity: number; operationKey: string; actorId: string; note: string | null }) =>
      restockReturnedUnits(port, input),
  };
}
