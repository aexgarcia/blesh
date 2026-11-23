import { and, eq, gte, sql } from "drizzle-orm";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { ReservationRow, ReservationTx } from "../application/reservations";
import { inventoryBalances, stockMovements, stockReservations } from "./schema";

/** Implementación de reservas sobre la transacción que abre ventas. */
export function reservationTx(db: AnyDatabase): ReservationTx {
  return {
    async lockBalance(variantId) {
      const [row] = await db.select().from(inventoryBalances).where(eq(inventoryBalances.variantId, variantId)).for("update");
      return row ? { variantId: row.variantId, onHand: row.onHand, reserved: row.reserved, available: row.onHand - row.reserved, version: row.version } : null;
    },
    async applyDeltas(variantId, deltaOnHand, deltaReserved) {
      const onHand = sql`${inventoryBalances.onHand} + ${deltaOnHand}`;
      const reserved = sql`${inventoryBalances.reserved} + ${deltaReserved}`;
      const [row] = await db
        .update(inventoryBalances)
        .set({ onHand: sql`${onHand}`, reserved: sql`${reserved}`, version: sql`${inventoryBalances.version} + 1`, updatedAt: sql`now()` })
        .where(and(eq(inventoryBalances.variantId, variantId), gte(reserved, 0), gte(onHand, reserved)))
        .returning();
      return row ? { variantId: row.variantId, onHand: row.onHand, reserved: row.reserved, available: row.onHand - row.reserved, version: row.version } : null;
    },
    async activeReservations(orderId) {
      const rows = await db
        .select()
        .from(stockReservations)
        .where(and(eq(stockReservations.orderId, orderId), eq(stockReservations.status, "active")))
        .for("update");
      return rows.map((r) => ({ ...r, status: r.status as ReservationRow["status"] }));
    },
    async insertReservation(input) {
      await db.insert(stockReservations).values(input);
    },
    async closeReservation(id, status) {
      await db
        .update(stockReservations)
        .set(status === "consumed" ? { status, consumedAt: sql`now()` } : { status, releasedAt: sql`now()` })
        .where(and(eq(stockReservations.id, id), eq(stockReservations.status, "active")));
    },
    async insertMovement(input) {
      await db.insert(stockMovements).values(input);
    },
  };
}
