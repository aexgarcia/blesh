import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import { SectionFailure, type SectionStore } from "../application/section-settings";
import { storefrontSections } from "./schema";

export async function readSections(db: AnyDatabase) {
  return db.select().from(storefrontSections);
}

/** Requiere transacción del llamador: edición/versiones/auditoría forman una sola escritura. */
export function sectionStoreWithin(db: AnyDatabase): SectionStore {
  return { async save(input) {
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`storefront-section:${input.key}`},0))`);
    const [previous] = await db.select().from(storefrontSections).where(eq(storefrontSections.key, input.key));
    const fingerprint = createHash("sha256").update(JSON.stringify(input.data)).digest("hex");
    if (previous?.operationKey === input.operationKey) {
      if (previous.fingerprint !== fingerprint) throw new SectionFailure("IDEMPOTENCY_CONFLICT", "Este guardado ya se utilizó con otros datos. Recarga la página.");
      return;
    }
    if ((previous?.version ?? 0) !== input.expectedVersion) throw new SectionFailure("VERSION_CONFLICT", "Otra persona modificó esta sección. Recarga antes de guardar.");
    const row = { data: input.data, version: input.expectedVersion + 1, operationKey: input.operationKey, fingerprint, updatedBy: input.actorId, updatedAt: new Date() };
    if (previous) await db.update(storefrontSections).set(row).where(eq(storefrontSections.key, input.key));
    else await db.insert(storefrontSections).values({ ...row, key: input.key });
    await db.insert(auditEvents).values({ actorType: "admin", actorId: input.actorId, action: `content.${input.key}.updated`, resourceType: "storefront_section", resourceId: input.key, changes: { version: row.version, fields: Object.keys(input.data) } });
  } };
}
