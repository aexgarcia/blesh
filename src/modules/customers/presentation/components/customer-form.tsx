"use client";

import Link from "next/link";
import { useState } from "react";

import { Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Alert } from "@/shared/ui/surface";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { CustomerDetail } from "../../contracts";
import { createCustomerAction, updateCustomerAction } from "../actions";

type Props = {
  /** Sin ficha: alta (con clave de idempotencia por apertura). Con ficha: edición con versión esperada. */
  customer?: CustomerDetail;
  disabled?: boolean;
  footer?: React.ReactNode;
};

/** Nombre, teléfono y correo opcional. Ante teléfono compartido pide revisión y confirmación explícita. */
export function CustomerForm({ customer, disabled, footer }: Props) {
  const { state, onSubmit, pending } = useActionForm(customer ? updateCustomerAction : createCustomerAction);
  const [creationKey] = useState(() => crypto.randomUUID());
  const errors = state.fieldErrors ?? {};
  const askConfirmation = state.status === "error" && state.code === "PHONE_MATCH";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {customer ? (
        <>
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="expectedVersion" value={customer.version} />
        </>
      ) : (
        <input type="hidden" name="creationKey" value={creationKey} />
      )}

      {askConfirmation ? (
        <Alert tone="warning" title="Teléfono ya registrado">
          <p>{state.message}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {state.related?.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/clientes/${m.id}`} target="_blank" className="font-bold text-ink underline underline-offset-4">
                  {m.label}
                </Link>{" "}
                <span className="text-muted">· {m.meta}</span>
              </li>
            ))}
          </ul>
          <label className="mt-3 flex items-start gap-2 font-semibold text-ink">
            <input type="checkbox" name="confirmSharedPhone" className="mt-0.5 size-4 accent-ink" />
            Revisé las fichas: es otra persona que comparte este número.
          </label>
        </Alert>
      ) : state.status === "error" ? (
        <FormMessage state={state} />
      ) : null}

      <fieldset disabled={disabled} className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre" error={errors.name} className="md:col-span-2">
          {(c) => <Input name="name" defaultValue={customer?.name} maxLength={120} autoComplete="off" required {...c} />}
        </Field>
        <Field label="Teléfono" hint="Celular de 9 dígitos o +código de país." error={askConfirmation ? undefined : errors.phone}>
          {(c) => <Input name="phone" type="tel" inputMode="tel" defaultValue={customer?.phone} maxLength={40} autoComplete="off" required {...c} />}
        </Field>
        <Field label="Correo (opcional)" error={errors.email}>
          {(c) => <Input name="email" type="email" defaultValue={customer?.email ?? ""} maxLength={254} autoComplete="off" {...c} />}
        </Field>
      </fieldset>

      <div className="flex items-center justify-end gap-2">
        {footer}
        {disabled ? null : (
          <SubmitButton pending={pending} pendingLabel="Guardando…">
            {customer ? "Guardar datos" : "Crear ficha"}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
