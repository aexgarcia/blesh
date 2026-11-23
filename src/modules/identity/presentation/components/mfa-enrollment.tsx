"use client";

import { QrCode, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/surface";

import { beginTotpEnrollmentAction, type TotpEnrollment } from "../auth-actions";
import { TotpCodeForm } from "./auth-forms";

/** Enrolamiento TOTP en dos pasos: generar QR (acción explícita) y verificar el primer código. */
export function MfaEnrollment({ next }: { next?: string }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment || "error" in enrollment) {
    return (
      <div className="flex flex-col gap-5">
        {enrollment && "error" in enrollment ? <Alert tone="danger">{enrollment.error}</Alert> : null}
        <ol className="flex flex-col gap-3 text-[13px] text-muted">
          <li className="flex gap-3"><Step n={1} />Instala una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
          <li className="flex gap-3"><Step n={2} />Escanea el código QR que generaremos.</li>
          <li className="flex gap-3"><Step n={3} />Ingresa el código de 6 dígitos que muestra la app.</li>
        </ol>
        <Button size="lg" block disabled={pending} onClick={() => startTransition(async () => setEnrollment(await beginTotpEnrollmentAction()))}>
          <QrCode aria-hidden />
          {pending ? "Generando…" : "Generar código QR"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6">
        {/* SVG generado por el proveedor para este enrolamiento. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="Código QR para la aplicación de autenticación" width={184} height={184} className="size-46" />
        <details className="w-full text-center text-[12px] text-muted">
          <summary className="cursor-pointer font-semibold text-ink">¿No puedes escanear? Ingresa la clave manualmente</summary>
          <code className="mt-2 block break-all rounded-[8px] bg-card px-3 py-2 font-mono text-[12px] text-ink">{enrollment.secret}</code>
        </details>
      </div>
      <Alert tone="info" title="Guarda el acceso a tu app">
        Si pierdes el dispositivo, un propietario deberá restablecer tu verificación.
      </Alert>
      <TotpCodeForm factorId={enrollment.factorId} next={next} submitLabel="Activar verificación" />
      <p className="flex items-center justify-center gap-2 text-[12px] text-muted">
        <ShieldCheck className="size-4" aria-hidden /> Verificación en dos pasos obligatoria para administración
      </p>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-extrabold text-white" aria-hidden>
      {n}
    </span>
  );
}
