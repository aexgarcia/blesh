import "server-only";

import type { CustomerDetail, CustomerMatch } from "@/modules/customers/contracts";
import { findCustomersByPhone, getCustomer } from "@/modules/customers/server";
import type { AdminActor } from "@/modules/identity/contracts";
import type { CustomerOrderRow } from "@/modules/sales/contracts";
import { listOrdersByCustomer } from "@/modules/sales/server";

export type CustomerProfile = {
  customer: CustomerDetail;
  /** Otras fichas con el mismo teléfono, para revisión humana. */
  sharedPhone: CustomerMatch[];
  orders: CustomerOrderRow[];
};

/** Ficha + historial: customers no lee ventas; esta composición une ambas fachadas por id. */
export async function getCustomerProfile(actor: AdminActor, id: string): Promise<CustomerProfile | null> {
  const customer = await getCustomer(actor, id);
  if (!customer) return null;
  const [sharedPhone, orders] = await Promise.all([findCustomersByPhone(actor, customer.phone, customer.id), listOrdersByCustomer(actor, customer.id)]);
  return { customer, sharedPhone, orders };
}
