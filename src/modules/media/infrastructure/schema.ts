import { sql } from "drizzle-orm";
import { bigint, check, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { appSchema } from "../../../infrastructure/database/schema/app-schema";

/** Archivos validados por el servidor. Solo `ready` se referencia desde el catálogo. */
export const mediaAssets = appSchema.table(
  "media_assets",
  {
    id: uuid().primaryKey().defaultRandom(),
    objectKey: text().notNull(),
    mime: text().notNull(),
    bytes: bigint({ mode: "number" }).notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    status: text().$type<"ready" | "rejected">().notNull().default("ready"),
    createdBy: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("media_assets_object_key_key").on(t.objectKey),
    check("media_assets_mime_check", sql`${t.mime} in ('image/webp')`),
    check("media_assets_status_check", sql`${t.status} in ('ready', 'rejected')`),
    check("media_assets_dimensions_check", sql`${t.width} > 0 and ${t.height} > 0 and ${t.bytes} > 0`),
  ],
);
