import { ArrowLeft, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCustomerProfile } from "@/composition/customer-admin";
import { CUSTOMER_STATUS_LABELS, formatPhone } from "@/modules/customers/contracts";
import { CustomerForm } from "@/modules/customers/presentation/components/customer-form";
import { CustomerStatusControls } from "@/modules/customers/presentation/components/customer-status-controls";
import { actorCan, requireAdminActor } from "@/modules/identity/server";
import { ORDER_STATUS_LABELS, REFUND_LABELS } from "@/modules/sales/contracts";
import { formatLimaDate } from "@/shared/domain/dates";
import { formatPEN } from "@/shared/domain/money";
import { CardSkeleton, Skeleton } from "@/shared/ui/skeleton";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/shared/ui/surface";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";

export const metadata: Metadata = { title: "Cliente" };

export default function CustomerPage({ params, searchParams }: PageProps<"/admin/clientes/[id]">) {
  return (
    <>
      <Link href="/admin/clientes" className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Clientes
      </Link>
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-12 w-72 rounded-full" />
            <CardSkeleton rows={3} />
          </div>
        }
      >
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Profile({ params, searchParams }: PageProps<"/admin/clientes/[id]">) {
  const actor = await requireAdminActor();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await getCustomerProfile(actor, id);
  if (!profile) notFound();
  const { customer, sharedPhone, orders } = profile;
  const archived = customer.status === "archived";
  const canArchive = actorCan(actor, "customers.archive");

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Cliente</p>
          <h1 className="h-section">{customer.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone={archived ? "warning" : "success"}>{CUSTOMER_STATUS_LABELS[customer.status]}</Badge>
            <span className="tabular-nums">{formatPhone(customer.phone)}</span>
            <span aria-hidden>·</span>
            Ficha creada el {formatLimaDate(new Date(customer.createdAt))}
          </p>
        </div>
        {canArchive ? <CustomerStatusControls customer={customer} /> : null}
      </header>

      {sp.creado ? (
        <Alert tone="success" title="Ficha creada" className="mb-6">
          Ya puedes elegirla al confirmar sus pedidos.
        </Alert>
      ) : null}
      {archived ? (
        <Alert tone="warning" title="Ficha archivada" className="mb-6">
          {customer.archivedAt ? `Desde el ${formatLimaDate(new Date(customer.archivedAt))}. ` : null}
          Sus pedidos se conservan. Para editarla o usarla en pedidos nuevos, {canArchive ? "reactívala." : "pide al propietario que la reactive."}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Datos de contacto" description="Editar la ficha no cambia los datos guardados en pedidos anteriores." />
            <div className="p-6">
              <CustomerForm key={customer.version} customer={customer} disabled={archived} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Pedidos" description="Solicitudes, confirmados, cancelados y completados, con cobros y saldo de cada pedido." />
            {orders.length === 0 ? (
              <EmptyState icon={<ReceiptText />} title="Sin pedidos vinculados" description="Los pedidos aparecerán aquí cuando se confirmen con esta ficha." />
            ) : (
              <>
                <Table>
                  <THead>
                    <Tr>
                      <Th>Pedido</Th>
                      <Th>Estado</Th>
                      <Th className="text-right">Total</Th>
                      <Th className="text-right">Cobrado</Th>
                      <Th className="text-right">Saldo</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {orders.map((o) => {
                      const active = o.status === "requested" || o.status === "confirmed";
                      return (
                        <Tr key={o.id}>
                          <Td>
                            <Link href={`/admin/pedidos/${o.id}`} className="font-bold underline-offset-4 hover:underline">
                              {o.reference}
                            </Link>
                            <span className="block text-[12px] text-muted">{formatLimaDate(new Date(o.createdAt))}</span>
                          </Td>
                          <Td>
                            <span className="flex flex-wrap gap-1">
                              <Badge tone={o.status === "cancelled" ? "warning" : o.status === "completed" ? "success" : "neutral"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                              {o.refundStatus !== "none" ? <Badge tone="danger">{REFUND_LABELS[o.refundStatus]}</Badge> : null}
                            </span>
                          </Td>
                          <Td className="text-right tabular-nums">{formatPEN(o.totalMinor)}</Td>
                          <Td className="text-right tabular-nums">{formatPEN(o.paidMinor - o.refundedMinor)}</Td>
                          <Td className="text-right tabular-nums">{active ? formatPEN(Math.max(0, o.totalMinor - o.paidMinor)) : "—"}</Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
                <p className="border-t border-line px-6 py-4 text-[13px] text-muted">
                  Compras completadas: <strong className="text-ink">{orders.filter((o) => o.status === "completed").length}</strong>. Cobrado = cobros verificados menos devoluciones. Las solicitudes no cuentan como compras.
                </p>
              </>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Mismo teléfono" description="El teléfono no identifica a una persona: varias fichas pueden compartirlo." />
            <div className="p-6 text-[13px]">
              {sharedPhone.length === 0 ? (
                <p className="text-muted">Ninguna otra ficha usa este número.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sharedPhone.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/clientes/${m.id}`} className="font-bold underline-offset-4 hover:underline">
                        {m.name}
                      </Link>
                      <Badge tone={m.status === "active" ? "success" : "warning"}>{CUSTOMER_STATUS_LABELS[m.status]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
