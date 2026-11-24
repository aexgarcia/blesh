"use server";

import { revalidatePath } from "next/cache";

import * as access from "../application/access-management";
import type { Result } from "../application/result";
import { getIdentityDeps } from "../infrastructure/compose";
import { requireAdminActor } from "../server";
import { errorState, fieldErrorsFrom, type FormState } from "@/shared/forms/form-state";
import { inviteSchema, membershipRefSchema, reasonSchema, roleSchema } from "./schemas";

const ACCESS_PATH = "/admin/acceso";

function done(result: Result<unknown>, success: string): FormState {
  if (!result.ok) return errorState(result.message);
  revalidatePath(ACCESS_PATH);
  return { status: "success", message: success };
}

/** Actor verificado + dependencias. El permiso `access.manage` lo comprueba cada caso de uso. */
async function context() {
  const actor = await requireAdminActor();
  const deps = getIdentityDeps();
  if (!deps) throw new Error("Autenticación no configurada");
  return { actor, deps };
}

function parseRef(formData: FormData) {
  return membershipRefSchema.safeParse({
    membershipId: formData.get("membershipId"),
    expectedVersion: formData.get("expectedVersion") ?? undefined,
  });
}

const INVALID = errorState("Solicitud inválida. Recarga la página.");

export async function inviteAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  return done(await access.inviteAdmin(deps, actor, parsed.data), "Invitación enviada.");
}

export async function changeRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  const role = roleSchema.safeParse(formData.get("role"));
  if (!ref.success || !role.success || !ref.data.expectedVersion) return INVALID;
  return done(
    await access.changeRole(deps, actor, { membershipId: ref.data.membershipId, role: role.data, expectedVersion: ref.data.expectedVersion }),
    "Rol actualizado. Sus sesiones abiertas se cerraron.",
  );
}

export async function deactivateAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  const reason = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!ref.success || !ref.data.expectedVersion) return INVALID;
  if (!reason.success) return errorState("Revisa los datos.", { reason: reason.error.issues[0].message });
  return done(
    await access.deactivateAdmin(deps, actor, { membershipId: ref.data.membershipId, expectedVersion: ref.data.expectedVersion, reason: reason.data || null }),
    "Usuario desactivado y sesiones revocadas.",
  );
}

export async function reactivateAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  if (!ref.success || !ref.data.expectedVersion) return INVALID;
  return done(
    await access.reactivateAdmin(deps, actor, { membershipId: ref.data.membershipId, expectedVersion: ref.data.expectedVersion }),
    "Usuario reactivado. Deberá iniciar sesión de nuevo.",
  );
}

export async function revokeSessionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  if (!ref.success) return INVALID;
  return done(await access.revokeSessions(deps, actor, { membershipId: ref.data.membershipId }), "Sesiones revocadas.");
}

export async function resetMfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  const reason = reasonSchema.min(5, "Indica el motivo (mínimo 5 caracteres).").safeParse(formData.get("reason") ?? "");
  if (!ref.success) return INVALID;
  if (!reason.success) return errorState("Revisa los datos.", { reason: reason.error.issues[0].message });
  return done(
    await access.resetAdminMfa(deps, actor, { membershipId: ref.data.membershipId, reason: reason.data }),
    "Verificación en dos pasos restablecida. Deberá configurarla al iniciar sesión.",
  );
}

export async function cancelInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  if (!ref.success) return INVALID;
  return done(await access.cancelInvitation(deps, actor, { membershipId: ref.data.membershipId }), "Invitación cancelada.");
}

export async function resendInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { actor, deps } = await context();
  const ref = parseRef(formData);
  if (!ref.success) return INVALID;
  return done(await access.resendInvitation(deps, actor, { membershipId: ref.data.membershipId }), "Invitación reenviada. El enlace anterior ya no es válido.");
}
