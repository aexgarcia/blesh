import type { AdminRole, MembershipStatus } from "../contracts";

export class IdentityRuleError extends Error {
  constructor(
    readonly code: "LAST_OWNER" | "SELF_ACTION" | "INVALID_STATE",
    message: string,
  ) {
    super(message);
    this.name = "IdentityRuleError";
  }
}

type MembershipSnapshot = { id: string; role: AdminRole; status: MembershipStatus };

/** Un owner "efectivo" es el que puede administrar ahora mismo. */
export function isEffectiveOwner(m: MembershipSnapshot): boolean {
  return m.role === "owner" && m.status === "active";
}

/**
 * Garantiza que tras aplicar `next` a la membresía `targetId` quede al menos un owner activo.
 * `owners` debe leerse bajo bloqueo (FOR UPDATE) dentro de la misma transacción.
 */
export function assertOwnerRemains(
  owners: readonly MembershipSnapshot[],
  targetId: string,
  next: Pick<MembershipSnapshot, "role" | "status">,
): void {
  const remaining = owners.filter((o) => o.id !== targetId && isEffectiveOwner(o)).length;
  const targetStays = next.role === "owner" && next.status === "active";
  if (remaining === 0 && !targetStays) {
    throw new IdentityRuleError("LAST_OWNER", "Debe quedar al menos un propietario activo.");
  }
}

const transitions: Record<MembershipStatus, readonly MembershipStatus[]> = {
  invited: ["active", "disabled"],
  active: ["disabled"],
  disabled: ["active"],
};

export function assertTransition(from: MembershipStatus, to: MembershipStatus): void {
  if (!transitions[from].includes(to)) {
    throw new IdentityRuleError("INVALID_STATE", `Transición no permitida: ${from} → ${to}.`);
  }
}

/** Acciones que un usuario no puede aplicarse a sí mismo (evita bloquearse por accidente). */
export function assertNotSelf(actorMembershipId: string, targetId: string): void {
  if (actorMembershipId === targetId) {
    throw new IdentityRuleError("SELF_ACTION", "No puedes aplicar esta acción a tu propia cuenta.");
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
