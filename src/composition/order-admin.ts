import "server-only";

import type { CustomerDetail, CustomerMatch } from "@/modules/customers/contracts";
import { findCustomersByPhone, getCustomer } from "@/modules/customers/server";
import type { AdminActor } from "@/modules/identity/contracts";
import { getAdminDisplayNames } from "@/modules/identity/server";
import type { OrderDetail } from "@/modules/sales/contracts";
import { getOrderDetail } from "@/modules/sales/server";

export type OrderPage = {
  order: OrderDetail;
  /** Ficha vinculada (si la hay) y fichas candidatas por teléfono para elegir al confirmar. */
  linkedCustomer: Pick<CustomerDetail, "id" | "name" | "status"> | null;
  customerMatches: CustomerMatch[];
};

/** Pedido + nombres del equipo (identity) + fichas de cliente (customers), unidos por ids. */
export async function getOrderPage(actor: AdminActor, id: string): Promise<OrderPage | null> {
  const detail = await getOrderDetail(actor, id);
  if (!detail) return null;
  const { actorIds, revisionAuthors, eventActors, ...order } = detail;
  const [names, matches, linked] = await Promise.all([
    getAdminDisplayNames(actorIds),
    findCustomersByPhone(actor, order.customerPhone),
    order.customerId ? getCustomer(actor, order.customerId) : Promise.resolve(null),
  ]);
  const name = (memberId: string | null) => (memberId ? (names.get(memberId) ?? "Usuario") : null);
  return {
    order: {
      ...order,
      revisions: order.revisions.map((r, i) => ({ ...r, createdByName: name(revisionAuthors[i]) })),
      events: order.events.map((e, i) => ({ ...e, actorName: name(eventActors[i]) })),
    },
    linkedCustomer: linked ? { id: linked.id, name: linked.name, status: linked.status } : null,
    customerMatches: matches,
  };
}
