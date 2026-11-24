"use client";

import { useState } from "react";

import type { FormState } from "@/shared/forms/form-state";

import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";
import { Field, Textarea } from "./form";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import { useActionForm } from "./use-action-form";

type ActionDialogProps = {
  /** Server Action `(prev, formData) => FormState`. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Campos ocultos enviados con la acción (ids, versión esperada). */
  fields: Record<string, string | number>;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  /** Pide un motivo (opcional u obligatorio según la acción del servidor). */
  reason?: { label: string; required?: boolean; hint?: string };
  /** Envía `operationKey` (UUID nuevo en cada apertura): un reenvío no se aplica dos veces. */
  operationKey?: boolean;
  /** Diálogo ancho para formularios extensos. */
  wide?: boolean;
  /** Botón que abre el diálogo (modo no controlado). */
  trigger?: React.ReactNode;
  /** Modo controlado (p. ej. abierto desde un menú). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

/** Confirmación accesible para acciones sensibles: evita ejecutarlas con un solo clic accidental. */
export function ActionDialog({ trigger, open: controlledOpen, onOpenChange, title, description, wide, ...formProps }: ActionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent title={title} description={description} className={wide ? "max-w-2xl" : undefined}>
        {/* El contenido se monta en cada apertura: sin errores ni estado de la vez anterior. */}
        <ActionDialogForm {...formProps} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ActionDialogForm({
  action,
  fields,
  confirmLabel,
  tone = "primary",
  reason,
  operationKey,
  children,
  onDone,
}: Omit<ActionDialogProps, "title" | "description" | "trigger" | "open" | "onOpenChange" | "wide"> & { onDone: () => void }) {
  const { state, onSubmit, pending } = useActionForm(action, { onSuccess: onDone });
  const [key] = useState(() => crypto.randomUUID());
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {operationKey ? <input type="hidden" name="operationKey" value={key} /> : null}
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      {reason ? (
        <Field label={reason.label} hint={reason.hint} error={state.fieldErrors?.reason}>
          {(control) => <Textarea name="reason" required={reason.required} maxLength={300} {...control} />}
        </Field>
      ) : null}
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <SubmitButton variant={tone === "danger" ? "danger" : "primary"} pending={pending} pendingLabel="Procesando…">
          {confirmLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
