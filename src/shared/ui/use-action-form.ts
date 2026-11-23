"use client";

import { startTransition, useActionState, useRef, type FormEvent } from "react";
import { toast } from "sonner";

import { idleState, type FormState } from "@/shared/forms/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Envía un formulario a una Server Action sin el reinicio automático de React 19
 * (que borraría lo escrito cuando hay errores). Solo se limpia en éxito (`onSuccess`).
 * Uso: `<form onSubmit={onSubmit}>` + `<SubmitButton pending={pending}>`.
 */
export function useActionForm(
  action: Action,
  options: { onSuccess?: (state: FormState, form: HTMLFormElement | null) => void; toastOnSuccess?: boolean } = {},
) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, dispatch, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.status === "success") {
      if (options.toastOnSuccess !== false) toast.success(next.message ?? "Guardado.");
      options.onSuccess?.(next, formRef.current);
    }
    return next;
  }, idleState);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formRef.current = event.currentTarget;
    // Incluye el botón que envió (p. ej. name="intent" value="cover").
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return { state, onSubmit, pending };
}
