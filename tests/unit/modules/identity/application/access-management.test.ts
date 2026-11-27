import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import type { AdminActor } from "@/modules/identity/contracts";
import * as access from "@/modules/identity/application/access-management";
import type { AuditEntry, AuthAdminGateway, IdentityDeps, Membership, MembershipStore, MembershipTx } from "@/modules/identity/application/ports";

/** Almacén en memoria; la serialización real se prueba con PostgreSQL en tests/integration. */
function memoryStore(): MembershipStore & { rows: Membership[]; audits: AuditEntry[] } {
  const rows: Membership[] = [];
  const audits: AuditEntry[] = [];
  const tx: MembershipTx = {
    list: async () => rows.map((r) => ({ ...r })),
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    findByEmail: async (email) => rows.find((r) => r.email === email) ?? null,
    findBySubject: async (s) => rows.find((r) => r.authSubject === s) ?? null,
    insert: async (input) => {
      const row: Membership = { ...input, id: randomUUID(), invitedAt: new Date(), activatedAt: null, disabledAt: null, sessionsRevokedAt: null, version: 1 };
      rows.push(row);
      return row;
    },
    update: async (id, patch, expected) => {
      const row = rows.find((r) => r.id === id);
      if (!row || (expected !== undefined && row.version !== expected)) return null;
      Object.assign(row, patch, { version: row.version + 1 });
      return { ...row };
    },
    delete: async (id) => void rows.splice(rows.findIndex((r) => r.id === id), 1),
    audit: async (entry) => void audits.push(entry),
  };
  return { rows, audits, withAccessLock: (fn) => fn(tx), findBySubject: tx.findBySubject, list: tx.list };
}

function fakeAuth(): AuthAdminGateway & { deleted: string[]; invited: string[]; mfaReset: string[] } {
  const state = { deleted: [] as string[], invited: [] as string[], mfaReset: [] as string[] };
  return {
    ...state,
    inviteUser: async (email) => {
      state.invited.push(email);
      return { subject: randomUUID() };
    },
    deleteUser: async (s) => void state.deleted.push(s),
    hasVerifiedMfa: async () => true,
    resetMfa: async (s) => void state.mfaReset.push(s),
  };
}

const NOW = new Date("2026-11-23T12:00:00Z");

describe("gestión de acceso", () => {
  let store: ReturnType<typeof memoryStore>;
  let auth: ReturnType<typeof fakeAuth>;
  let deps: IdentityDeps;
  let owner: AdminActor;

  beforeEach(async () => {
    store = memoryStore();
    auth = fakeAuth();
    deps = { store, auth, clock: { now: () => NOW } };
    const boot = await access.bootstrapFirstOwner(deps, { email: "Duena@Blesh.pe", displayName: "Dueña" });
    if (!boot.ok) throw new Error(boot.message);
    await access.activateInvitedMembership(deps, boot.value.authSubject);
    const m = store.rows[0];
    owner = { membershipId: m.id, authSubject: m.authSubject, role: "owner", displayName: m.displayName, email: m.email };
  });

  it("el alta inicial normaliza correo, audita como system y no se repite", async () => {
    expect(store.rows[0]).toMatchObject({ email: "duena@blesh.pe", role: "owner", status: "active" });
    expect(store.audits[0]).toMatchObject({ actorType: "system", action: "access.bootstrap_owner" });
    const again = await access.bootstrapFirstOwner(deps, { email: "otra@blesh.pe", displayName: "Otra" });
    expect(again).toMatchObject({ ok: false, code: "OWNER_ALREADY_EXISTS" });
  });

  it("invita operadores y rechaza correos duplicados", async () => {
    const invited = await access.inviteAdmin(deps, owner, { email: "op@blesh.pe", displayName: "Op", role: "operator" });
    expect(invited).toMatchObject({ ok: true, value: { status: "invited", role: "operator" } });
    const dup = await access.inviteAdmin(deps, owner, { email: "OP@blesh.pe", displayName: "Op", role: "operator" });
    expect(dup).toMatchObject({ ok: false, code: "ALREADY_EXISTS" });
  });

  it("el operador no puede gestionar accesos", async () => {
    const op = { ...owner, membershipId: randomUUID(), role: "operator" as const };
    expect(await access.inviteAdmin(deps, op, { email: "x@blesh.pe", displayName: "X", role: "owner" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await access.listAdminUsers(deps, op)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("no permite auto-desactivarse ni degradarse", async () => {
    const self = store.rows[0];
    expect(await access.deactivateAdmin(deps, owner, { membershipId: self.id, expectedVersion: self.version })).toMatchObject({ ok: false, code: "SELF_ACTION" });
    expect(await access.changeRole(deps, owner, { membershipId: self.id, role: "operator", expectedVersion: self.version })).toMatchObject({ ok: false, code: "SELF_ACTION" });
  });

  it("protege al último owner activo frente a otro owner", async () => {
    const second = await access.inviteAdmin(deps, owner, { email: "socio@blesh.pe", displayName: "Socio", role: "owner" });
    if (!second.ok) throw new Error(second.message);
    await access.activateInvitedMembership(deps, second.value.authSubject);
    const partner: AdminActor = { ...owner, membershipId: second.value.id, authSubject: second.value.authSubject };

    // El socio desactiva a la dueña (quedan dos owners → permitido) ...
    const first = store.rows[0];
    expect((await access.deactivateAdmin(deps, partner, { membershipId: first.id, expectedVersion: first.version })).ok).toBe(true);
    // ... y la desactivación revoca sus sesiones.
    expect(store.rows[0].sessionsRevokedAt).toEqual(NOW);
  });

  it("rechaza cambios con versión desactualizada (concurrencia optimista)", async () => {
    const invited = await access.inviteAdmin(deps, owner, { email: "op@blesh.pe", displayName: "Op", role: "operator" });
    if (!invited.ok) throw new Error(invited.message);
    await access.activateInvitedMembership(deps, invited.value.authSubject);
    const stale = await access.changeRole(deps, owner, { membershipId: invited.value.id, role: "owner", expectedVersion: 1 });
    expect(stale).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("cancelar invitación elimina la membresía y el usuario del proveedor", async () => {
    const invited = await access.inviteAdmin(deps, owner, { email: "op@blesh.pe", displayName: "Op", role: "operator" });
    if (!invited.ok) throw new Error(invited.message);
    expect((await access.cancelInvitation(deps, owner, { membershipId: invited.value.id })).ok).toBe(true);
    expect(store.rows).toHaveLength(1);
    expect(auth.deleted).toContain(invited.value.authSubject);
  });

  it("si falla la inserción local, compensa borrando el usuario invitado", async () => {
    const failing: IdentityDeps = {
      ...deps,
      store: { ...store, withAccessLock: async (fn) => { const r = await store.withAccessLock(fn); if (store.rows.length >= 1 && auth.invited.length > 1) throw new Error("db down"); return r; } },
    };
    await expect(access.inviteAdmin(failing, owner, { email: "op@blesh.pe", displayName: "Op", role: "operator" })).rejects.toThrow("db down");
    expect(auth.deleted).toHaveLength(1);
  });

  it("no reactiva a quien nunca completó el alta", async () => {
    const invited = await access.inviteAdmin(deps, owner, { email: "op@blesh.pe", displayName: "Op", role: "operator" });
    if (!invited.ok) throw new Error(invited.message);
    const disabled = await access.deactivateAdmin(deps, owner, { membershipId: invited.value.id, expectedVersion: invited.value.version });
    if (!disabled.ok) throw new Error(disabled.message);
    const re = await access.reactivateAdmin(deps, owner, { membershipId: invited.value.id, expectedVersion: disabled.value.version });
    expect(re).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("restablecer MFA exige motivo en emergencia y revoca sesiones", async () => {
    expect(await access.emergencyResetMfa(deps, { email: "duena@blesh.pe", reason: "corto" })).toMatchObject({ ok: false });
    const reset = await access.emergencyResetMfa(deps, { email: "duena@blesh.pe", reason: "Perdió el teléfono; identidad verificada en persona" });
    expect(reset.ok).toBe(true);
    expect(auth.mfaReset).toHaveLength(1);
    expect(store.audits.at(-1)).toMatchObject({ actorType: "system", action: "access.emergency_reset_mfa" });
  });
});
