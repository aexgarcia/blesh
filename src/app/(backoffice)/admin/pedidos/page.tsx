import { ChevronLeft, ChevronRight, Plus, Search, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireAdminActor } from "@/modules/identity/server";
import { COLLECTION_LABELS, ORDER_STATUS_LABELS, ORDERS_PAGE_SIZE, SOURCE_LABELS, type CollectionStatus, type OrderStatus } from "@/modules/sales/contracts";
import { OrderBadges } from "@/modules/sales/presentation/components/order-badges";
import { listOrders } from "@/modules/sales/server";
import { formatLimaDate } from "@/shared/domain/dates";
import { formatPEN } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { Input, Select } from "@/shared/ui/form";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Badge, Card, EmptyState, PageHeader } from "@/shared/ui/surface";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";

export const metadata: Metadata = { title: "Pedidos" };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Pedidos"
        description="Solicitudes y pedidos manuales: acuerdo, reserva, cobros y entrega."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/pedidos/nuevo">
              <Plus aria-hidden /> Pedido manual
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<CardSkeleton rows={5} />}>
        <OrdersList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function OrdersList({ searchParams }: Pick<PageProps<"/admin/pedidos">, "searchParams">) {
  const actor = await requireAdminActor();
  const params = await searchParams;
  // Solo la referencia viaja en la URL: nunca nombres ni teléfonos.
  const reference = (one(params.ref) ?? "").toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 12);
  const statusParam = one(params.estado);
  const status = statusParam && statusParam in ORDER_STATUS_LABELS ? (statusParam as OrderStatus) : undefined;
  const collectionParam = one(params.cobro);
  const collection = collectionParam && collectionParam in COLLECTION_LABELS ? (collectionParam as CollectionStatus) : undefined;
  const followUp = one(params.seguimiento) === "1";
  const page = Math.max(1, Number.parseInt(one(params.pagina) ?? "1", 10) || 1);

  const { rows, total } = await listOrders(actor, { reference: reference || undefined, status, collection, followUpDue: followUp ? new Date() : undefined, page, pageSize: ORDERS_PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const filtered = Boolean(reference || status || collection || followUp);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (reference) sp.set("ref", reference);
    if (status) sp.set("estado", status);
    if (collection) sp.set("cobro", collection);
    if (followUp) sp.set("seguimiento", "1");
    sp.set("pagina", String(p));
    return `/admin/pedidos?${sp}`;
  };

  return (
    <Card>
      <form className="flex flex-wrap items-center gap-3 border-b border-line p-5" role="search">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="ref" className="sr-only">
            Referencia
          </label>
          <Input id="ref" name="ref" defaultValue={reference} placeholder="Referencia (BL-…)" className="pl-10 uppercase" autoComplete="off" />
        </div>
        <label htmlFor="estado" className="sr-only">
          Estado
        </label>
        <Select id="estado" name="estado" defaultValue={status ?? ""} className="w-44">
          <option value="">Todos los estados</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label htmlFor="cobro" className="sr-only">
          Cobro
        </label>
        <Select id="cobro" name="cobro" defaultValue={collection ?? ""} className="w-44">
          <option value="">Todo cobro</option>
          {Object.entries(COLLECTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" name="seguimiento" value="1" defaultChecked={followUp} className="size-4 accent-ink" />
          Seguimiento vencido
        </label>
        <Button type="submit" variant="secondary" size="lg">
          Filtrar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag />}
          title={filtered ? "Sin resultados" : "Aún no hay pedidos"}
          description={filtered ? "Prueba con otros filtros." : "Registra un pedido manual de WhatsApp o tienda. Las solicitudes web llegarán aquí con la tienda."}
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Referencia</Th>
                <Th>Cliente</Th>
                <Th>Estado</Th>
                <Th className="text-right">Unid.</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Saldo</Th>
                <Th>Fecha</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((o) => {
                const active = o.status === "requested" || o.status === "confirmed";
                const due = active && o.followUpAt && new Date(o.followUpAt) <= new Date();
                return (
                  <Tr key={o.id} className="hover:bg-bg/70">
                    <Td>
                      <Link href={`/admin/pedidos/${o.id}`} className="font-extrabold tabular-nums underline-offset-4 hover:underline">
                        {o.reference}
                      </Link>
                      <span className="block text-[12px] text-muted">{SOURCE_LABELS[o.source]}</span>
                    </Td>
                    <Td>{o.customerName}</Td>
                    <Td>
                      <OrderBadges {...o} compact />
                      {due ? (
                        <Badge tone="danger" className="mt-1.5">
                          Seguimiento vencido
                        </Badge>
                      ) : null}
                    </Td>
                    <Td className="text-right tabular-nums">{o.units}</Td>
                    <Td className="text-right tabular-nums">
                      {formatPEN(o.totalMinor)}
                      {o.status === "requested" ? <span className="block text-[11px] text-muted">provisional</span> : null}
                    </Td>
                    <Td className="text-right tabular-nums">{active ? formatPEN(Math.max(0, o.totalMinor - o.paidMinor)) : "—"}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatLimaDate(new Date(o.createdAt))}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          <nav aria-label="Paginación" className="flex items-center justify-between border-t border-line px-6 py-4 text-[13px] text-muted">
            <span>
              {total} pedido{total === 1 ? "" : "s"} · página {page} de {pages} · Una solicitud no implica pago ni reserva.
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft aria-hidden /> Anterior
                  </Link>
                </Button>
              ) : null}
              {page < pages ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Siguiente <ChevronRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </Card>
  );
}
