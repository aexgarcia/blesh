import { describe, expect, it } from "vitest";

import { assertOwnerRemains, assertTransition, IdentityRuleError } from "@/modules/identity/domain/membership";
import { roleCan } from "@/modules/identity/domain/permissions";
import { decideAdminSession, type VerifiedSessionClaims } from "@/modules/identity/domain/session";

describe("permisos owner/operator", () => {
  it("el operador opera pedidos y stock pero no gestiona acceso ni excepciones", () => {
    expect(roleCan("operator", "orders.operate")).toBe(true);
    expect(roleCan("operator", "inventory.adjust")).toBe(true);
    expect(roleCan("operator", "payments.record")).toBe(true);
    expect(roleCan("operator", "access.manage")).toBe(false);
    expect(roleCan("operator", "refunds.manage")).toBe(false);
    expect(roleCan("operator", "payment_terms.authorize")).toBe(false);
    expect(roleCan("operator", "customers.archive")).toBe(false);
  });

  it("el propietario puede todo", () => {
    expect(roleCan("owner", "access.manage")).toBe(true);
    expect(roleCan("owner", "refunds.manage")).toBe(true);
  });
});

describe("último propietario", () => {
  const owners = [
    { id: "a", role: "owner" as const, status: "active" as const },
    { id: "b", role: "owner" as const, status: "disabled" as const },
  ];

  it("impide degradar o desactivar al único owner activo", () => {
    expect(() => assertOwnerRemains(owners, "a", { role: "operator", status: "active" })).toThrow(IdentityRuleError);
    expect(() => assertOwnerRemains(owners, "a", { role: "owner", status: "disabled" })).toThrow(/al menos un propietario/);
  });

  it("permite el cambio si queda otro owner activo", () => {
    const two = [...owners, { id: "c", role: "owner" as const, status: "active" as const }];
    expect(() => assertOwnerRemains(two, "a", { role: "operator", status: "active" })).not.toThrow();
  });

  it("un owner invitado no cuenta como owner efectivo", () => {
    const withInvited = [...owners, { id: "c", role: "owner" as const, status: "invited" as const }];
    expect(() => assertOwnerRemains(withInvited, "a", { role: "operator", status: "active" })).toThrow();
  });
});

describe("transiciones de membresía", () => {
  it("solo permite transiciones definidas", () => {
    expect(() => assertTransition("invited", "active")).not.toThrow();
    expect(() => assertTransition("active", "disabled")).not.toThrow();
    expect(() => assertTransition("disabled", "active")).not.toThrow();
    expect(() => assertTransition("active", "invited")).toThrow(IdentityRuleError);
  });
});

describe("decisión de sesión", () => {
  const claims: VerifiedSessionClaims = { subject: "u1", assuranceLevel: "aal2", authenticatedAt: 1_000 };

  it("acepta owner/operator activo con MFA", () => {
    expect(decideAdminSession(claims, { status: "active", sessionsRevokedAt: null })).toEqual({ kind: "allowed" });
  });

  it("exige MFA (aal2)", () => {
    expect(decideAdminSession({ ...claims, assuranceLevel: "aal1" }, { status: "active", sessionsRevokedAt: null })).toEqual({ kind: "needs_mfa" });
  });

  it("rechaza sin membresía, desactivado o invitado (salvo alta)", () => {
    expect(decideAdminSession(claims, null).kind).toBe("not_admin");
    expect(decideAdminSession(claims, { status: "disabled", sessionsRevokedAt: null }).kind).toBe("not_admin");
    expect(decideAdminSession(claims, { status: "invited", sessionsRevokedAt: null }).kind).toBe("not_admin");
    expect(decideAdminSession(claims, { status: "invited", sessionsRevokedAt: null }, { allowInvited: true }).kind).toBe("allowed");
  });

  it("una sesión iniciada antes de la revocación queda inválida aunque el token se refresque", () => {
    const revokedAfterLogin = new Date(2_000 * 1000);
    expect(decideAdminSession(claims, { status: "active", sessionsRevokedAt: revokedAfterLogin }).kind).toBe("revoked");
    const newLogin = { ...claims, authenticatedAt: 2_001 };
    expect(decideAdminSession(newLogin, { status: "active", sessionsRevokedAt: revokedAfterLogin }).kind).toBe("allowed");
  });
});
