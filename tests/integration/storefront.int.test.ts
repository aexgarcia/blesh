/**
 * Tienda pública sobre PostgreSQL real (base blesh_test, rol runtime): cotización, solicitud
 * web idempotente, cambios de precio/publicación/stock, carrito manipulado y límite de tasa.
 * La solicitud web aparece como pedido `requested` y sigue el flujo administrativo normal.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { consumeRateLimit } from "@/infrastructure/rate-limit/rate-limiter";
import * as orders from "@/modules/sales/application/order-commands";
import { quoteCart, submitWebRequest, type WebRequestInput } from "@/modules/sales/application/web-requests";
import { REQUEST_TERMS } from "@/modules/sales/contracts";
import { computePromotions } from "@/modules/sales/domain/promotions";
import { buildSalesDeps } from "@/modules/sales/server";

import { openTestDb, resetTables } from "../support/test-db";

const { sql, db } = openTestDb();
const deps = buildSalesDeps(db);
const owner = { membershipId: randomUUID(), role: "owner" as const };
const allow = { consumeRateLimit: async () => true };

let productId: string;
let negroM: string;
let negroS: string;
let blancoS: string;

beforeEach(async () => {
  await resetTables([
    "rate_limit_counters",
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
  const [category] = await sql<{ id: string }[]>`select id from app.categories where slug = 'boxy-essential'`;
  [{ id: productId }] = await sql<{ id: string }[]>`
    insert into app.products (slug, title, category_id, status, published_at, first_published_at, created_by, updated_by)
    values ('boxy-essential', 'Boxy Essential', ${category.id}, 'published', now(), now(), ${owner.membershipId}, ${owner.membershipId}) returning id`;
  const [negro] = await sql<{ id: string }[]>`insert into app.product_colors (product_id, color_code, label, slug, is_primary) values (${productId}, 'negro', 'Negro', 'negro', true) returning id`;
  const [blanco] = await sql<{ id: string }[]>`insert into app.product_colors (product_id, color_code, label, slug) values (${productId}, 'blanco', 'Blanco', 'blanco') returning id`;
  [{ id: negroM }] = await sql<{ id: string }[]>`insert into app.product_variants (product_id, color_id, sku, size_code, price_minor) values (${productId}, ${negro.id}, 'BOXY-NEGRO-M', 'M', 4000) returning id`;
  [{ id: negroS }] = await sql<{ id: string }[]>`insert into app.product_variants (product_id, color_id, sku, size_code, price_minor) values (${productId}, ${negro.id}, 'BOXY-NEGRO-S', 'S', 4000) returning id`;
  [{ id: blancoS }] = await sql<{ id: string }[]>`insert into app.product_variants (product_id, color_id, sku, size_code, price_minor) values (${productId}, ${blanco.id}, 'BOXY-BLANCO-S', 'S', 4500) returning id`;
  // Negro S agotado (0), Blanco S con una unidad.
  await sql`insert into app.inventory_balances (variant_id, on_hand) values (${negroM}, 5), (${negroS}, 0), (${blancoS}, 1)`;
});

afterAll(async () => {
  await sql.end();
});

/** Total aceptado = lo que la tienda mostró: precios aceptados − pack (todo el fixture es Boxy Essential). */
const acceptedTotal = (lines: WebRequestInput["lines"]) => {
  const sub = lines.reduce((s, l) => s + l.acceptedPriceMinor * l.quantity, 0);
  return sub - computePromotions(lines.map((l) => ({ categorySlug: "boxy-essential", unitPriceMinor: l.acceptedPriceMinor, quantity: l.quantity }))).discountMinor;
};

const input = (over: Partial<WebRequestInput> = {}): WebRequestInput => {
  const lines = over.lines ?? [{ variantId: negroM, quantity: 2, acceptedPriceMinor: 4000 }];
  return {
  lines,
  acceptedTotalMinor: Number.isSafeInteger(lines[0]?.quantity) ? acceptedTotal(lines) : 0,
  customerName: "Ana Pérez",
  customerPhone: "987 654 321",
  deliveryPreference: "pickup",
  termsVersion: REQUEST_TERMS.version,
  acceptedTerms: true,
  creationKey: randomUUID(),
  ...over,
  };
};

const ordersCount = async () => (await sql<{ n: number }[]>`select count(*)::int as n from app.orders`)[0].n;

describe("cotización pública (QuoteCart)", () => {
  it("cotiza con precios del servidor y disponibilidad orientativa, sin exponer stock exacto", async () => {
    const result = await quoteCart(deps, [
      { variantId: negroM, quantity: 2, seenPriceMinor: 4000 },
      { variantId: blancoS, quantity: 3 },
      { variantId: negroS, quantity: 1 },
    ]);
    if (!result.ok) throw new Error(result.message);
    expect(result.quote.lines.map((l) => [l.status, l.maxQuantity])).toEqual([
      ["ok", null],
      ["insufficient", 1],
      ["sold_out", 0],
    ]);
    expect(result.quote.subtotalMinor).toBe(2 * 4000 + 3 * 4500);
    expect(result.quote.ready).toBe(false);
  });

  it("ids desconocidos son líneas no disponibles, no errores", async () => {
    const result = await quoteCart(deps, [{ variantId: randomUUID(), quantity: 1 }]);
    expect(result.ok && result.quote.lines[0]).toMatchObject({ status: "unavailable", variant: null });
  });
});

describe("solicitud web", () => {
  it("guarda una solicitud requested (revisión 1 = cotización aceptada), sin reservar, con versión de condiciones", async () => {
    const result = await submitWebRequest(deps, input(), allow);
    if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
    expect(result.replayed).toBe(false);
    expect(result.request.reference).toMatch(/^BL-[0-9A-Z]{6}$/);
    expect(result.request.message).toContain(`Referencia: ${result.request.reference}`);
    expect(result.request.message).toContain("SKU BOXY-NEGRO-M · 2 × S/ 40.00 = S/ 80.00");
    expect(result.request.message).not.toContain("987");

    const [order] = await sql`select * from app.orders where reference = ${result.request.reference}`;
    // 2 Boxy Essential: pack 2 × S/75 aplicado por el servidor (S/ 80 − S/ 5).
    expect(order).toMatchObject({ source: "web", status: "requested", customer_phone: "+51987654321", delivery_preference: "pickup", total_minor: 7500, customer_id: null });
    expect(result.request.message).toContain("Descuento Pack Boxy Essential: −S/ 5.00");
    expect(result.request.message).toContain("Total provisional: S/ 75.00 + envío");
    const [revision] = await sql`select subtotal_minor, promotion_discount_minor, promotion_code from app.order_revisions where order_id = ${order.id}`;
    expect(revision).toEqual({ subtotal_minor: 8000, promotion_discount_minor: 500, promotion_code: "pack-boxy-essential@1" });
    const [event] = await sql`select data from app.order_events where order_id = ${order.id} and event = 'order.requested'`;
    expect(event.data).toEqual({ source: "web", termsVersion: REQUEST_TERMS.version });
    const [balance] = await sql`select reserved from app.inventory_balances where variant_id = ${negroM}`;
    expect(balance.reserved).toBe(0);
  });

  it("es idempotente: el reintento con la misma clave devuelve la misma referencia sin consumir cupo", async () => {
    const same = input();
    let limiterCalls = 0;
    const counting = { consumeRateLimit: async () => (limiterCalls++, true) };
    const first = await submitWebRequest(deps, same, counting);
    const retry = await submitWebRequest(deps, same, counting);
    expect(first.ok && retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(retry.request).toEqual(first.request);
    expect(retry.replayed).toBe(true);
    expect(limiterCalls).toBe(1);
    expect(await ordersCount()).toBe(1);
  });

  it("envíos simultáneos con la misma clave (doble clic) crean una sola solicitud", async () => {
    const same = input();
    const results = await Promise.all(Array.from({ length: 6 }, () => submitWebRequest(deps, same, allow)));
    const refs = new Set(results.map((r) => (r.ok ? r.request.reference : `${r.code}`)));
    expect(refs.size).toBe(1);
    expect([...refs][0]).toMatch(/^BL-/);
    expect(await ordersCount()).toBe(1);
  });

  it("clave reutilizada con otros datos → IDEMPOTENCY_CONFLICT", async () => {
    const key = randomUUID();
    expect((await submitWebRequest(deps, input({ creationKey: key }), allow)).ok).toBe(true);
    const other = await submitWebRequest(deps, input({ creationKey: key, customerName: "Otra persona" }), allow);
    expect(other).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" });
    const otherLines = await submitWebRequest(deps, input({ creationKey: key, lines: [{ variantId: negroM, quantity: 3, acceptedPriceMinor: 4000 }] }), allow);
    expect(otherLines).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" });
    expect(await ordersCount()).toBe(1);
  });

  it("producto despublicado → QUOTE_CHANGED con la línea no disponible; no registra", async () => {
    await sql`update app.products set status = 'draft' where id = ${productId}`;
    const result = await submitWebRequest(deps, input(), allow);
    expect(result).toMatchObject({ ok: false, code: "QUOTE_CHANGED" });
    expect(!result.ok && result.quote?.lines[0].status).toBe("unavailable");
    expect(await ordersCount()).toBe(0);
  });

  it("talla agotada o sin unidades suficientes → QUOTE_CHANGED; no registra", async () => {
    const soldOut = await submitWebRequest(deps, input({ lines: [{ variantId: negroS, quantity: 1, acceptedPriceMinor: 4000 }] }), allow);
    expect(!soldOut.ok && soldOut.quote?.lines[0].status).toBe("sold_out");
    const tooMany = await submitWebRequest(deps, input({ lines: [{ variantId: blancoS, quantity: 2, acceptedPriceMinor: 4500 }] }), allow);
    expect(!tooMany.ok && tooMany.quote?.lines[0]).toMatchObject({ status: "insufficient", maxQuantity: 1 });
    expect(await ordersCount()).toBe(0);
  });

  it("precio cambiado → QUOTE_CHANGED; con el nuevo precio aceptado se registra a ese precio", async () => {
    await sql`update app.product_variants set price_minor = 4200 where id = ${negroM}`;
    const key = randomUUID();
    const stale = await submitWebRequest(deps, input({ creationKey: key }), allow);
    expect(stale).toMatchObject({ ok: false, code: "QUOTE_CHANGED" });
    expect(!stale.ok && stale.quote?.lines[0]).toMatchObject({ previousPriceMinor: 4000 });
    // Nada se registró con esa clave: la misma intención puede reenviarse tras aceptar.
    const accepted = await submitWebRequest(deps, input({ creationKey: key, lines: [{ variantId: negroM, quantity: 2, acceptedPriceMinor: 4200 }] }), allow);
    if (!accepted.ok) throw new Error(accepted.message);
    expect(accepted.request.subtotalMinor).toBe(8400);
  });

  it("un reintento tras cambiar el precio o despublicar recupera la solicitud ya registrada", async () => {
    const same = input();
    const first = await submitWebRequest(deps, same, allow);
    await sql`update app.product_variants set price_minor = 9900 where id = ${negroM}`;
    await sql`update app.products set status = 'draft' where id = ${productId}`;
    const retry = await submitWebRequest(deps, same, allow);
    expect(retry.ok && first.ok && retry.request).toEqual(first.ok && first.request);
    expect(retry.ok && retry.request.message).toContain("S/ 40.00");
  });

  it("carrito manipulado: ids falsos, cantidades no enteras y exceso de líneas o unidades", async () => {
    const fake = await submitWebRequest(deps, input({ lines: [{ variantId: randomUUID(), quantity: 1, acceptedPriceMinor: 1 }] }), allow);
    expect(fake).toMatchObject({ ok: false, code: "QUOTE_CHANGED" });
    const fraction = await submitWebRequest(deps, input({ lines: [{ variantId: negroM, quantity: 1.5, acceptedPriceMinor: 4000 }] }), allow);
    expect(fraction).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    const units = await submitWebRequest(
      deps,
      input({ lines: [{ variantId: negroM, quantity: 6, acceptedPriceMinor: 4000 }, { variantId: negroM, quantity: 6, acceptedPriceMinor: 4000 }] }),
      allow,
    );
    expect(units).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    const tooManyLines = await submitWebRequest(deps, input({ lines: Array.from({ length: 51 }, () => ({ variantId: randomUUID(), quantity: 1, acceptedPriceMinor: 4000 })) }), allow);
    expect(tooManyLines).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    // Un precio aceptado inventado (más bajo) no se usa: el servidor exige el vigente.
    const cheap = await submitWebRequest(deps, input({ lines: [{ variantId: negroM, quantity: 1, acceptedPriceMinor: 100 }] }), allow);
    expect(cheap).toMatchObject({ ok: false, code: "QUOTE_CHANGED" });
    expect(await ordersCount()).toBe(0);
  });

  it("valida contacto y condiciones antes de registrar", async () => {
    expect(await submitWebRequest(deps, input({ customerPhone: "123" }), allow)).toMatchObject({ ok: false, field: "customerPhone" });
    expect(await submitWebRequest(deps, input({ customerName: " " }), allow)).toMatchObject({ ok: false, field: "customerName" });
    expect(await submitWebRequest(deps, input({ acceptedTerms: false }), allow)).toMatchObject({ ok: false, field: "acceptedTerms" });
    expect(await submitWebRequest(deps, input({ termsVersion: "vieja" }), allow)).toMatchObject({ ok: false, code: "TERMS_OUTDATED" });
    expect(await ordersCount()).toBe(0);
  });

  it("límite de tasa alcanzado → RATE_LIMITED sin registrar", async () => {
    expect(await submitWebRequest(deps, input(), { consumeRateLimit: async () => false })).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(await ordersCount()).toBe(0);
  });

  it("la solicitud web sigue el flujo administrativo: acuerdo, confirmación con ficha y reserva", async () => {
    const created = await submitWebRequest(deps, input(), allow);
    if (!created.ok) throw new Error(created.message);
    const [order] = await sql<{ id: string; version: number }[]>`select id, version from app.orders where reference = ${created.request.reference}`;
    const unwrap = <T,>(r: { ok: true; value: T } | { ok: false; message: string }) => {
      if (!r.ok) throw new Error(r.message);
      return r.value;
    };
    const version = async () => (await sql<{ version: number }[]>`select version from app.orders where id = ${order.id}`)[0].version;
    unwrap(
      await orders.reviseAgreement(deps, owner, {
        orderId: order.id,
        expectedVersion: order.version,
        operationKey: randomUUID(),
        lines: [{ variantId: negroM, quantity: 2 }],
        discountMinor: 0,
        shippingMinor: 0,
        deliveryMode: "pickup",
        deliveryAddress: null,
        deliveryNote: null,
        paymentMode: "prepaid",
        requiredDepositMinor: 0,
        collectionResponsible: "company",
        note: null,
      }),
    );
    unwrap(await orders.recordCustomerAgreement(deps, owner, { orderId: order.id, expectedVersion: await version(), operationKey: randomUUID(), revision: 2, note: "Aceptó por WhatsApp" }));
    unwrap(
      await orders.confirmOrder(deps, owner, {
        orderId: order.id,
        expectedVersion: await version(),
        operationKey: randomUUID(),
        customer: { kind: "new", name: "Ana Pérez", phone: "987654321", email: null, confirmSharedPhone: true },
        followUpAt: null,
      }),
    );
    const [after] = await sql`select status, customer_id from app.orders where id = ${order.id}`;
    expect(after.status).toBe("confirmed");
    expect(after.customer_id).not.toBeNull();
    const [balance] = await sql`select reserved from app.inventory_balances where variant_id = ${negroM}`;
    expect(balance.reserved).toBe(2);
  });
});

describe("recorrido completo de solicitud web a entrega", () => {
  it.each(["deposit_on_delivery", "cash_on_delivery"] as const)("confirma, vincula cliente, cobra y entrega con %s", async (mode) => {
    const webInput = input();
    const result = await submitWebRequest(deps, webInput, allow);
    if (!result.ok) throw new Error(result.code);
    const repeated = await submitWebRequest(deps, webInput, allow);
    expect(repeated.ok && repeated.request.reference).toBe(result.request.reference);
    const [order] = await sql<{ id: string }[]>`select id from app.orders where reference=${result.request.reference}`;
    const ref = async () => ({ orderId: order.id, expectedVersion: (await sql<{ version: number }[]>`select version from app.orders where id=${order.id}`)[0].version, operationKey: randomUUID() });
    const ok = (r: { ok: boolean; code?: string }) => { if (!r.ok) throw new Error(r.code); };
    ok(await orders.reviseAgreement(deps, owner, { ...await ref(), lines: [{ variantId: negroM, quantity: 2 }], discountMinor: 0, shippingMinor: 0, deliveryMode: "shipping", deliveryAddress: "Dirección ficticia de pruebas", deliveryNote: null, paymentMode: mode, requiredDepositMinor: mode === "deposit_on_delivery" ? 3000 : 0, collectionResponsible: "company", note: null }));
    ok(await orders.recordCustomerAgreement(deps, owner, { ...await ref(), revision: 2, note: null }));
    ok(await orders.confirmOrder(deps, owner, { ...await ref(), customer: { kind: "new", name: "Cliente de prueba", phone: "987654321", email: null, confirmSharedPhone: false }, followUpAt: null }));
    const pay = async (amount: number) => orders.recordPayment(deps, owner, { ...await ref(), amountMinor: amount, method: "cash", reference: null, note: null, receivedAt: new Date(), reportedByCarrier: false, acceptExcess: false });
    if (mode === "deposit_on_delivery") ok(await pay(3000));
    ok(await orders.markPreparing(deps, owner, await ref()));
    ok(await orders.markReady(deps, owner, await ref()));
    ok(await orders.dispatchOrder(deps, owner, { ...await ref(), carrier: null, trackingCode: null }));
    ok(await orders.markDelivered(deps, owner, await ref()));
    expect((await orders.completeOrder(deps, owner, await ref())).ok).toBe(false); // Entrega no equivale a cobro.
    ok(await pay(mode === "deposit_on_delivery" ? 4500 : 7500));
    ok(await orders.completeOrder(deps, owner, await ref()));
    const [final] = await sql`select status,collection_status,paid_minor,customer_id from app.orders where id=${order.id}`;
    expect(final).toMatchObject({ status: "completed", collection_status: "paid", paid_minor: 7500 });
    expect(final.customer_id).not.toBeNull();
    expect((await sql`select on_hand,reserved from app.inventory_balances where variant_id=${negroM}`)[0]).toEqual({ on_hand: 3, reserved: 0 });
  });
});

describe("pack por cantidad (servidor)", () => {
  it("3 prendas de colores distintos pagan S/ 99 y el descuento queda en la revisión", async () => {
    const lines = [
      { variantId: negroM, quantity: 2, acceptedPriceMinor: 4000 },
      { variantId: blancoS, quantity: 1, acceptedPriceMinor: 4500 },
    ];
    const quoted = await quoteCart(deps, lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, seenPriceMinor: l.acceptedPriceMinor })));
    expect(quoted.ok && quoted.quote).toMatchObject({ subtotalMinor: 12500, totalMinor: 9900, promotion: { discountMinor: 2600 } });
    const result = await submitWebRequest(deps, input({ lines }), allow);
    if (!result.ok) throw new Error(result.message);
    expect(result.request).toMatchObject({ subtotalMinor: 12500, totalMinor: 9900 });
    const [order] = await sql`select total_minor from app.orders where reference = ${result.request.reference}`;
    expect(order.total_minor).toBe(9900);
  });

  it("un total aceptado distinto del que calcula el servidor exige nueva aceptación", async () => {
    const result = await submitWebRequest(deps, input({ acceptedTotalMinor: 8000 }), allow);
    expect(result).toMatchObject({ ok: false, code: "QUOTE_CHANGED" });
    expect(!result.ok && result.quote?.totalMinor).toBe(7500);
    expect(await ordersCount()).toBe(0);
  });

  it("el pedido manual y las revisiones aplican la misma política, separada del descuento excepcional", async () => {
    const created = await orders.createOrderRequest(deps, owner, {
      source: "whatsapp",
      lines: [{ variantId: negroM, quantity: 3 }],
      customerName: "Ana Pérez",
      customerPhone: "987654321",
      deliveryPreference: "undecided",
      creationKey: randomUUID(),
    });
    if (!created.ok) throw new Error(created.message);
    const [order] = await sql<{ id: string; version: number; total_minor: number }[]>`select id, version, total_minor from app.orders where id = ${created.value.id}`;
    expect(order.total_minor).toBe(9900);
    const revised = await orders.reviseAgreement(deps, owner, {
      orderId: order.id,
      expectedVersion: order.version,
      operationKey: randomUUID(),
      lines: [{ variantId: negroM, quantity: 4 }],
      discountMinor: 900,
      shippingMinor: 1000,
      deliveryMode: "shipping",
      deliveryAddress: "Av. Ejemplo 123, Lima",
      deliveryNote: null,
      paymentMode: "prepaid",
      requiredDepositMinor: 0,
      collectionResponsible: "company",
      note: null,
    });
    expect(revised.ok).toBe(true);
    const [rev] = await sql`select subtotal_minor, promotion_discount_minor, discount_minor, shipping_minor, total_minor from app.order_revisions where order_id = ${order.id} and number = 2`;
    // 4 × S/40 = S/160; pack 3 × S/99 + 1 × S/40 = S/139 → promoción S/21; excepcional S/9; envío S/10.
    expect(rev).toEqual({ subtotal_minor: 16000, promotion_discount_minor: 2100, discount_minor: 900, shipping_minor: 1000, total_minor: 14000 });
  });
});

describe("límite de tasa compartido", () => {
  it("cuenta por ventana y cliente, sin guardar la IP en claro", async () => {
    const rules = [{ scope: "test.scope", limit: 2, windowSeconds: 600 }];
    const now = new Date("2026-11-23T15:00:00Z");
    expect(await consumeRateLimit(db, "203.0.113.7", rules, now)).toBe(true);
    expect(await consumeRateLimit(db, "203.0.113.7", rules, now)).toBe(true);
    expect(await consumeRateLimit(db, "203.0.113.7", rules, now)).toBe(false);
    expect(await consumeRateLimit(db, "198.51.100.1", rules, now)).toBe(true);
    // Ventana siguiente: cupo nuevo.
    expect(await consumeRateLimit(db, "203.0.113.7", rules, new Date(now.getTime() + 600_000))).toBe(true);
    const rows = await sql<{ bucket: string }[]>`select bucket from app.rate_limit_counters`;
    expect(rows.every((r) => !r.bucket.includes("203.0.113.7"))).toBe(true);
  });

  it("es consistente con intentos simultáneos", async () => {
    const rules = [{ scope: "test.concurrent", limit: 5, windowSeconds: 600 }];
    const now = new Date();
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit(db, "client", rules, now)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
