import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { currentUserHasVerifiedMfa, getAdminSessionState } from "@/modules/identity/server";
import { signOutAction } from "@/modules/identity/presentation/auth-actions";
import { AuthShell } from "@/modules/identity/presentation/components/auth-shell";
import { TotpCodeForm } from "@/modules/identity/presentation/components/auth-forms";
import { MfaEnrollment } from "@/modules/identity/presentation/components/mfa-enrollment";
import { safeAdminPath } from "@/shared/forms/form-state";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default function MfaPage({ searchParams }: PageProps<"/admin/mfa">) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <MfaContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MfaContent({ searchParams }: Pick<PageProps<"/admin/mfa">, "searchParams">) {
  const next = safeAdminPath((await searchParams).next, "/admin/pedidos");
  const state = await getAdminSessionState(true);
  if (state.kind === "ok") redirect(next);
  if (state.kind !== "needs_mfa") redirect("/admin/login");

  const enrolled = await currentUserHasVerifiedMfa();
  const footer = (
    <form action={signOutAction}>
      <button type="submit" className="font-semibold text-ink underline-offset-4 hover:underline">
        Usar otra cuenta
      </button>
    </form>
  );

  return enrolled ? (
    <AuthShell eyebrow="Paso 2 de 2" title="Verificación" description="Ingresa el código de tu aplicación de autenticación." footer={footer}>
      <TotpCodeForm next={next} />
    </AuthShell>
  ) : (
    <AuthShell
      eyebrow="Seguridad"
      title="Activa la verificación en dos pasos"
      description="Es obligatoria para todas las cuentas administrativas."
      footer={footer}
    >
      <MfaEnrollment next={next} />
    </AuthShell>
  );
}
