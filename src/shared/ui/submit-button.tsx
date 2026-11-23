"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./button";

/**
 * Botón de envío deshabilitado mientras la acción está pendiente (evita doble envío).
 * `pending` explícito para formularios con `useActionForm`; si no, usa `useFormStatus`.
 */
export function SubmitButton({ children, pendingLabel, disabled, pending: pendingProp, ...props }: ButtonProps & { pendingLabel?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || disabled} aria-disabled={pending || disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
