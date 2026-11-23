import type { FormState } from "@/shared/forms/form-state";

import { Alert } from "./surface";

/** Muestra el mensaje general de un `FormState` (anunciado a lectores de pantalla). */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "danger"} className={className}>
      {state.message}
    </Alert>
  );
}
