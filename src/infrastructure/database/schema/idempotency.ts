import { sql } from "drizzle-orm";
import { check, index, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { appSchema } from "./app-schema";

/**
 * Registro de operaciones idempotentes (solicitudes, pedidos manuales, cobros).
 * `request_hash` permite rechazar la misma clave con una entrada distinta.
 */
export const idempotencyRecords = appSchema.table(
  "idempotency_records",
  {
    scope: text().notNull(),
    key: text().notNull(),
    requestHash: text().notNull(),
    status: text().notNull(),
    resourceId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.key] }),
    check(
      "idempotency_records_status_check",
      sql`${table.status} in ('in_progress', 'completed', 'failed')`,
    ),
    check("idempotency_records_key_length_check", sql`char_length(${table.key}) between 8 and 200`),
    check(
      "idempotency_records_completion_check",
      sql`(${table.status} = 'completed') = (${table.completedAt} is not null)`,
    ),
    index("idempotency_records_expires_idx").on(table.expiresAt),
  ],
);
