import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import { PackSettingsFailure } from "../application/pack-settings";
import type { PackSettings, PackSettingsInput } from "../contracts";
import { PACK_POLICIES } from "../domain/promotions";
import { packConfig } from "./schema";

const code = "pack-boxy-essential";
export async function readPackSettings(db: AnyDatabase): Promise<PackSettings> {
  const [row] = await db.select().from(packConfig).where(eq(packConfig.code, code));
  return row ? { enabled: row.enabled, policy: row.policy, version: row.version } : { enabled: true, policy: PACK_POLICIES[0], version: 0 };
}

export async function writePackSettingsWithin(db: AnyDatabase, actorId: string, input: PackSettingsInput & { expectedVersion: number; operationKey: string }) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('pack-settings',0))`);
  const [previous] = await db.select().from(packConfig).where(eq(packConfig.code, code));
  const fingerprint = createHash("sha256").update(JSON.stringify({ enabled: input.enabled, label: input.label, productSlugs: input.productSlugs, tierTotalsMinor: input.tierTotalsMinor })).digest("hex");
  if (previous?.operationKey === input.operationKey) {
    if (previous.fingerprint !== fingerprint) throw new PackSettingsFailure("IDEMPOTENCY_CONFLICT", "Este guardado ya se utilizó con otros datos. Recarga la página.");
    return;
  }
  if ((previous?.version ?? 0) !== input.expectedVersion) throw new PackSettingsFailure("VERSION_CONFLICT", "El pack cambió mientras editabas. Recarga antes de guardar.");
  const policy = { ...PACK_POLICIES[0], label: input.label, productSlugs: input.productSlugs, tierTotalsMinor: input.tierTotalsMinor, version: (previous?.policy.version ?? 1) + 1 };
  const row = { policy, enabled: input.enabled, version: input.expectedVersion + 1, operationKey: input.operationKey, fingerprint, updatedBy: actorId, updatedAt: new Date() };
  if (previous) await db.update(packConfig).set(row).where(eq(packConfig.code, code));
  else await db.insert(packConfig).values({ ...row, code });
  await db.insert(auditEvents).values({ actorType: "admin", actorId, action: "sales.pack.updated", resourceType: "pack", resourceId: code, changes: { policyVersion: policy.version, enabled: input.enabled, productSlugs: input.productSlugs, tierTotalsMinor: input.tierTotalsMinor } });
}
