"use server";

import { redirect } from "next/navigation";

import { getAuthEnv } from "@/infrastructure/config/server";

import { activateInvitedMembership } from "../application/access-management";
import { getIdentityDeps } from "../infrastructure/compose";
import { createSupabaseSessionClient } from "../infrastructure/supabase-session";
import { ADMIN_LOGIN_PATH, getAdminSessionState } from "../server";
import { errorState, fieldErrorsFrom, safeAdminPath, type FormState } from "@/shared/forms/form-state";
import { emailSchema, loginSchema, newPasswordSchema, totpCodeSchema } from "./schemas";

const HOME = "/admin/pedidos";
const NOT_CONFIGURED = "La autenticación no está configurada en este entorno.";

async function sessionClient() {
  const env = getAuthEnv();
  return env ? createSupabaseSessionClient(env) : null;
}

/** Inicio de sesión con correo y contraseña. Mensaje genérico: no revela si el correo existe. */
export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));

  const supabase = await sessionClient();
  const deps = getIdentityDeps();
  if (!supabase || !deps) return errorState(NOT_CONFIGURED);

  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return errorState("Correo o contraseña incorrectos.");

  const membership = await deps.store.findBySubject(data.user.id);
  if (!membership || membership.status === "disabled") {
    await supabase.auth.signOut({ scope: "local" });
    return errorState("Correo o contraseña incorrectos.");
  }
  redirect(`/admin/mfa?next=${encodeURIComponent(safeAdminPath(formData.get("next"), HOME))}`);
}

export type TotpEnrollment = { factorId: string; qrCode: string; secret: string } | { error: string };

/** Inicia el enrolamiento TOTP. Elimina factores sin verificar previos para no acumularlos. */
export async function beginTotpEnrollmentAction(): Promise<TotpEnrollment> {
  const state = await getAdminSessionState(true);
  if (state.kind !== "needs_mfa") return { error: "Tu sesión no permite configurar la verificación. Inicia sesión de nuevo." };
  const supabase = await sessionClient();
  if (!supabase) return { error: NOT_CONFIGURED };

  const factors = await supabase.auth.mfa.listFactors();
  if (factors.data?.totp.some((f) => f.status === "verified")) {
    return { error: "Ya tienes un autenticador configurado. Ingresa su código." };
  }
  for (const factor of factors.data?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `BLESH ${Date.now()}` });
  if (error || !data) return { error: "No se pudo iniciar la configuración. Inténtalo de nuevo." };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Verifica un código TOTP (enrolamiento o desafío). Al completar el alta activa la membresía invitada. */
export async function verifyTotpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = totpCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa el código.", fieldErrorsFrom(parsed.error.issues));

  const state = await getAdminSessionState(true);
  if (state.kind === "ok") redirect(safeAdminPath(formData.get("next"), HOME));
  if (state.kind !== "needs_mfa") redirect(ADMIN_LOGIN_PATH);

  const supabase = await sessionClient();
  const deps = getIdentityDeps();
  if (!supabase || !deps) return errorState(NOT_CONFIGURED);

  let factorId = parsed.data.factorId;
  if (!factorId) {
    const factors = await supabase.auth.mfa.listFactors();
    factorId = factors.data?.totp.find((f) => f.status === "verified")?.id;
  }
  if (!factorId) return errorState("Configura primero tu aplicación de autenticación.");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code });
  if (error) return errorState("Código incorrecto o vencido.", { code: "Código incorrecto o vencido." });

  if (state.status === "invited") {
    const activated = await activateInvitedMembership(deps, state.subject);
    if (!activated.ok) return errorState(activated.message);
  }
  redirect(safeAdminPath(formData.get("next"), HOME));
}

/** Solicita el correo de recuperación. Siempre responde lo mismo (sin enumeración de cuentas). */
export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return errorState("Revisa los datos.", { email: parsed.error.issues[0]?.message ?? "Correo inválido." });
  const supabase = await sessionClient();
  if (!supabase) return errorState(NOT_CONFIGURED);
  await supabase.auth.resetPasswordForEmail(parsed.data);
  return { status: "success", message: "Si el correo pertenece a una cuenta administrativa, recibirás un enlace para restablecer la contraseña." };
}

/** Define la contraseña (alta por invitación o recuperación). Exige MFA si ya está configurado. */
export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));

  const state = await getAdminSessionState(true);
  const supabase = await sessionClient();
  if (!supabase) return errorState(NOT_CONFIGURED);
  if (state.kind !== "ok" && state.kind !== "needs_mfa") redirect(ADMIN_LOGIN_PATH);
  if (state.kind === "needs_mfa") {
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.data?.totp.some((f) => f.status === "verified")) {
      redirect(`/admin/mfa?next=${encodeURIComponent("/admin/nueva-contrasena")}`);
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const weak = error.code === "weak_password" || error.code === "same_password";
    return errorState(weak ? "Elige otra contraseña más segura (distinta a la anterior)." : "No se pudo guardar la contraseña. Solicita un nuevo enlace.");
  }
  redirect(state.kind === "ok" ? HOME : "/admin/mfa");
}

export async function signOutAction(): Promise<void> {
  const supabase = await sessionClient();
  await supabase?.auth.signOut({ scope: "local" });
  redirect(ADMIN_LOGIN_PATH);
}
