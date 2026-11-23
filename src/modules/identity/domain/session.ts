import type { MembershipStatus } from "../contracts";

/** Claims mínimos de una sesión verificada por el proveedor. */
export type VerifiedSessionClaims = {
  subject: string;
  /** Nivel actual: aal1 (contraseña) o aal2 (contraseña + TOTP). */
  assuranceLevel: "aal1" | "aal2";
  /** Momento del primer factor (segundos UNIX); se conserva al refrescar el token. */
  authenticatedAt: number;
};

export type MembershipForSession = {
  status: MembershipStatus;
  sessionsRevokedAt: Date | null;
};

export type SessionDecision =
  | { kind: "allowed" }
  | { kind: "needs_mfa" }
  | { kind: "revoked" }
  | { kind: "not_admin" };

/**
 * Decide si una sesión autenticada puede operar la administración.
 * Una sesión iniciada antes de `sessionsRevokedAt` queda inválida aunque se refresque,
 * y una membresía desactivada bloquea al instante (se consulta en cada petición).
 */
export function decideAdminSession(
  claims: VerifiedSessionClaims,
  membership: MembershipForSession | null,
  options: { allowInvited?: boolean; requireMfa?: boolean } = {},
): SessionDecision {
  if (!membership) return { kind: "not_admin" };
  const allowedStatus = membership.status === "active" || (options.allowInvited && membership.status === "invited");
  if (!allowedStatus) return { kind: "not_admin" };

  if (membership.sessionsRevokedAt) {
    const revokedAtSeconds = Math.floor(membership.sessionsRevokedAt.getTime() / 1000);
    if (claims.authenticatedAt <= revokedAtSeconds) return { kind: "revoked" };
  }

  if ((options.requireMfa ?? true) && claims.assuranceLevel !== "aal2") return { kind: "needs_mfa" };
  return { kind: "allowed" };
}
