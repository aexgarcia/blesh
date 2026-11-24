"use client";

import { Ban, CalendarClock, Check, CircleDollarSign, FileCheck2, Handshake, PackageCheck, PackageOpen, PencilLine, RotateCcw, Truck, Undo2, UserRoundCog } from "lucide-react";
import { useState } from "react";

import { formatPEN, minorToInput } from "@/shared/domain/money";
import { ActionDialog } from "@/shared/ui/action-dialog";
import { Button } from "@/shared/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/shared/ui/form";

import {
  COLLECTION_RESPONSIBLE_LABELS,
  COLLECTION_RESPONSIBLES,
  DELIVERY_MODE_LABELS,
  DELIVERY_MODES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_MODE_LABELS,
  PAYMENT_MODES,
  type CollectionResponsible,
  type DeliveryMode,
  type FulfillmentStatus,
  type OrderStatus,
  type PaymentMode,
} from "../../contracts";
import * as actions from "../actions";
import { LinePicker, type PickedLine } from "./line-picker";

export type OrderOperationsView = {
  id: string;
  version: number;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  totalMinor: number;
  paidMinor: number;
  reportedMinor: number;
  currentRevision: number;
  acceptedRevision: number | null;
  lines: PickedLine[];
  terms: {
    discountMinor: number;
    shippingMinor: number;
    deliveryMode: DeliveryMode;
    deliveryAddress: string | null;
    deliveryNote: string | null;
    paymentMode: PaymentMode | null;
    requiredDepositMinor: number;
    collectionResponsible: CollectionResponsible;
  };
  followUpAt: string | null;
  customerId: string | null;
  customerMatches: { id: string; name: string; status: "active" | "archived" }[];
  contact: { name: string; phone: string };
  reportedPayments: { id: string; amountMinor: number }[];
  obligations: { id: string; pendingMinor: number; label: string }[];
  returnable: { variantId: string; label: string; remaining: number }[];
  can: { owner: boolean };
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

function MoneyInput({ name, defaultValue, ...props }: { name: string; defaultValue?: number } & React.ComponentProps<typeof Input>) {
  return <Input name={name} inputMode="decimal" placeholder="0.00" defaultValue={defaultValue ? minorToInput(defaultValue) : ""} autoComplete="off" {...props} />;
}

function PaymentFields({ amountHint, dateLabel = "Fecha de cobro" }: { amountHint?: string; dateLabel?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Importe (S/)" hint={amountHint}>
        {(c) => <MoneyInput name="amount" required {...c} />}
      </Field>
      <Field label="Medio">
        {(c) => (
          <Select name="method" defaultValue="yape" {...c}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Referencia (opcional)" hint="N.º de operación si existe; en efectivo, vacío.">
        {(c) => <Input name="reference" maxLength={120} autoComplete="off" {...c} />}
      </Field>
      <Field label={dateLabel}>
        {(c) => <Input name="receivedAt" type="date" defaultValue={today()} max={today()} {...c} />}
      </Field>
      <Field label="Nota (opcional)" className="sm:col-span-2">
        {(c) => <Input name="note" maxLength={300} autoComplete="off" {...c} />}
      </Field>
    </div>
  );
}

function RevisionFields({ view }: { view: OrderOperationsView }) {
  const [mode, setMode] = useState<DeliveryMode>(view.terms.deliveryMode);
  const [paymentMode, setPaymentMode] = useState<PaymentMode | "">(view.terms.paymentMode ?? "");
  return (
    <div className="flex flex-col gap-5">
      <LinePicker initial={view.lines} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entrega">
          {(c) => (
            <Select name="deliveryMode" value={mode} onChange={(e) => setMode(e.target.value as DeliveryMode)} {...c}>
              {DELIVERY_MODES.map((m) => (
                <option key={m} value={m}>
                  {DELIVERY_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Costo de envío (S/)" hint="Solo para envíos.">
          {(c) => <MoneyInput name="shipping" defaultValue={view.terms.shippingMinor} disabled={mode !== "shipping"} {...c} />}
        </Field>
        {mode === "shipping" ? (
          <Field label="Dirección de envío" hint="Solo la necesaria para entregar." className="sm:col-span-2">
            {(c) => <Input name="deliveryAddress" defaultValue={view.terms.deliveryAddress ?? ""} maxLength={300} autoComplete="off" {...c} />}
          </Field>
        ) : null}
        <Field label={mode === "pickup" ? "Sede y fecha de recojo" : "Fecha o ventana acordada"} className="sm:col-span-2">
          {(c) => <Input name="deliveryNote" defaultValue={view.terms.deliveryNote ?? ""} maxLength={300} autoComplete="off" {...c} />}
        </Field>
        <Field label="Modalidad de cobro" hint={view.can.owner ? undefined : "Adelanto o contraentrega: los autoriza el propietario."}>
          {(c) => (
            <Select name="paymentMode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode | "")} {...c}>
              <option value="">Por acordar</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Cobra en la entrega">
          {(c) => (
            <Select name="collectionResponsible" defaultValue={view.terms.collectionResponsible} {...c}>
              {COLLECTION_RESPONSIBLES.map((r) => (
                <option key={r} value={r}>
                  {COLLECTION_RESPONSIBLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {paymentMode === "deposit_on_delivery" ? (
          <Field label="Adelanto acordado (S/)" hint="Mínimo a verificar antes de preparar.">
            {(c) => <MoneyInput name="deposit" defaultValue={view.terms.requiredDepositMinor} {...c} />}
          </Field>
        ) : null}
        <Field label="Descuento excepcional (S/)" hint={view.can.owner ? "Opcional." : "Solo lo autoriza el propietario."}>
          {(c) => <MoneyInput name="discount" defaultValue={view.terms.discountMinor} {...c} />}
        </Field>
        <Field label="Nota de la revisión (opcional)" className="sm:col-span-2">
          {(c) => <Textarea name="note" rows={2} maxLength={500} {...c} />}
        </Field>
      </div>
    </div>
  );
}

function ConfirmFields({ view }: { view: OrderOperationsView }) {
  const firstActive = view.customerMatches.find((m) => m.status === "active");
  const [mode, setMode] = useState<"existing" | "new">(firstActive ? "existing" : "new");
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.05em]">Ficha del cliente</legend>
        {view.customerMatches.length > 0 ? (
          <p className="text-[12px] text-muted">Fichas con el mismo teléfono. Confirma la identidad en la conversación; el teléfono no basta.</p>
        ) : null}
        {view.customerMatches.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-[13px]">
            <input type="radio" name="customerId" value={m.id} disabled={m.status !== "active"} defaultChecked={m.id === firstActive?.id} onChange={() => setMode("existing")} className="accent-ink" />
            <span className="font-bold">{m.name}</span>
            {m.status !== "active" ? <span className="text-muted">(archivada)</span> : null}
          </label>
        ))}
        <label className="flex items-center gap-2 text-[13px]">
          <input type="radio" name="customerId" value="" defaultChecked={!firstActive} onChange={() => setMode("new")} className="accent-ink" />
          <span className="font-bold">Crear ficha nueva</span>
        </label>
        <input type="hidden" name="customerMode" value={mode} />
      </fieldset>
      {mode === "new" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">{(c) => <Input name="name" defaultValue={view.contact.name} maxLength={120} autoComplete="off" {...c} />}</Field>
          <Field label="Teléfono">{(c) => <Input name="phone" type="tel" defaultValue={view.contact.phone} maxLength={40} autoComplete="off" {...c} />}</Field>
          <Field label="Correo (opcional)" className="sm:col-span-2">
            {(c) => <Input name="email" type="email" maxLength={254} autoComplete="off" {...c} />}
          </Field>
          {view.customerMatches.length > 0 ? (
            <label className="flex items-start gap-2 text-[13px] font-semibold sm:col-span-2">
              <input type="checkbox" name="confirmSharedPhone" className="mt-0.5 size-4 accent-ink" />
              Es otra persona que comparte este número.
            </label>
          ) : null}
        </div>
      ) : null}
      <Field label="Seguimiento (opcional)" hint="Recordatorio para revisar el pedido. No libera stock solo.">
        {(c) => <Input name="followUpAt" type="date" min={today()} {...c} />}
      </Field>
    </div>
  );
}

/** Acciones disponibles según estado, entrega, cobro y rol. El servidor vuelve a validar todo. */
export function OrderOperations({ view }: { view: OrderOperationsView }) {
  const base = { orderId: view.id, expectedVersion: view.version };
  const balance = Math.max(0, view.totalMinor - view.paidMinor - view.reportedMinor);
  const open = view.status === "requested" || view.status === "confirmed";
  const agreed = view.acceptedRevision === view.currentRevision;
  const f = view.fulfillmentStatus;
  const beforeDispatch = view.status === "requested" || (view.status === "confirmed" && ["arranged", "preparing", "ready"].includes(f));
  const step = (stepName: "prepare" | "ready" | "delivered" | "complete", label: string, icon: React.ReactNode, description: string) => (
    <ActionDialog
      action={actions.fulfillmentStepAction}
      fields={{ ...base, step: stepName }}
      operationKey
      title={label}
      description={description}
      confirmLabel={label}
      trigger={
        <Button block>
          {icon} {label}
        </Button>
      }
    />
  );

  return (
    <div className="flex flex-col gap-2.5">
      {view.status === "requested" ? (
        <>
          <ActionDialog
            action={actions.reviseAgreementAction}
            fields={base}
            operationKey
            wide
            title="Nueva revisión del acuerdo"
            description="Los precios se recalculan con el catálogo vigente. La aceptación anterior deja de valer."
            confirmLabel="Guardar revisión"
            trigger={
              <Button block variant={agreed ? "secondary" : "primary"}>
                <PencilLine aria-hidden /> Revisar acuerdo
              </Button>
            }
          >
            <RevisionFields view={view} />
          </ActionDialog>
          {!agreed ? (
            <ActionDialog
              action={actions.recordAgreementAction}
              fields={{ ...base, revision: view.currentRevision }}
              operationKey
              title={`El cliente aceptó la revisión ${view.currentRevision}`}
              description="Registra que aceptó productos, entrega y cobro por WhatsApp o en persona. No adjuntes capturas."
              confirmLabel="Registrar acuerdo"
              reason={{ label: "Nota (opcional)", hint: "Ej.: «Aceptó por WhatsApp a las 15:20»." }}
              trigger={
                <Button block>
                  <Handshake aria-hidden /> Registrar acuerdo
                </Button>
              }
            />
          ) : (
            <ActionDialog
              action={actions.confirmOrderAction}
              fields={base}
              operationKey
              title="Confirmar y reservar"
              description="Aparta todas las unidades a la vez. Si falta una, no se reserva nada."
              confirmLabel="Confirmar pedido"
              trigger={
                <Button block>
                  <FileCheck2 aria-hidden /> Confirmar y reservar
                </Button>
              }
            >
              <ConfirmFields view={view} />
            </ActionDialog>
          )}
        </>
      ) : null}

      {view.status === "confirmed" && f === "arranged" ? step("prepare", "Marcar en preparación", <PackageOpen aria-hidden />, "Comprueba el cobro exigido por la modalidad acordada.") : null}
      {view.status === "confirmed" && f === "preparing" ? step("ready", "Marcar listo", <PackageCheck aria-hidden />, "El pedido está empacado y listo para salir o recoger.") : null}
      {view.status === "confirmed" && f === "ready" && view.terms.deliveryMode === "shipping" ? (
        <ActionDialog
          action={actions.dispatchOrderAction}
          fields={base}
          operationKey
          title="Despachar"
          description="Descuenta el stock reservado (una sola vez)."
          confirmLabel="Despachar"
          trigger={
            <Button block>
              <Truck aria-hidden /> Despachar
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Transportista (opcional)">{(c) => <Input name="carrier" maxLength={80} autoComplete="off" {...c} />}</Field>
            <Field label="Código de seguimiento (opcional)">{(c) => <Input name="trackingCode" maxLength={80} autoComplete="off" {...c} />}</Field>
          </div>
        </ActionDialog>
      ) : null}
      {view.status === "confirmed" && f === "ready" && view.terms.deliveryMode === "pickup" ? (
        <ActionDialog
          action={actions.handOverPickupAction}
          fields={base}
          operationKey
          title="Entregar en tienda"
          description={balance > 0 ? `Saldo pendiente ${formatPEN(balance)}: regístralo al entregar.` : "Cobro completo. Descuenta el stock reservado."}
          confirmLabel="Entregar"
          trigger={
            <Button block>
              <PackageCheck aria-hidden /> Entregar en tienda
            </Button>
          }
        >
          {balance > 0 ? <PaymentFields amountHint={`Saldo: ${formatPEN(balance)}`} /> : null}
        </ActionDialog>
      ) : null}
      {view.status === "confirmed" && f === "dispatched" ? step("delivered", "Registrar entrega", <Check aria-hidden />, "El cliente recibió el pedido.") : null}
      {view.status === "confirmed" && f === "delivered" ? step("complete", "Completar pedido", <Check aria-hidden />, "Requiere entrega, cobro íntegro verificado y ninguna devolución pendiente.") : null}

      {view.status !== "completed" ? (
        <ActionDialog
          action={actions.recordPaymentAction}
          fields={base}
          operationKey
          title="Registrar cobro verificado"
          description={
            view.status === "cancelled"
              ? "El pedido está cancelado: el dinero quedará como devolución pendiente."
              : `Saldo pendiente: ${formatPEN(balance)}. Verifica el dinero antes de registrarlo; un pantallazo no basta.`
          }
          confirmLabel="Registrar cobro"
          trigger={
            <Button block variant="secondary">
              <CircleDollarSign aria-hidden /> Registrar cobro
            </Button>
          }
        >
          <PaymentFields amountHint={view.status === "cancelled" ? undefined : `Saldo: ${formatPEN(balance)}`} />
          {view.terms.collectionResponsible === "carrier" && (f === "dispatched" || f === "delivered") ? (
            <label className="flex items-start gap-2 text-[13px] font-semibold">
              <input type="checkbox" name="reportedByCarrier" className="mt-0.5 size-4 accent-ink" />
              Lo cobró el transportista y aún no llegó a la empresa (pendiente de conciliar).
            </label>
          ) : null}
          {view.can.owner && view.status !== "cancelled" ? (
            <label className="flex items-start gap-2 text-[13px] font-semibold">
              <input type="checkbox" name="acceptExcess" className="mt-0.5 size-4 accent-ink" />
              Si supera el saldo, registrar el exceso como devolución pendiente.
            </label>
          ) : null}
        </ActionDialog>
      ) : null}

      {view.reportedPayments.map((p) => (
        <ActionDialog
          key={p.id}
          action={actions.verifyReportedPaymentAction}
          fields={{ ...base, paymentId: p.id }}
          operationKey
          title="Conciliar cobro del transportista"
          description={`Confirma que la empresa recibió ${formatPEN(p.amountMinor)}.`}
          confirmLabel="Conciliar"
          trigger={
            <Button block variant="secondary">
              <Check aria-hidden /> Conciliar {formatPEN(p.amountMinor)}
            </Button>
          }
        />
      ))}

      {view.can.owner
        ? view.obligations.map((o) => (
            <ActionDialog
              key={o.id}
              action={actions.recordRefundAction}
              fields={{ ...base, obligationId: o.id }}
              operationKey
              title="Registrar devolución de dinero"
              description={`${o.label}: quedan ${formatPEN(o.pendingMinor)} por devolver. No repone prendas.`}
              confirmLabel="Registrar devolución"
              trigger={
                <Button block variant="secondary">
                  <Undo2 aria-hidden /> Devolver {formatPEN(o.pendingMinor)}
                </Button>
              }
            >
              <PaymentFields dateLabel="Fecha de devolución" />
            </ActionDialog>
          ))
        : null}

      {view.can.owner && (f === "dispatched" || f === "delivered") && view.returnable.some((r) => r.remaining > 0) ? (
        <ActionDialog
          action={actions.recordReturnAction}
          fields={base}
          operationKey
          wide
          title="Recibir prendas devueltas"
          description="Solo las aptas vuelven al stock. El dinero se gestiona aparte."
          confirmLabel="Registrar recepción"
          reason={{ label: "Motivo", required: true, hint: "Ej.: entrega fallida, cambio de talla." }}
          trigger={
            <Button block variant="secondary">
              <RotateCcw aria-hidden /> Recibir devolución
            </Button>
          }
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.05em] text-muted">
                <th className="py-1 font-extrabold">Prenda</th>
                <th className="py-1 font-extrabold">Recibidas</th>
                <th className="py-1 font-extrabold">Aptas</th>
              </tr>
            </thead>
            <tbody>
              {view.returnable.map((r) => (
                <tr key={r.variantId}>
                  <td className="py-1.5 pr-2">
                    {r.label} <span className="text-muted">(máx. {r.remaining})</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input name={`received:${r.variantId}`} type="number" min={0} max={r.remaining} defaultValue={0} aria-label={`Recibidas de ${r.label}`} disabled={r.remaining === 0} />
                  </td>
                  <td className="py-1.5">
                    <Input name={`restock:${r.variantId}`} type="number" min={0} max={r.remaining} defaultValue={0} aria-label={`Aptas de ${r.label}`} disabled={r.remaining === 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Field label="Comprometer devolución de dinero (S/, opcional)" hint="Crea una devolución pendiente; no se paga sola.">
            {(c) => <MoneyInput name="refund" {...c} />}
          </Field>
        </ActionDialog>
      ) : null}

      {open ? (
        <ActionDialog
          action={actions.setFollowUpAction}
          fields={base}
          operationKey
          title="Fecha de seguimiento"
          description="Recordatorio para revisar el pedido. Sin vencimiento automático: no libera stock."
          confirmLabel="Guardar"
          trigger={
            <Button block variant="ghost">
              <CalendarClock aria-hidden /> Seguimiento
            </Button>
          }
        >
          <div>
            <Label htmlFor="followUpAt">Fecha (vacía para quitarla)</Label>
            <Input id="followUpAt" name="followUpAt" type="date" defaultValue={view.followUpAt?.slice(0, 10) ?? ""} className="mt-1.5" />
          </div>
        </ActionDialog>
      ) : null}

      {view.can.owner && view.status !== "requested" ? (
        <ActionDialog
          action={actions.correctCustomerLinkAction}
          fields={base}
          operationKey
          title="Corregir ficha vinculada"
          description="Corrección histórica con motivo. Los datos de contacto guardados en el pedido no cambian."
          confirmLabel="Corregir vínculo"
          reason={{ label: "Motivo", required: true }}
          trigger={
            <Button block variant="ghost">
              <UserRoundCog aria-hidden /> Corregir ficha
            </Button>
          }
        >
          <Field label="Ficha correcta" hint="Fichas activas con el teléfono del pedido.">
            {(c) => (
              <Select name="customerId" defaultValue="" {...c}>
                <option value="" disabled>
                  Elige una ficha
                </option>
                {view.customerMatches
                  .filter((m) => m.status === "active" && m.id !== view.customerId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </ActionDialog>
      ) : null}

      {beforeDispatch || (view.can.owner && view.status === "confirmed" && view.returnable.every((r) => r.remaining === 0) && (f === "dispatched" || f === "delivered")) ? (
        <ActionDialog
          action={actions.cancelOrderAction}
          fields={base}
          operationKey
          tone="danger"
          title="Cancelar pedido"
          description={
            view.paidMinor > 0
              ? `Hay ${formatPEN(view.paidMinor)} cobrados: quedarán como devolución pendiente. Solo el propietario puede cancelar.`
              : view.status === "confirmed"
                ? "Libera las unidades reservadas. La cancelación es definitiva."
                : "La solicitud se cierra sin movimientos de stock."
          }
          confirmLabel="Cancelar pedido"
          reason={{ label: "Motivo", required: true }}
          trigger={
            <Button block variant="ghost" className="text-sale">
              <Ban aria-hidden /> Cancelar pedido
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
