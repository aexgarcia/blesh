import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getAdminSessionState } from "@/modules/identity/server";
import { AuthShell } from "@/modules/identity/presentation/components/auth-shell";
import { LoginForm } from "@/modules/identity/presentation/components/auth-forms";
import { safeAdminPath } from "@/shared/forms/form-state";
import { Alert } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Acceso administrativo" };

const NOTICES: Record<string, { tone: "info" | "warning" | "danger"; text: string }> = {
  revocada: { tone: "warning", text: "Tu sesión fue cerrada por un propietario. Inicia sesión de nuevo." },
  "sin-acceso": { tone: "danger", text: "Esta cuenta no tiene acceso a la administración." },
  "no-configurado": { tone: "danger", text: "La autenticación no está configurada en este entorno. El acceso permanece bloqueado." },
  "enlace-invalido": { tone: "warning", text: "El enlace no es válido o ya venció. Solicita uno nuevo." },
  salida: { tone: "info", text: "Cerraste sesión." },
};

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <AuthShell
      eyebrow="Administración"
      title="Iniciar sesión"
      description="Usa tu cuenta personal del equipo BLESH."
      footer={
        <Link href="/admin/recuperar" className="font-semibold text-ink underline-offset-4 hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      }
    >
      <Suspense fallback={<div className="h-64" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const params = await searchParams;
  const state = await getAdminSessionState();
  if (state.kind === "ok") redirect("/admin/pedidos");
  if (state.kind === "needs_mfa") redirect("/admin/mfa");

  const notice = NOTICES[String(params.motivo ?? "")] ?? (state.kind === "unconfigured" ? NOTICES["no-configurado"] : undefined);
  const next = safeAdminPath(params.next, "");
  return (
    <div className="flex flex-col gap-5">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <LoginForm next={next || undefined} />
    </div>
  );
}
