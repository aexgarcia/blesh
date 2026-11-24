import { sql } from "drizzle-orm";
import { check, index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "./app-schema";

/**
 * Historial de acciones sensibles. Solo inserción para el rol runtime.
 * No guardar teléfono, dirección completa, tokens ni claves de idempotencia en `changes`.
 */
export const auditEvents = appSchema.table(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorType: text().notNull(),
    actorId: text(),
    action: text().notNull(),
    resourceType: text().notNull(),
    resourceId: text(),
    changes: jsonb().$type<Record<string, unknown>>(),
    reason: text(),
    requestId: text(),
  },
  (table) => [
    check("audit_events_actor_type_check", sql`${table.actorType} in ('admin', 'system')`),
    check("audit_events_action_length_check", sql`char_length(${table.action}) between 1 and 100`),
    index("audit_events_resource_idx").on(table.resourceType, table.resourceId, table.occurredAt),
    index("audit_events_actor_idx").on(table.actorId, table.occurredAt),
  ],
);
