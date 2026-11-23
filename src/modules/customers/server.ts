import "server-only";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";

import {
  createCustomerInTx,
  CustomerFailure,
  requireLinkableCustomerInTx,
  toCustomerDetail,
  type CreateCustomerInput,
  type CustomerDeps,
} from "./application/customer-management";
import type { CustomerDetail, CustomerMatch, CustomerPage, CustomerStatus, LinkableCustomer } from "./contracts";
import { normalizePhone } from "./domain/customer";
import { createCustomerStore, customerTx, findPhoneMatches, getCustomerRow, listCustomers } from "./infrastructure/customer-store";

/** Fachada del módulo customers. Ventas depende de ella; customers nunca importa ventas. */

const authorize: CustomerDeps["authorize"] = (actor, capability) => actorCan(actor as AdminActor, capability);

export function getCustomerDeps(): CustomerDeps {
  return { store: createCustomerStore(getDb()), authorize };
}

function assertCanRead(actor: AdminActor) {
  if (!actorCan(actor, "customers.manage")) throw new CustomerFailure("FORBIDDEN", "No tienes permiso para ver clientes.");
}

export function searchCustomers(actor: AdminActor, filter: { search: string; status?: CustomerStatus; page: number; pageSize: number }): Promise<CustomerPage> {
  assertCanRead(actor);
  return listCustomers(getDb(), filter);
}

export async function getCustomer(actor: AdminActor, id: string): Promise<CustomerDetail | null> {
  assertCanRead(actor);
  const row = await getCustomerRow(getDb(), id);
  return row ? toCustomerDetail(row) : null;
}

/** Fichas candidatas por teléfono para revisión humana (nunca se vinculan solas). */
export async function findCustomersByPhone(actor: AdminActor, phone: string, excludeId?: string): Promise<CustomerMatch[]> {
  assertCanRead(actor);
  const parsed = normalizePhone(phone);
  return parsed.ok ? findPhoneMatches(getDb(), parsed.value, excludeId) : [];
}

/**
 * Para ventas: crear ficha dentro de SU transacción al confirmar un pedido
 * (ficha + vínculo + confirmación atómicos; `creationKey` evita duplicados en reintentos).
 */
export function createCustomerWithin(tx: AnyDatabase, actor: AdminActor, input: CreateCustomerInput): Promise<CustomerDetail> {
  return createCustomerInTx(customerTx(tx), authorize, actor, input);
}

/** Para ventas: bloquea y valida una ficha activa dentro de su transacción y devuelve los datos para el snapshot. */
export function requireLinkableCustomerWithin(tx: AnyDatabase, actor: AdminActor, customerId: string): Promise<LinkableCustomer> {
  return requireLinkableCustomerInTx(customerTx(tx), authorize, actor, customerId);
}

export { CustomerFailure };
