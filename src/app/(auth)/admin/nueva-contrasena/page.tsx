import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { currentUserHasVerifiedMfa, getAdminSessionState } from "@/modules/identity/server";
import { AuthShell } from "@/modules/identity/presentation/components/auth-shell";
import { NewPasswordForm } from "@/modules/identity/presentation/components/auth-forms";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function NewPasswordPage() {
  return (
    <AuthShell
      eyebrow="Seguridad"
      title="Crea tu contraseña"
      description="Se usará junto con tu código de verificación en dos pasos."
    >
      <Suspense fallback={<div className="h-64" />}>
        <NewPasswordGate />
      </Suspense>
    </AuthShell>
  );
}

/** Requiere la sesión del enlace (invitación o recuperación); si ya hay MFA, primero se verifica. */
async function NewPasswordGate() {
  const state = await getAdminSessionState(true);
  if (state.kind === "needs_mfa" && (await currentUserHasVerifiedMfa())) {
    redirect(`/admin/mfa?next=${encodeURIComponent("/admin/nueva-contrasena")}`);
  }
  if (state.kind !== "ok" && state.kind !== "needs_mfa") redirect("/admin/login?motivo=enlace-invalido");
  return <NewPasswordForm />;
}
