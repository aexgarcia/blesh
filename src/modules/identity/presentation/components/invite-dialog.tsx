"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Field, Input, Select } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import { inviteAdminAction } from "../access-actions";

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden /> Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Invitar usuario"
        description="Recibirá un enlace personal de un solo uso para crear su contraseña y activar la verificación en dos pasos."
      >
        <InviteForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const { state, onSubmit, pending } = useActionForm(inviteAdminAction, { onSuccess: onDone });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <Field label="Nombre" error={state.fieldErrors?.displayName}>
        {(c) => <Input name="displayName" maxLength={80} autoComplete="off" required {...c} />}
      </Field>
      <Field label="Correo" error={state.fieldErrors?.email}>
        {(c) => <Input name="email" type="email" autoComplete="off" required {...c} />}
      </Field>
      <Field label="Rol" hint="El operador no gestiona accesos ni autoriza excepciones de cobro." error={state.fieldErrors?.role}>
        {(c) => (
          <Select name="role" defaultValue="operator" {...c}>
            <option value="operator">Operador</option>
            <option value="owner">Propietario</option>
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Enviando…">
          Enviar invitación
        </SubmitButton>
      </div>
    </form>
  );
}
