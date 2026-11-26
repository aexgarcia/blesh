import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getOrderPage } from "@/composition/order-admin";
import { formatPhone } from "@/modules/customers/contracts";
import { actorCan, requireAdminActor } from "@/modules/identity/server";
import {
  COLLECTION_RESPONSIBLE_LABELS,
  DELIVERY_MODE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_MODE_LABELS,
  REFUND_ORIGIN_LABELS,
  SOURCE_LABELS,
} from "@/modules/sales/contracts";
import { OrderBadges } from "@/modules/sales/presentation/components/order-badges";
import { OrderOperations, type OrderOperationsView } from "@/modules/sales/presentation/components/order-operations";
import { formatLimaDate, formatLimaDateTime } from "@/shared/domain/dates";
import { formatPEN } from "@/shared/domain/money";
import { CardSkeleton, Skeleton } from "@/shared/ui/skeleton";
import { Alert, Badge, Card, CardHeader } from "@/shared/ui/surface";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";

export const metadata: Metadata = { title: "Pedido" };

const EVENT_LABELS: Record<string, string> = {
  "order.requested": "Solicitud registrada",
  "order.revised": "Nueva revisión del acuerdo",
  "order.agreement_recorded": "Acuerdo del cliente registrado",
  "order.confirmed": "Confirmado y stock reservado",
  "order.follow_up_set": "Seguimiento actualizado",
  "payment.recorded": "Cobro verificado",
  "payment.reported": "Cobro informado por transportista",
  "payment.reconciled": "Cobro de transportista conciliado",
  "fulfillment.preparing": "En preparación",
  "fulfillment.ready": "Listo",
  "fulfillment.dispatched": "Despachado (stock descontado)",
  "fulfillment.delivered": "Entregado",
  "fulfillment.picked_up": "Entregado en tienda (stock descontado)",
  "order.completed": "Completado",
  "order.cancelled": "Cancelado",
  "refund.recorded": "Devolución de dinero registrada",
  "return.received": "Prendas devueltas recibidas",
  "order.customer_relinked": "Ficha de cliente corregida",
};

export default function OrderPage({ params, searchParams }: PageProps<"/admin/pedidos/[id]">) {
  return (
    <>
      <Link href="/admin/pedidos" className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-12 w-72 rounded-full" />
            <CardSkeleton rows={4} />
          </div>
        }
      >
        <OrderView params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

async function OrderView({ params, searchParams }: PageProps<"/admin/pedidos/[id]">) {
  const actor = await requireAdminActor();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const page = await getOrderPage(actor, id);
  if (!page) notFound();
  const { order, linkedCustomer, customerMatches } = page;
  const current = order.revisions.find((r) => r.number === order.currentRevision)!;
  const terms = order.revisions.find((r) => r.number === (order.acceptedRevision ?? order.currentRevision)) ?? current;
  const returned = new Map(order.returned.map((r) => [r.variantId, r]));
  const balance = Math.max(0, order.totalMinor - order.paidMinor - order.reportedMinor);
  const owner = actorCan(actor, "refunds.manage");

  const view: OrderOperationsView = {
    id: order.id,
    version: order.version,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    totalMinor: order.totalMinor,
    paidMinor: order.paidMinor,
    reportedMinor: order.reportedMinor,
    currentRevision: order.currentRevision,
    acceptedRevision: order.acceptedRevision,
    lines: current.lines.map((l) => ({ variantId: l.variantId, label: `${l.productTitle} · ${l.colorLabel} / ${l.sizeCode}`, sku: l.sku, priceMinor: l.unitPriceMinor, quantity: l.quantity })),
    terms: {
      discountMinor: current.discountMinor,
      shippingMinor: current.shippingMinor,
      deliveryMode: terms.deliveryMode,
      deliveryAddress: current.deliveryAddress,
      deliveryNote: current.deliveryNote,
      paymentMode: current.paymentMode,
      requiredDepositMinor: current.requiredDepositMinor,
      collectionResponsible: terms.collectionResponsible,
    },
    followUpAt: order.followUpAt,
    customerId: order.customerId,
    customerMatches,
    contact: { name: order.customerName, phone: order.customerPhone ?? "" },
    reportedPayments: order.payments.filter((p) => p.kind === "payment" && p.status === "reported").map((p) => ({ id: p.id, amountMinor: p.amountMinor })),
    obligations: order.obligations
      .filter((o) => o.authorizedMinor > o.refundedMinor)
      .map((o) => ({ id: o.id, pendingMinor: o.authorizedMinor - o.refundedMinor, label: REFUND_ORIGIN_LABELS[o.origin] })),
    returnable: terms.lines.map((l) => ({ variantId: l.variantId, label: `${l.sku}`, remaining: l.quantity - (returned.get(l.variantId)?.received ?? 0) })),
    can: { owner },
  };

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">
            Pedido · {SOURCE_LABELS[order.source]} · {formatLimaDateTime(new Date(order.createdAt))}
          </p>
          <h1 className="h-section tabular-nums">{order.reference}</h1>
          <div className="mt-3">
            <OrderBadges {...order} />
          </div>
        </div>
      </header>

      {sp.creado && order.status === "requested" ? (
        <Alert tone="success" title="Solicitud registrada" className="mb-6">
          No reserva stock ni registra pagos. Acuerda entrega y cobro con el cliente, registra su aceptación y confirma.
        </Alert>
      ) : null}
      {order.status === "requested" && order.acceptedRevision !== order.currentRevision ? (
        <Alert tone="info" title={`Revisión ${order.currentRevision} pendiente de aceptación`} className="mb-6">
          Para confirmar: revisa entrega y modalidad de cobro, y registra que el cliente aceptó.
        </Alert>
      ) : null}
      {order.status === "cancelled" ? (
        <Alert tone="warning" title="Pedido cancelado" className="mb-6">
          {order.cancelReason}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title={`Productos · revisión ${current.number}`} description={order.status === "requested" ? "Total provisional hasta confirmar." : "Snapshot acordado: no cambia si cambia el catálogo."} />
            <Table>
              <THead>
                <Tr>
                  <Th>Producto</Th>
                  <Th className="text-right">Precio</Th>
                  <Th className="text-right">Cant.</Th>
                  <Th className="text-right">Importe</Th>
                </Tr>
              </THead>
              <TBody>
                {current.lines.map((l) => (
                  <Tr key={l.variantId}>
                    <Td>
                      <span className="font-bold">{l.productTitle}</span>
                      <span className="block text-[12px] text-muted">
                        {l.colorLabel} / {l.sizeCode} · {l.sku}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">{formatPEN(l.unitPriceMinor)}</Td>
                    <Td className="text-right tabular-nums">{l.quantity}</Td>
                    <Td className="text-right tabular-nums">{formatPEN(l.lineTotalMinor)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            <dl className="border-t border-line px-6 py-4">
              <Row label="Subtotal">{formatPEN(current.subtotalMinor)}</Row>
              {current.promotionDiscountMinor > 0 ? (
                <Row label={`${current.promotionLabel ?? "Pack automático"} (${current.promotionCode})`}>− {formatPEN(current.promotionDiscountMinor)}</Row>
              ) : null}
              {current.discountMinor > 0 ? <Row label="Descuento excepcional">− {formatPEN(current.discountMinor)}</Row> : null}
              <Row label="Envío">{current.deliveryMode === "shipping" ? formatPEN(current.shippingMinor) : current.deliveryMode === "pickup" ? "Recojo" : "Por acordar"}</Row>
              <div className="mt-1 flex justify-between border-t border-line pt-3 text-[15px] font-extrabold">
                <span>Total</span>
                <span className="tabular-nums">{formatPEN(current.totalMinor)}</span>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Cobros y devoluciones" description="Solo dinero verificado cuenta como cobrado. Un pantallazo no verifica un pago." />
            <dl className="grid gap-x-8 border-b border-line px-6 py-4 sm:grid-cols-2">
              <Row label="Cobrado verificado">{formatPEN(order.paidMinor)}</Row>
              <Row label="Saldo pendiente">{order.status === "cancelled" ? "—" : formatPEN(balance)}</Row>
              {order.reportedMinor > 0 ? <Row label="Cobrado por tercero, por conciliar">{formatPEN(order.reportedMinor)}</Row> : null}
              {order.refundedMinor > 0 ? <Row label="Devuelto al cliente">{formatPEN(order.refundedMinor)}</Row> : null}
            </dl>
            {order.payments.length === 0 ? (
              <p className="px-6 py-5 text-[13px] text-muted">Sin movimientos de dinero.</p>
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Movimiento</Th>
                    <Th>Medio</Th>
                    <Th>Fecha</Th>
                    <Th className="text-right">Importe</Th>
                  </Tr>
                </THead>
                <TBody>
                  {order.payments.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        {p.kind === "refund" ? "Devolución" : p.status === "reported" ? <Badge tone="warning">Por conciliar</Badge> : "Cobro verificado"}
                        {p.reference ? <span className="block text-[12px] text-muted">Ref. {p.reference}</span> : null}
                        {p.note ? <span className="block text-[12px] text-muted">{p.note}</span> : null}
                      </Td>
                      <Td>{PAYMENT_METHOD_LABELS[p.method]}</Td>
                      <Td className="whitespace-nowrap text-muted">{formatLimaDate(new Date(p.receivedAt))}</Td>
                      <Td className={`text-right font-bold tabular-nums ${p.kind === "refund" ? "text-sale" : ""}`}>
                        {p.kind === "refund" ? "− " : ""}
                        {formatPEN(p.amountMinor)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
            {order.obligations.length > 0 ? (
              <div className="border-t border-line px-6 py-4">
                <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.05em]">Devoluciones de dinero</h3>
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {order.obligations.map((o) => (
                    <li key={o.id} className="flex justify-between gap-4">
                      <span>
                        {REFUND_ORIGIN_LABELS[o.origin]} <span className="text-muted">· {o.reason}</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatPEN(o.refundedMinor)} / {formatPEN(o.authorizedMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Historial" description="Quién hizo qué y cuándo." />
            <ol className="flex flex-col divide-y divide-line">
              {order.events.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-6 py-3 text-[13px]">
                  <span>
                    <span className="font-bold">{EVENT_LABELS[e.event] ?? e.event}</span>
                    {e.revision ? <span className="text-muted"> · rev. {e.revision}</span> : null}
                    {e.reason ? <span className="block text-[12px] text-muted">{e.reason}</span> : null}
                  </span>
                  <span className="text-right text-[12px] text-muted">
                    {e.actorName ?? "Cliente (web)"}
                    <span className="block">{formatLimaDateTime(new Date(e.createdAt))}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.05em]">Acciones</h2>
            <OrderOperations key={order.version} view={view} />
          </Card>

          <Card>
            <CardHeader title="Cliente" description="Contacto guardado en la solicitud." />
            <dl className="px-6 py-4">
              <Row label="Nombre">{order.customerName}</Row>
              <Row label="Teléfono">{order.customerPhone ? formatPhone(order.customerPhone) : "Por WhatsApp (pídelo al confirmar)"}</Row>
              <Row label="Ficha">
                {linkedCustomer ? (
                  <Link href={`/admin/clientes/${linkedCustomer.id}`} className="underline underline-offset-4">
                    {linkedCustomer.name}
                  </Link>
                ) : (
                  "Se elige al confirmar"
                )}
              </Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Entrega y cobro" description={order.acceptedRevision ? `Acordado en la revisión ${order.acceptedRevision}.` : "Aún sin acuerdo registrado."} />
            <dl className="px-6 py-4">
              <Row label="Entrega">{DELIVERY_MODE_LABELS[terms.deliveryMode]}</Row>
              {terms.deliveryAddress ? <Row label="Dirección">{terms.deliveryAddress}</Row> : null}
              {terms.deliveryNote ? <Row label={terms.deliveryMode === "pickup" ? "Sede / fecha" : "Fecha"}>{terms.deliveryNote}</Row> : null}
              <Row label="Modalidad">{terms.paymentMode ? PAYMENT_MODE_LABELS[terms.paymentMode] : "Por acordar"}</Row>
              {terms.paymentMode === "deposit_on_delivery" ? <Row label="Adelanto acordado">{formatPEN(terms.requiredDepositMinor)}</Row> : null}
              {terms.paymentMode && terms.paymentMode !== "prepaid" ? <Row label="Cobra en la entrega">{COLLECTION_RESPONSIBLE_LABELS[terms.collectionResponsible]}</Row> : null}
              {order.carrier ? <Row label="Transportista">{order.carrier}</Row> : null}
              {order.trackingCode ? <Row label="Seguimiento">{order.trackingCode}</Row> : null}
              {order.followUpAt ? <Row label="Revisar el">{formatLimaDate(new Date(order.followUpAt))}</Row> : null}
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
