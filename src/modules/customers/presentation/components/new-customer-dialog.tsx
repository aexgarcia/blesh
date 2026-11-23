"use client";

import { UserPlus } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/shared/ui/dialog";

import { CustomerForm } from "./customer-form";

/** Alta manual (WhatsApp o presencial). Cada apertura monta un formulario nuevo con su clave de alta. */
export function NewCustomerDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg">
          <UserPlus aria-hidden /> Nuevo cliente
        </Button>
      </DialogTrigger>
      <DialogContent title="Nuevo cliente" description="Datos mínimos de contacto. La dirección de envío se registra en cada pedido.">
        <CustomerForm
          footer={
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
