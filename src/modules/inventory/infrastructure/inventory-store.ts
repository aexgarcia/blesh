import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { InventoryStore, InventoryTx } from "../application/stock-adjustments";
import type { StockBalance, StockMovementView } from "../contracts";
import { inventoryBalances, stockMovements } from "./schema";

type BalanceRow = typeof inventoryBalances.$inferSelect;
type MovementRow = typeof stockMovements.$inferSelect;

const toBalance = (r: BalanceRow): StockBalance => ({ variantId: r.variantId, onHand: r.onHand, reserved: r.reserved, available: r.onHand - r.reserved, version: r.version });
const toMovement = (r: MovementRow): StockMovementView & { operationKey: string } => ({
  id: r.id,
  variantId: r.variantId,
  deltaOnHand: r.deltaOnHand,
  deltaReserved: r.deltaReserved,
  onHandAfter: r.onHandAfter,
  reservedAfter: r.reservedAfter,
  reason: r.reason,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
  operationKey: r.operationKey,
});

function txOperations(db: AnyDatabase): InventoryTx {
  return {
    async lockBalance(variantId) {
      const [row] = await db.select().from(inventoryBalances).where(eq(inventoryBalances.variantId, variantId)).for("update");
      return row ? toBalance(row) : null;
    },
    async insertBalance(variantId, onHand) {
      const [row] = await db.insert(inventoryBalances).values({ variantId, onHand, reserved: 0 }).returning();
      return toBalance(row);
    },
    async applyDelta(variantId, delta) {
      // Condición en la misma sentencia: protege aunque se olvide el bloqueo previo.
      const [row] = await db
        .update(inventoryBalances)
        .set({ onHand: sql`${inventoryBalances.onHand} + ${delta}`, version: sql`${inventoryBalances.version} + 1`, updatedAt: sql`now()` })
        .where(and(eq(inventoryBalances.variantId, variantId), gte(sql`${inventoryBalances.onHand} + ${delta}`, inventoryBalances.reserved)))
        .returning();
      return row ? toBalance(row) : null;
    },
    async findMovementByKey(operationKey) {
      const [row] = await db.select().from(stockMovements).where(eq(stockMovements.operationKey, operationKey));
      return row ? toMovement(row) : null;
    },
    async insertMovement(input) {
      const [row] = await db.insert(stockMovements).values(input).returning();
      return toMovement(row);
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause ?? (error as { code?: string });
  return cause?.code === "23505";
}

export function createInventoryStore(db: AnyDatabase): InventoryStore {
  return {
    async transaction(fn) {
      try {
        return await db.transaction((tx) => fn(txOperations(tx as unknown as AnyDatabase)));
      } catch (error) {
        // Reenvío concurrente con la misma clave: la otra transacción ganó; reintentar devuelve su resultado.
        if (isUniqueViolation(error)) return db.transaction((tx) => fn(txOperations(tx as unknown as AnyDatabase)));
        throw error;
      }
    },
    async balances(variantIds) {
      if (variantIds.length === 0) return [];
      const rows = await db.select().from(inventoryBalances).where(inArray(inventoryBalances.variantId, [...variantIds]));
      return rows.map(toBalance);
    },
    async movements(variantIds, limit) {
      if (variantIds.length === 0) return [];
      const rows = await db
        .select()
        .from(stockMovements)
        .where(inArray(stockMovements.variantId, [...variantIds]))
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(limit);
      return rows.map(toMovement);
    },
  };
}
