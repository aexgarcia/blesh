import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/modules/identity/presentation/components/auth-shell";
import { RecoveryForm } from "@/modules/identity/presentation/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPasswordPage() {
  return (
    <AuthShell
      eyebrow="Recuperación"
      title="Restablecer contraseña"
      description="Te enviaremos un enlace de un solo uso. Después de usarlo se pedirá tu código de verificación."
      footer={
        <Link href="/admin/login" className="font-semibold text-ink underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <RecoveryForm />
    </AuthShell>
  );
}
