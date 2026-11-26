"use client";

import { startTransition, useActionState, useRef, type FormEvent } from "react";
import { toast } from "sonner";

import { idleState, type FormState } from "@/shared/forms/form-state";

type Action<S extends FormState> = (prev: S, formData: FormData) => Promise<S>;

/**
 * Envía un formulario a una Server Action sin el reinicio automático de React 19
 * (que borraría lo escrito cuando hay errores). Solo se limpia en éxito (`onSuccess`).
 * Uso: `<form onSubmit={onSubmit}>` + `<SubmitButton pending={pending}>`.
 */
export function useActionForm<S extends FormState = FormState>(
  action: Action<S>,
  options: { onSuccess?: (state: S, form: HTMLFormElement | null) => void; toastOnSuccess?: boolean } = {},
) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, dispatch, pending] = useActionState<S, FormData>(async (prev: S, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.status === "success") {
      if (options.toastOnSuccess !== false) toast.success(next.message ?? "Guardado.");
      options.onSuccess?.(next, formRef.current);
    }
    return next;
  }, idleState as Awaited<S>);

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
