import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { getAuthEnv } from "@/infrastructure/config/server";

import { listAdminUsers as listAdminUsersUseCase } from "./application/access-management";
import type { AdminActor, Capability, MembershipStatus } from "./contracts";
import { roleCan } from "./domain/permissions";
import { decideAdminSession } from "./domain/session";
import { getIdentityDeps } from "./infrastructure/compose";
import { createSupabaseSessionClient, readVerifiedClaims } from "./infrastructure/supabase-session";

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_MFA_PATH = "/admin/mfa";
/** Route Handler que cierra la sesión del proveedor y vuelve al login con un motivo. */
export const ADMIN_SIGNOUT_PATH = "/admin/auth/salir";

export type AdminSessionState =
  | { kind: "unconfigured" }
  | { kind: "anonymous" }
  | { kind: "not_admin" }
  | { kind: "revoked" }
  | { kind: "needs_mfa"; subject: string; status: MembershipStatus }
  | { kind: "ok"; actor: AdminActor; status: MembershipStatus };

/**
 * Estado de la sesión administrativa de la petición actual (memoizado por petición).
 * Se consulta la membresía en cada petición: desactivar o revocar surte efecto al instante.
 * `allowInvited` solo para completar el alta (contraseña y MFA).
 */
export const getAdminSessionState = cache(async (allowInvited: boolean = false): Promise<AdminSessionState> => {
  // La sesión depende de la petición y de la hora (expiración del JWT): nunca se prerenderiza.
  await connection();
  const env = getAuthEnv();
  const deps = getIdentityDeps();
  if (!env || !deps) return { kind: "unconfigured" };

  const claims = await readVerifiedClaims(await createSupabaseSessionClient(env));
  if (!claims) return { kind: "anonymous" };

  const membership = await deps.store.findBySubject(claims.subject);
  const decision = decideAdminSession(claims, membership, { allowInvited });
  switch (decision.kind) {
    case "not_admin":
    case "revoked":
      return { kind: decision.kind };
    case "needs_mfa":
      return { kind: "needs_mfa", subject: claims.subject, status: membership!.status };
    case "allowed":
      return {
        kind: "ok",
        status: membership!.status,
        actor: {
          membershipId: membership!.id,
          authSubject: membership!.authSubject,
          role: membership!.role,
          displayName: membership!.displayName,
          email: membership!.email,
        },
      };
  }
});

/**
 * Exige un actor administrativo activo con MFA. Usar en cada página, Server Action y
 * Route Handler administrativo: el layout y el proxy no protegen peticiones directas.
 */
export async function requireAdminActor(): Promise<AdminActor> {
  const state = await getAdminSessionState();
  switch (state.kind) {
    case "ok":
      return state.actor;
    case "needs_mfa":
      redirect(ADMIN_MFA_PATH);
    case "revoked":
      redirect(`${ADMIN_SIGNOUT_PATH}?motivo=revocada`);
    case "not_admin":
      redirect(`${ADMIN_SIGNOUT_PATH}?motivo=sin-acceso`);
    case "unconfigured":
      redirect(`${ADMIN_LOGIN_PATH}?motivo=no-configurado`);
    case "anonymous":
      redirect(ADMIN_LOGIN_PATH);
  }
}

export function actorCan(actor: AdminActor, capability: Capability): boolean {
  return roleCan(actor.role, capability);
}

/** ¿El usuario de la sesión actual ya tiene un autenticador verificado? */
export async function currentUserHasVerifiedMfa(): Promise<boolean> {
  await connection();
  const env = getAuthEnv();
  if (!env) return false;
  const supabase = await createSupabaseSessionClient(env);
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.some((factor) => factor.status === "verified") ?? false;
}

/** Listado para Gestión de acceso (solo owner; el caso de uso lo verifica). */
export async function listAdminUsers(actor: AdminActor) {
  const deps = getIdentityDeps();
  if (!deps) return { ok: false as const, code: "PROVIDER_ERROR" as const, message: "Autenticación no configurada." };
  return listAdminUsersUseCase(deps, actor);
}
