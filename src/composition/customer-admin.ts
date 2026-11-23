import "server-only";

import type { CustomerDetail, CustomerMatch } from "@/modules/customers/contracts";
import { findCustomersByPhone, getCustomer } from "@/modules/customers/server";
import type { AdminActor } from "@/modules/identity/contracts";

/** Pedido de la ficha tal como lo resumirá ventas (snapshot del pedido, no de la ficha). */
export type CustomerOrderRow = {
  id: string;
  reference: string;
  status: string;
  totalMinor: number;
  createdAt: string;
};

export type CustomerProfile = {
  customer: CustomerDetail;
  /** Otras fichas con el mismo teléfono, para revisión humana. */
  sharedPhone: CustomerMatch[];
  orders: CustomerOrderRow[];
};

/**
 * Ficha + historial. Customers no lee ventas: esta composición unirá `GetCustomer` con
 * `ListOrdersByCustomer` de la fachada de ventas cuando exista (fase 5). Hasta entonces no hay
 * pedidos vinculados y el historial está vacío de verdad.
 */
export async function getCustomerProfile(actor: AdminActor, id: string): Promise<CustomerProfile | null> {
  const customer = await getCustomer(actor, id);
  if (!customer) return null;
  const sharedPhone = await findCustomersByPhone(actor, customer.phone, customer.id);
  return { customer, sharedPhone, orders: [] };
}
