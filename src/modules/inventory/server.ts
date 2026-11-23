import "server-only";

import { getDb } from "@/infrastructure/database/client";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";

import type { InventoryDeps } from "./application/stock-adjustments";
import type { StockBalance, StockMovementView } from "./contracts";
import { createInventoryStore } from "./infrastructure/inventory-store";

export function getInventoryDeps(): InventoryDeps {
  return {
    store: createInventoryStore(getDb()),
    authorize: (actor, capability) => actorCan(actor as AdminActor, capability),
  };
}

/** Balances por variante (lectura transaccional, sin caché compartida). */
export async function getBalances(variantIds: readonly string[]): Promise<Map<string, StockBalance>> {
  const rows = await createInventoryStore(getDb()).balances(variantIds);
  return new Map(rows.map((b) => [b.variantId, b]));
}

export function getRecentMovements(variantIds: readonly string[], limit = 50): Promise<StockMovementView[]> {
  return createInventoryStore(getDb()).movements(variantIds, limit);
}
