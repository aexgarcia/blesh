"use client";

import { Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import { requestPasswordResetAction, signInAction, updatePasswordAction, verifyTotpAction } from "../auth-actions";

// Estos formularios terminan con redirect o con un mensaje en la propia tarjeta: sin avisos flotantes.
const quiet = { toastOnSuccess: false } as const;

export function LoginForm({ next }: { next?: string }) {
  const { state, onSubmit, pending } = useActionForm(signInAction, quiet);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <Field label="Correo" error={state.fieldErrors?.email}>
        {(c) => <Input name="email" type="email" autoComplete="username" required autoFocus {...c} />}
      </Field>
      <Field label="Contraseña" error={state.fieldErrors?.password}>
        {(c) => <Input name="password" type="password" autoComplete="current-password" required {...c} />}
      </Field>
      <SubmitButton size="lg" block pending={pending} pendingLabel="Ingresando…">
        Ingresar
      </SubmitButton>
    </form>
  );
}

export function TotpCodeForm({ factorId, next, submitLabel = "Verificar" }: { factorId?: string; next?: string; submitLabel?: string }) {
  const { state, onSubmit, pending } = useActionForm(verifyTotpAction, quiet);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {factorId ? <input type="hidden" name="factorId" value={factorId} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.status === "error" && !state.fieldErrors?.code ? <FormMessage state={state} /> : null}
      <Field label="Código de 6 dígitos" error={state.fieldErrors?.code}>
        {(c) => (
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="h-14 text-center font-mono text-[22px] tracking-[0.5em]"
            {...c}
          />
        )}
      </Field>
      <SubmitButton size="lg" block pending={pending} pendingLabel="Verificando…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function RecoveryForm() {
  const { state, onSubmit, pending } = useActionForm(requestPasswordResetAction, quiet);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Correo" error={state.fieldErrors?.email}>
        {(c) => <Input name="email" type="email" autoComplete="username" required autoFocus {...c} />}
      </Field>
      <SubmitButton size="lg" block pending={pending} pendingLabel="Enviando…">
        Enviar enlace
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const { state, onSubmit, pending } = useActionForm(updatePasswordAction, quiet);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <Field label="Nueva contraseña" hint="Mínimo 12 caracteres, con letras y números." error={state.fieldErrors?.password}>
        {(c) => <Input name="password" type="password" autoComplete="new-password" required autoFocus {...c} />}
      </Field>
      <Field label="Repite la contraseña" error={state.fieldErrors?.confirm}>
        {(c) => <Input name="confirm" type="password" autoComplete="new-password" required {...c} />}
      </Field>
      <SubmitButton size="lg" block pending={pending} pendingLabel="Guardando…">
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
