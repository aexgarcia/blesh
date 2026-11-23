import { and, asc, eq, sql } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { Membership, MembershipStore, MembershipTx } from "../application/ports";
import { adminMemberships } from "./schema";

/** Clave fija del advisory lock que serializa todos los cambios de acceso. */
const ACCESS_LOCK_KEY = 0x0b1e5_001;

type Row = typeof adminMemberships.$inferSelect;

function toMembership(row: Row): Membership {
  return {
    id: row.id,
    authSubject: row.authSubject,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    invitedBy: row.invitedBy,
    invitedAt: row.invitedAt,
    activatedAt: row.activatedAt,
    disabledAt: row.disabledAt,
    sessionsRevokedAt: row.sessionsRevokedAt,
    version: row.version,
  };
}

function txOperations(db: AnyDatabase): MembershipTx {
  const one = async (where: ReturnType<typeof eq>) => {
    const [row] = await db.select().from(adminMemberships).where(where).limit(1);
    return row ? toMembership(row) : null;
  };
  return {
    async list() {
      const rows = await db.select().from(adminMemberships).orderBy(asc(adminMemberships.invitedAt), asc(adminMemberships.id));
      return rows.map(toMembership);
    },
    findById: (id) => one(eq(adminMemberships.id, id)),
    findByEmail: (email) => one(eq(adminMemberships.email, email)),
    findBySubject: (subject) => one(eq(adminMemberships.authSubject, subject)),
    async insert(input) {
      const [row] = await db.insert(adminMemberships).values(input).returning();
      return toMembership(row);
    },
    async update(id, patch, expectedVersion) {
      const where =
        expectedVersion === undefined
          ? eq(adminMemberships.id, id)
          : and(eq(adminMemberships.id, id), eq(adminMemberships.version, expectedVersion));
      const [row] = await db
        .update(adminMemberships)
        .set({ ...patch, version: sql`${adminMemberships.version} + 1`, updatedAt: sql`now()` })
        .where(where)
        .returning();
      return row ? toMembership(row) : null;
    },
    async delete(id) {
      await db.delete(adminMemberships).where(eq(adminMemberships.id, id));
    },
    async audit(entry) {
      await db.insert(auditEvents).values({
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        resourceType: "admin_membership",
        resourceId: entry.resourceId,
        changes: entry.changes ?? null,
        reason: entry.reason ?? null,
      });
    },
  };
}

export function createMembershipStore(db: AnyDatabase): MembershipStore {
  const reader = txOperations(db);
  return {
    withAccessLock(fn) {
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${ACCESS_LOCK_KEY})`);
        return fn(txOperations(tx as unknown as AnyDatabase));
      });
    },
    findBySubject: reader.findBySubject,
    list: reader.list,
  };
}
