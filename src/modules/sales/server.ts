import "server-only";

import { randomBytes } from "node:crypto";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import { getQuotableVariants } from "@/modules/catalog/server";
import { normalizeName, normalizePhone } from "@/modules/customers/contracts";
import { createCustomerWithin, CustomerFailure, requireLinkableCustomerWithin } from "@/modules/customers/server";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";
import { inventoryWithin } from "@/modules/inventory/server";

import type { CustomerPort, SalesDeps, SalesStore } from "./application/ports";
import type { CustomerOrderRow, OrderSummary } from "./contracts";
import * as queries from "./infrastructure/sales-queries";
import { salesTx } from "./infrastructure/sales-store";

/**
 * Fachada de ventas. Dependencias: sales → catalog (precios), inventory (reservas),
 * customers (fichas). Ninguno de ellos importa sales.
 */

function customerPort(tx: AnyDatabase): CustomerPort {
  const guard = async <T>(run: () => Promise<T>) => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof CustomerFailure) return { ok: false as const, message: error.message, field: error.field };
      throw error;
    }
  };
  return {
    requireLinkable: (actor, id) => guard(async () => ({ ok: true as const, id: (await requireLinkableCustomerWithin(tx, actor as AdminActor, id)).id })),
    create: (actor, input) => guard(async () => ({ ok: true as const, id: (await createCustomerWithin(tx, actor as AdminActor, input)).id })),
  };
}

export function createSalesStore(db: AnyDatabase): SalesStore {
  return {
    transaction: (fn) =>
      db.transaction((raw) => {
        const tx = raw as unknown as AnyDatabase;
        return fn({ sales: salesTx(tx), inventory: inventoryWithin(tx), customers: customerPort(tx) });
      }),
  };
}

export function getSalesDeps(): SalesDeps {
  return buildSalesDeps(getDb());
}

/** Dependencias sobre una conexión dada (aplicación o base de pruebas). */
export function buildSalesDeps(db: AnyDatabase): SalesDeps {
  return {
    store: createSalesStore(db),
    quote: (ids) => getQuotableVariants(ids, db),
    authorize: (actor, capability) => actorCan(actor as AdminActor, capability),
    randomBytes: () => randomBytes(8),
    clock: { now: () => new Date() },
    normalizeContact: ({ name, phone }) => {
      const n = normalizeName(name);
      if (!n.ok) return { ok: false, field: "name", message: n.problem.message };
      const p = normalizePhone(phone);
      if (!p.ok) return { ok: false, field: "phone", message: p.problem.message };
      return { ok: true, name: n.value, phone: p.value };
    },
  };
}

function assertCanView(actor: AdminActor) {
  if (!actorCan(actor, "orders.operate")) throw new Error("FORBIDDEN");
}

export function listOrders(actor: AdminActor, filter: queries.OrderListFilter): Promise<{ rows: OrderSummary[]; total: number }> {
  assertCanView(actor);
  return queries.listOrders(getDb(), filter);
}

export function getOrderDetail(actor: AdminActor, id: string) {
  assertCanView(actor);
  return queries.getOrderDetail(getDb(), id);
}

/** Historial de un cliente (lo compone la pantalla de Clientes; customers no lee ventas). */
export function listOrdersByCustomer(actor: AdminActor, customerId: string): Promise<CustomerOrderRow[]> {
  assertCanView(actor);
  return queries.listOrdersByCustomer(getDb(), customerId);
}
