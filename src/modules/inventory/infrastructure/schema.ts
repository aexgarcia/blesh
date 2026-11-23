import { sql } from "drizzle-orm";
import { check, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";
import { productVariants } from "../../catalog/infrastructure/schema";

/**
 * Balance por variante (un almacén lógico). `available = on_hand - reserved`.
 * La FK a variantes es solo integridad; inventory nunca lee tablas del catálogo.
 */
export const inventoryBalances = appSchema.table(
  "inventory_balances",
  {
    variantId: uuid()
      .primaryKey()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    onHand: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    version: integer().notNull().default(1),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("inventory_balances_on_hand_check", sql`${t.onHand} >= 0`),
    check("inventory_balances_reserved_check", sql`${t.reserved} >= 0 and ${t.reserved} <= ${t.onHand}`),
  ],
);

/** Historial inmutable: cada cambio de balance deja un movimiento con motivo y actor. */
export const stockMovements = appSchema.table(
  "stock_movements",
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => inventoryBalances.variantId, { onDelete: "restrict" }),
    deltaOnHand: integer().notNull(),
    deltaReserved: integer().notNull().default(0),
    onHandAfter: integer().notNull(),
    reservedAfter: integer().notNull(),
    reason: text().notNull(),
    note: text(),
    orderId: uuid(),
    operationKey: text().notNull(),
    actorId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stock_movements_operation_key").on(t.operationKey),
    index("stock_movements_variant_idx").on(t.variantId, t.createdAt),
    check("stock_movements_nonzero_check", sql`${t.deltaOnHand} <> 0 or ${t.deltaReserved} <> 0`),
    check(
      "stock_movements_reason_check",
      sql`${t.reason} in ('initial_count', 'restock', 'count_correction', 'damage', 'loss', 'other', 'reservation', 'release', 'consumption', 'return_inspected')`,
    ),
    check("stock_movements_note_check", sql`${t.note} is null or char_length(${t.note}) <= 300`),
  ],
);
