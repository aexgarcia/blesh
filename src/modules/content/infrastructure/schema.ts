import { sql } from "drizzle-orm";
import { check, integer, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";

export const storefrontSections = appSchema.table("storefront_sections", {
  key: text().primaryKey(),
  data: jsonb().$type<Record<string, unknown>>().notNull(),
  version: integer().notNull().default(1),
  operationKey: uuid().notNull(),
  fingerprint: text().notNull(),
  updatedBy: uuid().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("storefront_sections_key_check", sql`${t.key} in ('general', 'hero', 'collections', 'pack', 'reels')`), check("storefront_sections_version_check", sql`${t.version} > 0`)]);
