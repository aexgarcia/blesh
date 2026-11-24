"use client";

import { useState } from "react";

import { Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import { DELIVERY_MODE_LABELS, DELIVERY_MODES } from "../../contracts";
import { createManualOrderAction } from "../actions";
import { LinePicker } from "./line-picker";

/**
 * Pedido manual (WhatsApp o presencial). Se guarda como solicitud: no reserva stock ni marca
 * pagos. Después se acuerda, confirma y cobra con las mismas reglas que una solicitud web.
 */
export function ManualOrderForm() {
  const { state, onSubmit, pending } = useActionForm(createManualOrderAction);
  const [creationKey] = useState(() => crypto.randomUUID());
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="creationKey" value={creationKey} />
      {state.status === "error" ? <FormMessage state={state} /> : null}

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Origen" error={errors.source}>
          {(c) => (
            <Select name="source" defaultValue="whatsapp" {...c}>
              <option value="whatsapp">WhatsApp</option>
              <option value="presential">Presencial</option>
            </Select>
          )}
        </Field>
        <Field label="Nombre del cliente" error={errors.customerName}>
          {(c) => <Input name="customerName" maxLength={120} autoComplete="off" required {...c} />}
        </Field>
        <Field label="Teléfono" hint="Celular de 9 dígitos o +código de país." error={errors.customerPhone}>
          {(c) => <Input name="customerPhone" type="tel" inputMode="tel" maxLength={40} autoComplete="off" required {...c} />}
        </Field>
      </div>

      <section aria-labelledby="lineas" className="flex flex-col gap-2">
        <h2 id="lineas" className="text-[11px] font-extrabold uppercase tracking-[0.05em]">
          Productos
        </h2>
        <LinePicker error={errors.lines} />
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Preferencia de entrega" hint="Se acuerda en detalle en la revisión." error={errors.deliveryPreference}>
          {(c) => (
            <Select name="deliveryPreference" defaultValue="undecided" {...c}>
              {DELIVERY_MODES.map((m) => (
                <option key={m} value={m}>
                  {DELIVERY_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nota interna (opcional)" error={errors.note} className="md:col-span-2">
          {(c) => <Textarea name="note" rows={2} maxLength={500} {...c} />}
        </Field>
      </div>

      <div className="flex justify-end">
        <SubmitButton size="lg" pending={pending} pendingLabel="Registrando…">
          Registrar solicitud
        </SubmitButton>
      </div>
    </form>
  );
}
