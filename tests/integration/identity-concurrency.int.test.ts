/**
 * Reglas de acceso sobre PostgreSQL real con transacciones concurrentes.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import * as access from "@/modules/identity/application/access-management";
import type { AuthAdminGateway, IdentityDeps } from "@/modules/identity/application/ports";
import type { AdminActor } from "@/modules/identity/contracts";
import { createMembershipStore } from "@/modules/identity/infrastructure/membership-store";

import { openTestDb, resetTables } from "../support/test-db";

const { sql, db } = openTestDb();
const auth: AuthAdminGateway = {
  inviteUser: async () => ({ subject: randomUUID() }),
  deleteUser: async () => undefined,
  hasVerifiedMfa: async () => true,
  resetMfa: async () => undefined,
};
const deps: IdentityDeps = { store: createMembershipStore(db), auth, clock: { now: () => new Date() } };

async function activeOwner(email: string): Promise<AdminActor> {
  const invited = await access.inviteAdmin(deps, systemOwner, { email, displayName: email, role: "owner" });
  if (!invited.ok) throw new Error(invited.message);
  const active = await access.activateInvitedMembership(deps, invited.value.authSubject);
  if (!active.ok) throw new Error(active.message);
  return { membershipId: active.value.id, authSubject: active.value.authSubject, role: "owner", displayName: email, email };
}

let systemOwner: AdminActor;

beforeEach(async () => {
  await resetTables(["admin_memberships", "audit_events"]);
  const boot = await access.bootstrapFirstOwner(deps, { email: "root@blesh.test", displayName: "Root" });
  if (!boot.ok) throw new Error(boot.message);
  await access.activateInvitedMembership(deps, boot.value.authSubject);
  systemOwner = { membershipId: boot.value.id, authSubject: boot.value.authSubject, role: "owner", displayName: "Root", email: "root@blesh.test" };
});

afterAll(async () => {
  await sql.end();
});

const ownerCount = async () =>
  (await sql<{ n: number }[]>`select count(*)::int as n from app.admin_memberships where role = 'owner' and status = 'active'`)[0].n;

describe("identity sobre PostgreSQL real", () => {
  it("dos propietarios que se desactivan mutuamente a la vez: solo uno lo consigue", async () => {
    for (let round = 0; round < 5; round++) {
      await resetTables(["admin_memberships", "audit_events"]);
      const a = await (async () => {
        const boot = await access.bootstrapFirstOwner(deps, { email: `a${round}@blesh.test`, displayName: "A" });
        if (!boot.ok) throw new Error(boot.message);
        const act = await access.activateInvitedMembership(deps, boot.value.authSubject);
        if (!act.ok) throw new Error(act.message);
        return { membershipId: act.value.id, authSubject: act.value.authSubject, role: "owner" as const, displayName: "A", email: "a" };
      })();
      systemOwner = a;
      const b = await activeOwner(`b${round}@blesh.test`);
      const [rowA] = await sql<{ version: number }[]>`select version from app.admin_memberships where id = ${a.membershipId}`;
      const [rowB] = await sql<{ version: number }[]>`select version from app.admin_memberships where id = ${b.membershipId}`;

      const results = await Promise.all([
        access.deactivateAdmin(deps, a, { membershipId: b.membershipId, expectedVersion: rowB.version }),
        access.deactivateAdmin(deps, b, { membershipId: a.membershipId, expectedVersion: rowA.version }),
      ]);

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, code: expect.stringMatching(/LAST_OWNER|INVALID_STATE/) });
      expect(await ownerCount()).toBe(1);
    }
  });

  it("degradaciones concurrentes de dos owners nunca dejan cero propietarios", async () => {
    const b = await activeOwner("b@blesh.test");
    const c = await activeOwner("c@blesh.test");
    const versions = await sql<{ id: string; version: number }[]>`select id, version from app.admin_memberships`;
    const v = (id: string) => versions.find((r) => r.id === id)!.version;

    // Root degrada a B y a C, mientras B degrada a Root: como mucho dos cambios prosperan.
    const results = await Promise.all([
      access.changeRole(deps, systemOwner, { membershipId: b.membershipId, role: "operator", expectedVersion: v(b.membershipId) }),
      access.changeRole(deps, systemOwner, { membershipId: c.membershipId, role: "operator", expectedVersion: v(c.membershipId) }),
      access.changeRole(deps, b, { membershipId: systemOwner.membershipId, role: "operator", expectedVersion: v(systemOwner.membershipId) }),
    ]);
    expect(results.some((r) => r.ok)).toBe(true);
    expect(await ownerCount()).toBeGreaterThanOrEqual(1);
  });

  it("el alta inicial concurrente crea un único propietario", async () => {
    await resetTables(["admin_memberships", "audit_events"]);
    const results = await Promise.all(
      [1, 2, 3].map((i) => access.bootstrapFirstOwner(deps, { email: `owner${i}@blesh.test`, displayName: `Owner ${i}` })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.admin_memberships where role = 'owner'`;
    expect(n).toBe(1);
  });

  it("cada cambio de acceso deja auditoría en la misma transacción, sin correos", async () => {
    const b = await activeOwner("audit@blesh.test");
    const [row] = await sql<{ version: number }[]>`select version from app.admin_memberships where id = ${b.membershipId}`;
    const result = await access.deactivateAdmin(deps, systemOwner, { membershipId: b.membershipId, expectedVersion: row.version, reason: "Fin de contrato" });
    expect(result.ok).toBe(true);
    const audits = await sql<{ action: string; actor_id: string | null; reason: string | null; changes: unknown }[]>`
      select action, actor_id, reason, changes from app.audit_events where resource_id = ${b.membershipId} order by occurred_at`;
    expect(audits.map((a) => a.action)).toEqual(["access.invite", "access.activate", "access.deactivate"]);
    expect(audits.at(-1)).toMatchObject({ actor_id: systemOwner.membershipId, reason: "Fin de contrato" });
    expect(JSON.stringify(audits)).not.toContain("audit@blesh.test");
  });
});
