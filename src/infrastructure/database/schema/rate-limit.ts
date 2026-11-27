import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { appSchema } from "./app-schema";

/**
 * Contadores de límite de tasa por ventana fija, compartidos entre instancias (operacion.md:
 * no un contador en memoria de la función). `bucket` = ámbito + huella del cliente; nunca la
 * IP en claro. Filas efímeras: se purgan al vencer.
 */
export const rateLimitCounters = appSchema.table(
  "rate_limit_counters",
  {
    bucket: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    hits: integer().notNull().default(1),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bucket, t.windowStart] }),
    index("rate_limit_counters_expires_idx").on(t.expiresAt),
    check("rate_limit_counters_hits_check", sql`${t.hits} > 0`),
    check("rate_limit_counters_bucket_check", sql`char_length(${t.bucket}) between 8 and 200`),
  ],
);
