/**
 * Pedidos, reservas y cobros sobre PostgreSQL real (base blesh_test, rol runtime).
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import * as customersApp from "@/modules/customers/application/customer-management";
import { createCustomerStore } from "@/modules/customers/infrastructure/customer-store";
import { roleCan } from "@/modules/identity/domain/permissions";
import * as orders from "@/modules/sales/application/order-commands";
import type { SalesDeps } from "@/modules/sales/application/ports";
import type { PaymentMode } from "@/modules/sales/contracts";
import { buildSalesDeps } from "@/modules/sales/server";

import { openTestDb, resetTables } from "../support/test-db";

const { sql, db } = openTestDb();
const owner = { membershipId: randomUUID(), role: "owner" as const };
const operator = { membershipId: randomUUID(), role: "operator" as const };
const deps: SalesDeps = buildSalesDeps(db);

let negroM: string;
let blancoS: string;

beforeEach(async () => {
  await resetTables([
    "order_events",
    "return_receipt_items",
    "return_receipts",
    "payment_records",
    "refund_obligations",
    "order_items",
    "order_revisions",
    "orders",
    "customers",
    "stock_reservations",
    "stock_movements",
    "inventory_balances",
    "product_images",
    "product_variants",
    "product_colors",
    "products",
    "audit_events",
  ]);
  const [category] = await sql<{ id: string }[]>`select id from app.categories where slug = 'basicos'`; // sin pack: importes fijos
  const [product] = await sql<{ id: string }[]>`
    insert into app.products (slug, title, category_id, status, published_at, first_published_at, created_by, updated_by)
    values ('boxy-essential', 'Boxy Essential', ${category.id}, 'published', now(), now(), ${owner.membershipId}, ${owner.membershipId}) returning id`;
  const [negro] = await sql<{ id: string }[]>`insert into app.product_colors (product_id, color_code, label, slug, is_primary) values (${product.id}, 'negro', 'Negro', 'negro', true) returning id`;
  const [blanco] = await sql<{ id: string }[]>`insert into app.product_colors (product_id, color_code, label, slug) values (${product.id}, 'blanco', 'Blanco', 'blanco') returning id`;
  // Precio S/ 50,00: dos unidades = S/ 100,00 (casos de aceptación de pagos y reservas).
  [{ id: negroM }] = await sql<{ id: string }[]>`insert into app.product_variants (product_id, color_id, sku, size_code, price_minor) values (${product.id}, ${negro.id}, 'BOXY-NEGRO-M', 'M', 5000) returning id`;
  [{ id: blancoS }] = await sql<{ id: string }[]>`insert into app.product_variants (product_id, color_id, sku, size_code, price_minor) values (${product.id}, ${blanco.id}, 'BOXY-BLANCO-S', 'S', 5000) returning id`;
  await sql`insert into app.inventory_balances (variant_id, on_hand) values (${negroM}, 5), (${blancoS}, 1)`;
});

afterAll(async () => {
  await sql.end();
});

function unwrap<T>(result: { ok: true; value: T } | { ok: false; code?: string; message: string }): T {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value;
}

async function balance(variantId: string) {
  const [row] = await sql<{ on_hand: number; reserved: number }[]>`select on_hand, reserved from app.inventory_balances where variant_id = ${variantId}`;
  return { onHand: row.on_hand, reserved: row.reserved };
}

async function order(id: string) {
  const [row] = await sql<{ version: number; status: string; fulfillment_status: string; paid_minor: number; reported_minor: number; refunded_minor: number; collection_status: string; refund_status: string; total_minor: number; customer_id: string | null; customer_name: string }[]>`
    select * from app.orders where id = ${id}`;
  return row;
}

const key = () => randomUUID();

async function request(lines = [{ variantId: negroM, quantity: 2 }], actor = operator) {
  return unwrap(
    await orders.createOrderRequest(deps, actor, { source: "whatsapp", lines, customerName: "Ana Pérez", customerPhone: "987654321", deliveryPreference: "undecided", creationKey: key() }),
  );
}

/** Revisión con entrega/cobro, acuerdo registrado y confirmación con ficha nueva. */
async function confirmed(opts: { mode?: PaymentMode; deposit?: number; delivery?: "pickup" | "shipping"; responsible?: "company" | "carrier"; lines?: { variantId: string; quantity: number }[] } = {}) {
  const { id } = await request(opts.lines);
  const delivery = opts.delivery ?? "shipping";
  unwrap(
    await orders.reviseAgreement(deps, owner, {
      orderId: id,
      expectedVersion: (await order(id)).version,
      operationKey: key(),
      lines: opts.lines ?? [{ variantId: negroM, quantity: 2 }],
      discountMinor: 0,
      shippingMinor: 0,
      deliveryMode: delivery,
      deliveryAddress: delivery === "shipping" ? "Av. Ejemplo 123, Lima" : null,
      deliveryNote: null,
      paymentMode: opts.mode ?? "prepaid",
      requiredDepositMinor: opts.deposit ?? 0,
      collectionResponsible: opts.responsible ?? "company",
      note: null,
    }),
  );
  unwrap(await orders.recordCustomerAgreement(deps, operator, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), revision: 2, note: "Aceptó por WhatsApp" }));
  unwrap(
    await orders.confirmOrder(deps, operator, {
      orderId: id,
      expectedVersion: (await order(id)).version,
      operationKey: key(),
      customer: { kind: "new", name: "Ana Pérez", phone: "987654321", email: null, confirmSharedPhone: true },
      followUpAt: null,
    }),
  );
  return id;
}

const pay = async (orderId: string, amountMinor: number, operationKey = key(), actor: typeof owner | typeof operator = operator, extra: Partial<orders.PaymentInput> = {}) =>
  orders.recordPayment(deps, actor, {
    orderId,
    expectedVersion: (await order(orderId)).version,
    operationKey,
    amountMinor,
    method: "yape",
    reference: null,
    note: null,
    receivedAt: new Date(),
    reportedByCarrier: false,
    acceptExcess: false,
    ...extra,
  });

const step = async (fn: typeof orders.markPreparing, orderId: string, actor: typeof owner | typeof operator = operator) =>
  fn(deps, actor, { orderId, expectedVersion: (await order(orderId)).version, operationKey: key() });

const dispatch = async (orderId: string, operationKey = key()) =>
  orders.dispatchOrder(deps, operator, { orderId, expectedVersion: (await order(orderId)).version, operationKey, carrier: "Courier", trackingCode: null });

describe("pedido manual", () => {
  it("cotiza en servidor, no reserva y es idempotente ante envíos simultáneos", async () => {
    const creationKey = key();
    const input = { source: "whatsapp" as const, lines: [{ variantId: negroM, quantity: 1 }, { variantId: negroM, quantity: 1 }], customerName: "Ana", customerPhone: "987654321", deliveryPreference: "pickup" as const, creationKey };
    const results = await Promise.all(Array.from({ length: 5 }, () => orders.createOrderRequest(deps, operator, input)));
    expect(new Set(results.map((r) => unwrap(r).id)).size).toBe(1);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.orders`;
    expect(n).toBe(1);
    const id = unwrap(results[0]).id;
    expect((await order(id)).total_minor).toBe(10000); // 2 × S/ 50 unidas en una línea
    expect(await balance(negroM)).toEqual({ onHand: 5, reserved: 0 });

    const other = await orders.createOrderRequest(deps, operator, { ...input, customerName: "Otra persona" });
    expect(other.ok ? null : other.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("rechaza variantes no publicadas", async () => {
    await sql`update app.product_variants set active = false where id = ${blancoS}`;
    const result = await orders.createOrderRequest(deps, operator, { source: "whatsapp", lines: [{ variantId: blancoS, quantity: 1 }], customerName: "Ana", customerPhone: "987654321", deliveryPreference: "undecided", creationKey: key() });
    expect(result.ok ? null : result.code).toBe("PRODUCT_UNAVAILABLE");
  });
});

describe("acuerdo y confirmación", () => {
  it("exige acuerdo vigente; una nueva revisión invalida el anterior", async () => {
    const { id } = await request();
    const confirm = async () =>
      orders.confirmOrder(deps, operator, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), customer: { kind: "new", name: "Ana", phone: "987654321", email: null, confirmSharedPhone: false }, followUpAt: null });
    expect(((await confirm()) as { code?: string }).code).toBe("AGREEMENT_REQUIRED");
    unwrap(await orders.recordCustomerAgreement(deps, operator, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), revision: 1, note: null }));
    // Revisión 1 sin entrega ni modalidad: tampoco se confirma.
    expect(((await confirm()) as { code?: string }).code).toBe("AGREEMENT_REQUIRED");
  });

  it("operator no autoriza contraentrega ni descuentos excepcionales", async () => {
    const { id } = await request();
    const revise = async (actor: typeof owner | typeof operator, paymentMode: PaymentMode, discountMinor: number) =>
      orders.reviseAgreement(deps, actor, {
        orderId: id,
        expectedVersion: (await order(id)).version,
        operationKey: key(),
        lines: [{ variantId: negroM, quantity: 2 }],
        discountMinor,
        shippingMinor: 1000,
        deliveryMode: "shipping",
        deliveryAddress: "Av. Ejemplo 123",
        deliveryNote: null,
        paymentMode,
        requiredDepositMinor: 0,
        collectionResponsible: "carrier",
        note: null,
      });
    expect(((await revise(operator, "cash_on_delivery", 0)) as { code?: string }).code).toBe("FORBIDDEN");
    expect(((await revise(operator, "prepaid", 500)) as { code?: string }).code).toBe("FORBIDDEN"); // descuento excepcional
    expect(((await revise(owner, "prepaid", 0)) as { code?: string }).code).toBe("VALIDATION_ERROR"); // anticipado no cobra el transportista
    unwrap(await revise(owner, "cash_on_delivery", 500));
    expect((await order(id)).total_minor).toBe(10000 - 500 + 1000);
  });

  it("vincula la ficha al confirmar sin duplicarla y conserva el snapshot al editarla", async () => {
    const id = await confirmed();
    const o = await order(id);
    expect(o.status).toBe("confirmed");
    expect(o.customer_id).not.toBeNull();
    expect(await balance(negroM)).toEqual({ onHand: 5, reserved: 2 });

    const customerDeps = { store: createCustomerStore(db), authorize: (a: { role: "owner" | "operator" }, c: "customers.manage" | "customers.archive") => roleCan(a.role, c) };
    const [c] = await sql<{ version: number }[]>`select version from app.customers where id = ${o.customer_id}`;
    unwrap(await customersApp.updateCustomer(customerDeps, operator, { id: o.customer_id!, expectedVersion: c.version, name: "Ana María Pérez", phone: "912345678", confirmSharedPhone: false }));
    expect((await order(id)).customer_name).toBe("Ana Pérez");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.customers`;
    expect(n).toBe(1);
  });

  it("la última unidad: dos confirmaciones simultáneas, solo una reserva", async () => {
    const a = await request([{ variantId: blancoS, quantity: 1 }]);
    const b = await request([{ variantId: blancoS, quantity: 1 }]);
    const prepare = async (id: string) => {
      unwrap(await orders.reviseAgreement(deps, owner, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), lines: [{ variantId: blancoS, quantity: 1 }], discountMinor: 0, shippingMinor: 0, deliveryMode: "pickup", deliveryAddress: null, deliveryNote: null, paymentMode: "prepaid", requiredDepositMinor: 0, collectionResponsible: "company", note: null }));
      unwrap(await orders.recordCustomerAgreement(deps, owner, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), revision: 2, note: null }));
    };
    await prepare(a.id);
    await prepare(b.id);
    const confirm = async (id: string) =>
      orders.confirmOrder(deps, operator, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), customer: { kind: "new", name: "Cliente", phone: "987654321", email: null, confirmSharedPhone: true }, followUpAt: null });
    const results = await Promise.all([confirm(a.id), confirm(b.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await balance(blancoS)).toEqual({ onHand: 1, reserved: 1 });
  });

  it("multilínea: si falta una línea no se reserva ninguna (rollback)", async () => {
    const id = await confirmed({ lines: [{ variantId: blancoS, quantity: 1 }] }); // agota Blanco/S
    expect(await balance(blancoS)).toEqual({ onHand: 1, reserved: 1 });
    const result = await confirmed({ lines: [{ variantId: negroM, quantity: 2 }, { variantId: blancoS, quantity: 1 }] }).catch((e: Error) => e);
    expect(String(result)).toContain("INSUFFICIENT_STOCK");
    expect(await balance(negroM)).toEqual({ onHand: 5, reserved: 0 });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.stock_reservations where order_id <> ${id}`;
    expect(n).toBe(0);
  });
});

describe("cobros", () => {
  it("abonos 30 + 20 dejan 50 cobrado; reenviar la misma operación no suma otra vez", async () => {
    const id = await confirmed({ mode: "deposit_on_delivery", deposit: 3000 });
    unwrap(await pay(id, 3000));
    const second = key();
    unwrap(await pay(id, 2000, second));
    unwrap(await pay(id, 2000, second)); // reintento tras timeout
    const o = await order(id);
    expect(o.paid_minor).toBe(5000);
    expect(o.collection_status).toBe("partially_paid");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.payment_records where order_id = ${id}`;
    expect(n).toBe(2);
  });

  it("cobros simultáneos no superan el saldo y el exceso exige al propietario", async () => {
    const id = await confirmed();
    const version = (await order(id)).version;
    const attempt = (amountMinor: number) =>
      orders.recordPayment(deps, operator, { orderId: id, expectedVersion: version, operationKey: key(), amountMinor, method: "plin", reference: null, note: null, receivedAt: new Date(), reportedByCarrier: false, acceptExcess: false });
    const results = await Promise.all([attempt(6000), attempt(6000)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await order(id)).paid_minor).toBe(6000);

    expect(((await pay(id, 5000)) as { code?: string }).code).toBe("OVERPAYMENT");
    expect(((await pay(id, 5000, key(), operator, { acceptExcess: true })) as { code?: string }).code).toBe("FORBIDDEN");
    unwrap(await pay(id, 5000, key(), owner, { acceptExcess: true }));
    const o = await order(id);
    expect(o.paid_minor).toBe(11000);
    expect(o.refund_status).toBe("pending");
    const [ob] = await sql<{ authorized_minor: number; origin: string }[]>`select authorized_minor, origin from app.refund_obligations where order_id = ${id}`;
    expect(ob).toEqual({ authorized_minor: 1000, origin: "overpayment" });
  });
});

describe("modalidades y entrega", () => {
  it("anticipado no permite preparar ni despachar con saldo", async () => {
    const id = await confirmed({ mode: "prepaid" });
    expect(((await step(orders.markPreparing, id)) as { code?: string }).code).toBe("PAYMENT_REVIEW_REQUIRED");
    unwrap(await pay(id, 10000));
    unwrap(await step(orders.markPreparing, id));
  });

  it("adelanto 30 permite despachar con 30 verificados; completar exige los 100", async () => {
    const id = await confirmed({ mode: "deposit_on_delivery", deposit: 3000 });
    unwrap(await pay(id, 3000));
    unwrap(await step(orders.markPreparing, id));
    unwrap(await step(orders.markReady, id));
    unwrap(await dispatch(id));
    unwrap(await step(orders.markDelivered, id));
    expect(((await step(orders.completeOrder, id)) as { code?: string }).code).toBe("INVALID_TRANSITION");
    unwrap(await pay(id, 7000, key(), operator, { method: "cash" }));
    unwrap(await step(orders.completeOrder, id));
    expect((await order(id)).status).toBe("completed");
  });

  it("contraentrega con transportista: despacha con 0, el cobro informado no cuenta hasta conciliarlo", async () => {
    const id = await confirmed({ mode: "cash_on_delivery", responsible: "carrier" });
    unwrap(await step(orders.markPreparing, id));
    unwrap(await step(orders.markReady, id));
    unwrap(await dispatch(id));
    unwrap(await step(orders.markDelivered, id));
    unwrap(await pay(id, 10000, key(), operator, { reportedByCarrier: true, method: "other" }));
    let o = await order(id);
    expect([o.paid_minor, o.reported_minor, o.collection_status]).toEqual([0, 10000, "unpaid"]);
    expect(((await step(orders.completeOrder, id)) as { code?: string }).code).toBe("INVALID_TRANSITION");

    const [payment] = await sql<{ id: string }[]>`select id from app.payment_records where order_id = ${id}`;
    unwrap(await orders.verifyReportedPayment(deps, operator, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), paymentId: payment.id }));
    unwrap(await step(orders.completeOrder, id));
    o = await order(id);
    expect([o.status, o.paid_minor, o.reported_minor]).toEqual(["completed", 10000, 0]);
  });

  it("el despacho consume la reserva una sola vez (reintento y segundo despacho)", async () => {
    const id = await confirmed({ mode: "cash_on_delivery" });
    unwrap(await step(orders.markPreparing, id));
    unwrap(await step(orders.markReady, id));
    const k = key();
    const results = await Promise.all([dispatch(id, k), dispatch(id, k)]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(((await dispatch(id)) as { code?: string }).code).toBe("INVALID_TRANSITION");
    expect(await balance(negroM)).toEqual({ onHand: 3, reserved: 0 });
  });

  it("recojo con saldo: se entrega solo registrando el cobro en el mismo acto", async () => {
    const id = await confirmed({ mode: "deposit_on_delivery", deposit: 3000, delivery: "pickup" });
    unwrap(await pay(id, 3000));
    unwrap(await step(orders.markPreparing, id));
    unwrap(await step(orders.markReady, id));
    const handOver = async (payment: { amountMinor: number } | null) =>
      orders.handOverPickup(deps, operator, {
        orderId: id,
        expectedVersion: (await order(id)).version,
        operationKey: key(),
        payment: payment ? { ...payment, method: "cash", reference: null, note: null, receivedAt: new Date(), operationKey: key() } : null,
      });
    expect(((await handOver(null)) as { code?: string }).code).toBe("PAYMENT_REVIEW_REQUIRED");
    unwrap(await handOver({ amountMinor: 7000 }));
    const o = await order(id);
    expect([o.fulfillment_status, o.paid_minor]).toEqual(["delivered", 10000]);
    expect(await balance(negroM)).toEqual({ onHand: 3, reserved: 0 });
  });
});

describe("cancelación, reembolsos y devoluciones", () => {
  it("cancelar con abono 30 libera una vez y crea obligación; devolver 10 deja 20", async () => {
    const id = await confirmed({ mode: "deposit_on_delivery", deposit: 3000 });
    unwrap(await pay(id, 3000));
    const cancel = async (actor: typeof owner | typeof operator, operationKey = key(), expectedVersion?: number) =>
      orders.cancelOrder(deps, actor, { orderId: id, expectedVersion: expectedVersion ?? (await order(id)).version, operationKey, reason: "Cliente desistió" });
    expect(((await cancel(operator)) as { code?: string }).code).toBe("FORBIDDEN");

    const version = (await order(id)).version;
    const results = await Promise.all([cancel(owner, key(), version), cancel(owner, key(), version)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await balance(negroM)).toEqual({ onHand: 5, reserved: 0 });
    let o = await order(id);
    expect([o.status, o.refund_status]).toEqual(["cancelled", "pending"]);

    const [ob] = await sql<{ id: string; authorized_minor: number }[]>`select id, authorized_minor from app.refund_obligations where order_id = ${id}`;
    expect(ob.authorized_minor).toBe(3000);
    const refund = async (amountMinor: number, actor: typeof owner | typeof operator = owner, expectedVersion?: number) =>
      orders.recordRefund(deps, actor, { orderId: id, expectedVersion: expectedVersion ?? (await order(id)).version, operationKey: key(), obligationId: ob.id, amountMinor, method: "yape", reference: null, note: null, refundedAt: new Date() });
    expect(((await refund(1000, operator)) as { code?: string }).code).toBe("FORBIDDEN");
    unwrap(await refund(1000));
    const v = (await order(id)).version;
    const doubles = await Promise.all([refund(2000, owner, v), refund(2000, owner, v)]);
    expect(doubles.filter((r) => r.ok)).toHaveLength(1);
    o = await order(id);
    expect([o.refunded_minor, o.refund_status]).toEqual([3000, "refunded"]);
    expect(((await refund(1)) as { code?: string }).code).toBe("OVERPAYMENT");
    expect(await balance(negroM)).toEqual({ onHand: 5, reserved: 0 }); // reembolsar no reingresa prendas
  });

  it("pago tardío sobre cancelado: se registra como devolución pendiente, sin reactivar", async () => {
    const { id } = await request();
    unwrap(await orders.cancelOrder(deps, operator, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), reason: "Sin respuesta" }));
    unwrap(await pay(id, 2000));
    const o = await order(id);
    expect([o.status, o.paid_minor, o.refund_status]).toEqual(["cancelled", 2000, "pending"]);
  });

  it("entrega fallida: solo las prendas recibidas y aptas vuelven al stock", async () => {
    const id = await confirmed({ mode: "cash_on_delivery" });
    unwrap(await step(orders.markPreparing, id));
    unwrap(await step(orders.markReady, id));
    unwrap(await dispatch(id));
    expect(await balance(negroM)).toEqual({ onHand: 3, reserved: 0 });
    const receive = async (received: number, restock: number) =>
      orders.recordReturnReceipt(deps, owner, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), reason: "Entrega fallida", items: [{ variantId: negroM, received, restock }], refundMinor: 0 });
    unwrap(await receive(1, 1));
    expect(await balance(negroM)).toEqual({ onHand: 4, reserved: 0 });
    expect(((await orders.cancelOrder(deps, owner, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), reason: "Devuelto" })) as { code?: string }).code).toBe("INVALID_TRANSITION");
    unwrap(await receive(1, 0)); // dañada: no reingresa
    expect(((await receive(1, 0)) as { code?: string }).code).toBe("VALIDATION_ERROR"); // más de lo entregado
    expect(await balance(negroM)).toEqual({ onHand: 4, reserved: 0 });
    unwrap(await orders.cancelOrder(deps, owner, { orderId: id, expectedVersion: (await order(id)).version, operationKey: key(), reason: "Devuelto completo" }));
    expect((await order(id)).status).toBe("cancelled");
  });
});
