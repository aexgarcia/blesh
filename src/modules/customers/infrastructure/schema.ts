import { sql } from "drizzle-orm";
import { check, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";

/**
 * Fichas básicas de cliente. Teléfono indexado SIN unicidad: varias personas pueden compartirlo.
 * Sin saldos: los importes pertenecen a ventas.
 */
export const customers = appSchema.table(
  "customers",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    phoneNormalized: text().notNull(),
    email: text(),
    status: text().notNull().default("active"),
    version: integer().notNull().default(1),
    /** Clave del formulario de alta: un reintento devuelve la misma ficha. */
    creationKey: uuid(),
    createdBy: uuid().notNull(),
    updatedBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check("customers_status_check", sql`${t.status} in ('active', 'archived')`),
    check("customers_name_length_check", sql`char_length(${t.name}) between 2 and 120`),
    check("customers_phone_format_check", sql`${t.phoneNormalized} ~ '^\\+[1-9][0-9]{7,14}$'`),
    check("customers_email_length_check", sql`${t.email} is null or char_length(${t.email}) between 3 and 254`),
    check("customers_archived_consistency_check", sql`(${t.status} = 'archived') = (${t.archivedAt} is not null)`),
    uniqueIndex("customers_creation_key_key").on(t.creationKey),
    index("customers_phone_idx").on(t.phoneNormalized),
    index("customers_name_idx").on(sql`lower(${t.name})`),
    index("customers_status_updated_idx").on(t.status, t.updatedAt),
  ],
);
