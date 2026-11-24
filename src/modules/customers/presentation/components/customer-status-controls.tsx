"use client";

import { Archive, RotateCcw } from "lucide-react";

import { ActionDialog } from "@/shared/ui/action-dialog";
import { Button } from "@/shared/ui/button";

import type { CustomerDetail } from "../../contracts";
import { archiveCustomerAction, reactivateCustomerAction } from "../actions";

/** Archivar / reactivar: solo propietario, con confirmación y motivo auditado. */
export function CustomerStatusControls({ customer }: { customer: Pick<CustomerDetail, "id" | "version" | "status" | "name"> }) {
  const fields = { id: customer.id, expectedVersion: customer.version };
  if (customer.status === "active") {
    return (
      <ActionDialog
        action={archiveCustomerAction}
        fields={fields}
        title={`Archivar a ${customer.name}`}
        description="Deja de aparecer en el directorio activo y no podrá elegirse en pedidos nuevos. Sus pedidos e historial se conservan."
        confirmLabel="Archivar"
        tone="danger"
        reason={{ label: "Motivo", required: true, hint: "Queda en el historial de auditoría." }}
        trigger={
          <Button variant="secondary">
            <Archive aria-hidden /> Archivar
          </Button>
        }
      />
    );
  }
  return (
    <ActionDialog
      action={reactivateCustomerAction}
      fields={fields}
      title={`Reactivar a ${customer.name}`}
      description="Vuelve al directorio activo y puede elegirse en pedidos nuevos."
      confirmLabel="Reactivar"
      reason={{ label: "Motivo (opcional)" }}
      trigger={
        <Button variant="secondary">
          <RotateCcw aria-hidden /> Reactivar
        </Button>
      }
    />
  );
}
