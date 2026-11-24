import type { AdminActor, AdminRole, AdminUserSummary } from "../contracts";
import { assertNotSelf, assertOwnerRemains, assertTransition, normalizeEmail } from "../domain/membership";
import { roleCan } from "../domain/permissions";
import type { IdentityDeps, Membership, MembershipTx } from "./ports";
import { IdentityFailure, toResult, type Result } from "./result";

function requireAccessManager(actor: AdminActor) {
  if (!roleCan(actor.role, "access.manage")) {
    throw new IdentityFailure("FORBIDDEN", "Solo el propietario gestiona el acceso.");
  }
}

async function loadTarget(tx: MembershipTx, id: string): Promise<Membership> {
  const target = await tx.findById(id);
  if (!target) throw new IdentityFailure("NOT_FOUND", "El usuario no existe.");
  return target;
}

async function saveOrConflict(tx: MembershipTx, id: string, patch: Parameters<MembershipTx["update"]>[1], version: number) {
  const updated = await tx.update(id, patch, version);
  if (!updated) throw new IdentityFailure("INVALID_STATE", "El usuario cambió mientras tanto. Recarga e inténtalo de nuevo.");
  return updated;
}

const actorRef = (actor: AdminActor) => ({ actorType: "admin" as const, actorId: actor.membershipId });

export type InviteInput = { email: string; displayName: string; role: AdminRole };

/**
 * Invita a un administrador. El usuario del proveedor se crea antes de la transacción;
 * si la inserción local falla, se elimina para no dejar cuentas huérfanas.
 */
export function inviteAdmin(deps: IdentityDeps, actor: AdminActor, input: InviteInput): Promise<Result<Membership>> {
  return toResult(async () => {
    requireAccessManager(actor);
    const email = normalizeEmail(input.email);
    const existing = await deps.store.withAccessLock((tx) => tx.findByEmail(email));
    if (existing) throw new IdentityFailure("ALREADY_EXISTS", "Ya existe un usuario con ese correo.");

    const { subject } = await deps.auth.inviteUser(email);
    try {
      return await deps.store.withAccessLock(async (tx) => {
        if (await tx.findByEmail(email)) throw new IdentityFailure("ALREADY_EXISTS", "Ya existe un usuario con ese correo.");
        const created = await tx.insert({
          authSubject: subject,
          email,
          displayName: input.displayName.trim(),
          role: input.role,
          status: "invited",
          invitedBy: actor.membershipId,
        });
        await tx.audit({ ...actorRef(actor), action: "access.invite", resourceId: created.id, changes: { role: input.role } });
        return created;
      });
    } catch (error) {
      await deps.auth.deleteUser(subject).catch(() => undefined);
      throw error;
    }
  });
}

export function changeRole(
  deps: IdentityDeps,
  actor: AdminActor,
  input: { membershipId: string; role: AdminRole; expectedVersion: number },
): Promise<Result<Membership>> {
  return toResult(() =>
    deps.store.withAccessLock(async (tx) => {
      requireAccessManager(actor);
      assertNotSelf(actor.membershipId, input.membershipId);
      const target = await loadTarget(tx, input.membershipId);
      if (target.role === input.role) return target;
      assertOwnerRemains(await tx.list(), target.id, { role: input.role, status: target.status });
      // Cambiar rol invalida las sesiones abiertas para aplicar permisos nuevos desde cero.
      const updated = await saveOrConflict(tx, target.id, { role: input.role, sessionsRevokedAt: deps.clock.now() }, input.expectedVersion);
      await tx.audit({ ...actorRef(actor), action: "access.change_role", resourceId: target.id, changes: { from: target.role, to: input.role } });
      return updated;
    }),
  );
}

export function deactivateAdmin(
  deps: IdentityDeps,
  actor: AdminActor,
  input: { membershipId: string; expectedVersion: number; reason?: string | null },
): Promise<Result<Membership>> {
  return toResult(() =>
    deps.store.withAccessLock(async (tx) => {
      requireAccessManager(actor);
      assertNotSelf(actor.membershipId, input.membershipId);
      const target = await loadTarget(tx, input.membershipId);
      assertTransition(target.status, "disabled");
      assertOwnerRemains(await tx.list(), target.id, { role: target.role, status: "disabled" });
      const now = deps.clock.now();
      const updated = await saveOrConflict(tx, target.id, { status: "disabled", disabledAt: now, sessionsRevokedAt: now }, input.expectedVersion);
      await tx.audit({ ...actorRef(actor), action: "access.deactivate", resourceId: target.id, changes: { from: target.status }, reason: input.reason ?? null });
      return updated;
    }),
  );
}

export function reactivateAdmin(
  deps: IdentityDeps,
  actor: AdminActor,
  input: { membershipId: string; expectedVersion: number },
): Promise<Result<Membership>> {
  return toResult(() =>
    deps.store.withAccessLock(async (tx) => {
      requireAccessManager(actor);
      const target = await loadTarget(tx, input.membershipId);
      assertTransition(target.status, "active");
      if (target.status === "disabled" && !target.activatedAt) {
        throw new IdentityFailure("INVALID_STATE", "Nunca completó su alta: reenvía una invitación en su lugar.");
      }
      // sessionsRevokedAt se conserva: las sesiones anteriores a la desactivación siguen inválidas.
      const updated = await saveOrConflict(tx, target.id, { status: "active", disabledAt: null }, input.expectedVersion);
      await tx.audit({ ...actorRef(actor), action: "access.reactivate", resourceId: target.id });
      return updated;
    }),
  );
}

export function revokeSessions(deps: IdentityDeps, actor: AdminActor, input: { membershipId: string }): Promise<Result<Membership>> {
  return toResult(() =>
    deps.store.withAccessLock(async (tx) => {
      requireAccessManager(actor);
      const target = await loadTarget(tx, input.membershipId);
      const updated = await saveOrConflict(tx, target.id, { sessionsRevokedAt: deps.clock.now() }, target.version);
      await tx.audit({ ...actorRef(actor), action: "access.revoke_sessions", resourceId: target.id });
      return updated;
    }),
  );
}

/** Restablece MFA de otro usuario: deberá enrolar de nuevo al iniciar sesión. */
export function resetAdminMfa(
  deps: IdentityDeps,
  actor: AdminActor,
  input: { membershipId: string; reason: string },
): Promise<Result<Membership>> {
  return toResult(async () => {
    requireAccessManager(actor);
    assertNotSelf(actor.membershipId, input.membershipId);
    const target = await deps.store.withAccessLock((tx) => loadTarget(tx, input.membershipId));
    await deps.auth.resetMfa(target.authSubject);
    return deps.store.withAccessLock(async (tx) => {
      const current = await loadTarget(tx, input.membershipId);
      const updated = await saveOrConflict(tx, current.id, { sessionsRevokedAt: deps.clock.now() }, current.version);
      await tx.audit({ ...actorRef(actor), action: "access.reset_mfa", resourceId: current.id, reason: input.reason });
      return updated;
    });
  });
}

export function cancelInvitation(deps: IdentityDeps, actor: AdminActor, input: { membershipId: string }): Promise<Result<void>> {
  return toResult(async () => {
    requireAccessManager(actor);
    const subject = await deps.store.withAccessLock(async (tx) => {
      const target = await loadTarget(tx, input.membershipId);
      if (target.status !== "invited") throw new IdentityFailure("INVALID_STATE", "Solo se cancelan invitaciones pendientes.");
      await tx.delete(target.id);
      await tx.audit({ ...actorRef(actor), action: "access.cancel_invitation", resourceId: target.id });
      return target.authSubject;
    });
    await deps.auth.deleteUser(subject);
  });
}

/** Reemite la invitación: elimina el usuario pendiente del proveedor y crea uno nuevo (enlace anterior inválido). */
export function resendInvitation(deps: IdentityDeps, actor: AdminActor, input: { membershipId: string }): Promise<Result<Membership>> {
  return toResult(async () => {
    requireAccessManager(actor);
    const target = await deps.store.withAccessLock((tx) => loadTarget(tx, input.membershipId));
    if (target.status !== "invited") throw new IdentityFailure("INVALID_STATE", "Solo se reenvían invitaciones pendientes.");
    await deps.auth.deleteUser(target.authSubject);
    const { subject } = await deps.auth.inviteUser(target.email);
    return deps.store.withAccessLock(async (tx) => {
      const current = await loadTarget(tx, target.id);
      const updated = await saveOrConflict(tx, current.id, { authSubject: subject }, current.version);
      await tx.audit({ ...actorRef(actor), action: "access.resend_invitation", resourceId: current.id });
      return updated;
    });
  });
}

/** El invitado completa su alta (contraseña + MFA verificados): pasa a activo. */
export function activateInvitedMembership(deps: IdentityDeps, subject: string): Promise<Result<Membership>> {
  return toResult(() =>
    deps.store.withAccessLock(async (tx) => {
      const target = await tx.findBySubject(subject);
      if (!target) throw new IdentityFailure("NOT_FOUND", "No tienes acceso a la administración.");
      if (target.status === "active") return target;
      assertTransition(target.status, "active");
      const updated = await saveOrConflict(tx, target.id, { status: "active", activatedAt: deps.clock.now() }, target.version);
      await tx.audit({ actorType: "admin", actorId: target.id, action: "access.activate", resourceId: target.id });
      return updated;
    }),
  );
}

/** Alta controlada del primer propietario (script de operación). Falla si ya existe alguno. */
export function bootstrapFirstOwner(deps: IdentityDeps, input: { email: string; displayName: string }): Promise<Result<Membership>> {
  return toResult(async () => {
    const email = normalizeEmail(input.email);
    const hasOwner = await deps.store.withAccessLock(async (tx) =>
      (await tx.list()).some((m) => m.role === "owner" && m.status !== "disabled"),
    );
    if (hasOwner) throw new IdentityFailure("OWNER_ALREADY_EXISTS", "Ya existe un propietario; usa Gestión de acceso.");

    const { subject } = await deps.auth.inviteUser(email);
    try {
      return await deps.store.withAccessLock(async (tx) => {
        const members = await tx.list();
        if (members.some((m) => m.role === "owner" && m.status !== "disabled")) {
          throw new IdentityFailure("OWNER_ALREADY_EXISTS", "Ya existe un propietario; usa Gestión de acceso.");
        }
        if (members.some((m) => m.email === email)) throw new IdentityFailure("ALREADY_EXISTS", "Ya existe un usuario con ese correo.");
        const created = await tx.insert({
          authSubject: subject,
          email,
          displayName: input.displayName.trim(),
          role: "owner",
          status: "invited",
          invitedBy: null,
        });
        await tx.audit({ actorType: "system", actorId: null, action: "access.bootstrap_owner", resourceId: created.id, changes: { role: "owner" } });
        return created;
      });
    } catch (error) {
      await deps.auth.deleteUser(subject).catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Procedimiento de emergencia (script con clave secreta) cuando ningún propietario puede
 * restablecer la verificación de otro, p. ej. el único propietario perdió su dispositivo.
 * Requiere verificación de identidad fuera del sistema; queda auditado como `system`.
 */
export function emergencyResetMfa(deps: IdentityDeps, input: { email: string; reason: string }): Promise<Result<Membership>> {
  return toResult(async () => {
    if (input.reason.trim().length < 10) throw new IdentityFailure("INVALID_STATE", "Indica un motivo detallado (mínimo 10 caracteres).");
    const target = await deps.store.withAccessLock((tx) => tx.findByEmail(normalizeEmail(input.email)));
    if (!target) throw new IdentityFailure("NOT_FOUND", "No existe un usuario con ese correo.");
    await deps.auth.resetMfa(target.authSubject);
    return deps.store.withAccessLock(async (tx) => {
      const current = await loadTarget(tx, target.id);
      const updated = await saveOrConflict(tx, current.id, { sessionsRevokedAt: deps.clock.now() }, current.version);
      await tx.audit({ actorType: "system", actorId: null, action: "access.emergency_reset_mfa", resourceId: current.id, reason: input.reason.trim() });
      return updated;
    });
  });
}

export function listAdminUsers(deps: IdentityDeps, actor: AdminActor): Promise<Result<AdminUserSummary[]>> {
  return toResult(async () => {
    requireAccessManager(actor);
    const members = await deps.store.list();
    const mfa = await Promise.all(members.map((m) => deps.auth.hasVerifiedMfa(m.authSubject).catch(() => null)));
    return members.map((m, i) => ({
      membershipId: m.id,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      status: m.status,
      mfaEnrolled: mfa[i],
      invitedAt: m.invitedAt.toISOString(),
      activatedAt: m.activatedAt?.toISOString() ?? null,
      sessionsRevokedAt: m.sessionsRevokedAt?.toISOString() ?? null,
      isCurrentUser: m.id === actor.membershipId,
      version: m.version,
    }));
  });
}
