import { sql } from "drizzle-orm";
import { check, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";

/**
 * Membresía administrativa local. El rol se decide aquí, nunca por metadata editable
 * del proveedor de Auth. `auth_subject` es el id del usuario en el proveedor.
 */
export const adminMemberships = appSchema.table(
  "admin_memberships",
  {
    id: uuid().primaryKey().defaultRandom(),
    authSubject: uuid().notNull(),
    email: text().notNull(),
    displayName: text().notNull(),
    role: text().$type<"owner" | "operator">().notNull(),
    status: text().$type<"invited" | "active" | "disabled">().notNull(),
    invitedBy: uuid(),
    invitedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp({ withTimezone: true }),
    disabledAt: timestamp({ withTimezone: true }),
    sessionsRevokedAt: timestamp({ withTimezone: true }),
    version: integer().notNull().default(1),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_memberships_auth_subject_key").on(t.authSubject),
    uniqueIndex("admin_memberships_email_key").on(t.email),
    index("admin_memberships_role_status_idx").on(t.role, t.status),
    check("admin_memberships_role_check", sql`${t.role} in ('owner', 'operator')`),
    check("admin_memberships_status_check", sql`${t.status} in ('invited', 'active', 'disabled')`),
    check("admin_memberships_email_check", sql`${t.email} = lower(${t.email}) and position('@' in ${t.email}) > 1`),
    check("admin_memberships_name_check", sql`char_length(${t.displayName}) between 1 and 80`),
    check("admin_memberships_activated_check", sql`${t.status} <> 'active' or ${t.activatedAt} is not null`),
  ],
);
