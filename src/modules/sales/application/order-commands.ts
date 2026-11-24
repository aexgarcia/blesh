import type { CollectionResponsible, DeliveryMode, OrderLine, OrderSource, PaymentMethod, PaymentMode } from "../contracts";
import {
  cancellableBeforeDispatch,
  collectionStatus,
  completionProblems,
  computeTotals,
  confirmationProblem,
  FULFILLMENT_TRANSITIONS,
  fulfillmentPaymentProblem,
  normalizeRequestedLines,
  referenceFromBytes,
  refundStatus,
  termsNeedOwner,
  termsProblem,
  type RequestedLine,
} from "../domain/order-rules";
import {
  SalesFailure,
  salesResult,
  type NewCustomerInput,
  type ObligationRow,
  type OrderPatch,
  type OrderRow,
  type SalesActor,
  type SalesCapability,
  type SalesDeps,
  type SalesResult,
  type TxContext,
} from "./ports";

function authorize(deps: SalesDeps, actor: SalesActor, capability: SalesCapability, message = "No tienes permiso para esta acción.") {
  if (!deps.authorize(actor, capability)) throw new SalesFailure("FORBIDDEN", message);
}

const trimOrNull = (value: string | null | undefined, max: number) => {
  const v = (value ?? "").trim();
  return v ? v.slice(0, max) : null;
};

/** Cotiza en servidor: precios vigentes y solo variantes vendibles. */
async function quoteLines(deps: SalesDeps, requested: readonly RequestedLine[]): Promise<OrderLine[]> {
  const normalized = normalizeRequestedLines(requested);
  if (!Array.isArray(normalized)) throw new SalesFailure("VALIDATION_ERROR", normalized.message, normalized.field);
  const quoted = new Map((await deps.quote(normalized.map((l) => l.variantId))).map((q) => [q.variantId, q]));
  const unavailable = normalized.filter((l) => !quoted.get(l.variantId)?.sellable);
  if (unavailable.length > 0) {
    const names = unavailable.map((l) => quoted.get(l.variantId)?.sku ?? "producto desconocido").join(", ");
    throw new SalesFailure("PRODUCT_UNAVAILABLE", `No disponible para la venta: ${names}.`, "lines");
  }
  return normalized.map((l) => {
    const q = quoted.get(l.variantId)!;
    return {
      variantId: q.variantId,
      sku: q.sku,
      productTitle: q.productTitle,
      colorLabel: q.colorLabel,
      sizeCode: q.sizeCode,
      unitPriceMinor: q.priceMinor,
      quantity: l.quantity,
      lineTotalMinor: q.priceMinor * l.quantity,
    };
  });
}

function outstandingRefunds(obligations: readonly ObligationRow[]): number {
  return obligations.reduce((s, o) => s + (o.authorizedMinor - o.refundedMinor), 0);
}

type Step = { patch?: OrderPatch; event: string; reason?: string | null; data?: Record<string, unknown> | null; revision?: number | null };

/**
 * Esqueleto de cada comando sobre un pedido: autoriza, bloquea el pedido, reconoce reenvíos
 * por clave de operación, exige versión esperada y registra el evento en la misma transacción.
 */
function orderCommand(
  deps: SalesDeps,
  actor: SalesActor,
  ref: { orderId: string; expectedVersion: number; operationKey: string },
  capability: SalesCapability,
  run: (ctx: TxContext, order: OrderRow) => Promise<Step>,
): Promise<SalesResult<{ orderId: string }>> {
  return salesResult(() =>
    deps.store.transaction(async (ctx) => {
      authorize(deps, actor, capability);
      const order = await ctx.sales.lockOrder(ref.orderId);
      if (!order) throw new SalesFailure("NOT_FOUND", "El pedido no existe.");
      if (await ctx.sales.hasEventKey(ref.operationKey)) return { orderId: order.id }; // reenvío: ya aplicado
      if (order.version !== ref.expectedVersion) throw new SalesFailure("VERSION_CONFLICT", "El pedido cambió mientras tanto. Recarga la página.");
      const step = await run(ctx, order);
      await ctx.sales.updateOrder(order.id, step.patch ?? {});
      await ctx.sales.insertEvent({
        orderId: order.id,
        event: step.event,
        actorId: actor.membershipId,
        revision: step.revision ?? null,
        reason: step.reason ?? null,
        data: step.data ?? null,
        operationKey: ref.operationKey,
      });
      return { orderId: order.id };
    }),
  );
}

function invalidTransition(message: string): never {
  throw new SalesFailure("INVALID_TRANSITION", message);
}

// ---------------------------------------------------------------------------
// Solicitud (pedido manual ahora; solicitud web en la fase 6)

export type CreateOrderInput = {
  source: OrderSource;
  lines: RequestedLine[];
  customerName: string;
  customerPhone: string;
  deliveryPreference: DeliveryMode;
  /** UUID por intención: un reintento devuelve el mismo pedido. */
  creationKey: string;
  note?: string | null;
};

/**
 * Registra una solicitud `requested` con revisión 1 cotizada en servidor. No reserva stock
 * ni registra cobros. `actor` null solo para solicitudes web (fase 6).
 */
export function createOrderRequest(deps: SalesDeps, actor: SalesActor | null, input: CreateOrderInput): Promise<SalesResult<{ id: string; reference: string }>> {
  return salesResult(async () => {
    if (input.source === "web" ? actor !== null : actor === null) throw new SalesFailure("FORBIDDEN", "Origen no permitido.");
    if (actor) authorize(deps, actor, "orders.manual_create", "No tienes permiso para crear pedidos.");
    const contact = deps.normalizeContact({ name: input.customerName, phone: input.customerPhone });
    if (!contact.ok) throw new SalesFailure("VALIDATION_ERROR", contact.message, contact.field === "name" ? "customerName" : "customerPhone");
    const lines = await quoteLines(deps, input.lines);
    const totals = computeTotals(lines, 0, 0);
    if (!totals.ok) throw new SalesFailure("VALIDATION_ERROR", totals.problem.message, totals.problem.field);
    const fingerprint = JSON.stringify({
      source: input.source,
      lines: lines.map((l) => [l.variantId, l.quantity]).sort(),
      name: contact.name,
      phone: contact.phone,
      deliveryPreference: input.deliveryPreference,
    });

    return deps.store.transaction(async ({ sales }) => {
      await sales.lockCreationKey(input.creationKey);
      const previous = await sales.findOrderByCreationKey(input.creationKey);
      if (previous) {
        if (previous.creationFingerprint !== fingerprint) throw new SalesFailure("IDEMPOTENCY_CONFLICT", "Este formulario ya registró un pedido con otros datos. Recarga la página.");
        return { id: previous.id, reference: previous.reference };
      }
      let order: OrderRow | null = null;
      for (let attempt = 0; attempt < 8 && !order; attempt++) {
        order = await sales.insertOrder({
          reference: referenceFromBytes(deps.randomBytes()),
          source: input.source,
          customerName: contact.name,
          customerPhone: contact.phone,
          deliveryPreference: input.deliveryPreference,
          totalMinor: totals.totalMinor,
          creationKey: input.creationKey,
          creationFingerprint: fingerprint,
          createdBy: actor?.membershipId ?? null,
        });
      }
      if (!order) throw new Error("No se pudo generar una referencia única.");
      await sales.insertRevision(
        order.id,
        {
          number: 1,
          lines,
          subtotalMinor: totals.subtotalMinor,
          discountMinor: 0,
          shippingMinor: 0,
          totalMinor: totals.totalMinor,
          deliveryMode: input.deliveryPreference,
          deliveryAddress: null,
          deliveryNote: null,
          paymentMode: null,
          requiredDepositMinor: 0,
          collectionResponsible: "company",
          note: trimOrNull(input.note, 500),
        },
        actor?.membershipId ?? null,
      );
      await sales.insertEvent({ orderId: order.id, event: "order.requested", actorId: actor?.membershipId ?? null, revision: 1, data: { source: input.source } });
      return { id: order.id, reference: order.reference };
    });
  });
}

// ---------------------------------------------------------------------------
// Acuerdo

type Ref = { orderId: string; expectedVersion: number; operationKey: string };

export type RevisionTermsInput = {
  lines: RequestedLine[];
  discountMinor: number;
  shippingMinor: number;
  deliveryMode: DeliveryMode;
  deliveryAddress: string | null;
  deliveryNote: string | null;
  paymentMode: PaymentMode | null;
  requiredDepositMinor: number;
  collectionResponsible: CollectionResponsible;
  note: string | null;
};

/** Nueva revisión comercial (líneas, entrega, cobro). Invalida la aceptación anterior. */
export function reviseAgreement(deps: SalesDeps, actor: SalesActor, input: Ref & RevisionTermsInput) {
  return orderCommand(deps, actor, input, "orders.operate", async ({ sales }, order) => {
    if (order.status !== "requested") invalidTransition("Solo se revisa el acuerdo antes de confirmar. Para cambiar un pedido confirmado, cancélalo y crea otro.");
    const previous = await sales.getRevision(order.id, order.currentRevision);

    if (input.discountMinor > 0 && input.discountMinor !== previous.discountMinor) {
      authorize(deps, actor, "orders.exceptional_discount", "Solo el propietario autoriza descuentos excepcionales.");
    }
    const termsChanged =
      input.paymentMode !== previous.paymentMode || input.requiredDepositMinor !== previous.requiredDepositMinor || input.collectionResponsible !== previous.collectionResponsible;
    if (termsNeedOwner(input.paymentMode) && termsChanged) {
      authorize(deps, actor, "payment_terms.authorize", "Solo el propietario autoriza adelanto + saldo o contraentrega.");
    }

    const lines = await quoteLines(deps, input.lines);
    const totals = computeTotals(lines, input.discountMinor, input.shippingMinor);
    if (!totals.ok) throw new SalesFailure("VALIDATION_ERROR", totals.problem.message, totals.problem.field);
    const deliveryAddress = input.deliveryMode === "shipping" ? trimOrNull(input.deliveryAddress, 300) : null;
    const problem = termsProblem({ ...input, deliveryAddress }, totals.totalMinor);
    if (problem) throw new SalesFailure("VALIDATION_ERROR", problem.message, problem.field);

    const number = order.currentRevision + 1;
    await sales.insertRevision(
      order.id,
      {
        number,
        lines,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: input.discountMinor,
        shippingMinor: input.shippingMinor,
        totalMinor: totals.totalMinor,
        deliveryMode: input.deliveryMode,
        deliveryAddress,
        deliveryNote: trimOrNull(input.deliveryNote, 300),
        paymentMode: input.paymentMode,
        requiredDepositMinor: input.requiredDepositMinor,
        collectionResponsible: input.collectionResponsible,
        note: trimOrNull(input.note, 500),
      },
      actor.membershipId,
    );
    return {
      patch: { currentRevision: number, totalMinor: totals.totalMinor, collectionStatus: collectionStatus(totals.totalMinor, order.paidMinor) },
      event: "order.revised",
      revision: number,
    };
  });
}

/** El cliente aceptó la revisión vigente por WhatsApp/en persona (registro del actor, sin capturas). */
export function recordCustomerAgreement(deps: SalesDeps, actor: SalesActor, input: Ref & { revision: number; note: string | null }) {
  return orderCommand(deps, actor, input, "orders.operate", async (_ctx, order) => {
    if (order.status !== "requested") invalidTransition("El acuerdo se registra antes de confirmar.");
    if (input.revision !== order.currentRevision) throw new SalesFailure("VERSION_CONFLICT", "Hay una revisión más reciente. Revísala antes de registrar el acuerdo.");
    const note = trimOrNull(input.note, 300);
    return {
      patch: { acceptedRevision: order.currentRevision, acceptedAt: deps.clock.now(), acceptedBy: actor.membershipId, acceptedNote: note },
      event: "order.agreement_recorded",
      revision: order.currentRevision,
      reason: note,
    };
  });
}

// ---------------------------------------------------------------------------
// Confirmación: cliente + reserva atómica

export type CustomerChoice = { kind: "existing"; customerId: string } | ({ kind: "new" } & NewCustomerInput);

export function confirmOrder(deps: SalesDeps, actor: SalesActor, input: Ref & { customer: CustomerChoice; followUpAt: Date | null }) {
  return orderCommand(deps, actor, input, "orders.operate", async ({ sales, inventory, customers }, order) => {
    if (order.status !== "requested") invalidTransition("El pedido ya no es una solicitud.");
    if (order.acceptedRevision !== order.currentRevision) {
      throw new SalesFailure("AGREEMENT_REQUIRED", "Registra que el cliente aceptó la revisión vigente antes de confirmar.");
    }
    const revision = await sales.getRevision(order.id, order.currentRevision);
    const problem = confirmationProblem(revision);
    if (problem) throw new SalesFailure("AGREEMENT_REQUIRED", problem.message);

    // Vínculo explícito: ficha elegida por el operador o creada aquí (misma transacción e idempotencia).
    const link =
      input.customer.kind === "existing"
        ? await customers.requireLinkable(actor, input.customer.customerId)
        : await customers.create(actor, { ...input.customer, creationKey: input.operationKey });
    if (!link.ok) throw new SalesFailure("CUSTOMER_REQUIRED", link.message, "field" in link ? (link.field as string | undefined) : undefined);

    const reserved = await inventory.reserve({ orderId: order.id, lines: revision.lines, actorId: actor.membershipId });
    if (!reserved.ok) {
      const bySku = new Map(revision.lines.map((l) => [l.variantId, `${l.sku}`]));
      const detail = reserved.shortages.map((s) => `${bySku.get(s.variantId)}: pedidas ${s.requested}, disponibles ${s.available}`).join("; ");
      throw new SalesFailure("INSUFFICIENT_STOCK", `Sin stock suficiente (no se reservó nada). ${detail}. Renegocia las líneas.`);
    }
    return {
      patch: { status: "confirmed", fulfillmentStatus: "arranged", customerId: link.id, confirmedAt: deps.clock.now(), followUpAt: input.followUpAt },
      event: "order.confirmed",
      revision: order.currentRevision,
      data: { customerId: link.id },
    };
  });
}

export function setFollowUp(deps: SalesDeps, actor: SalesActor, input: Ref & { followUpAt: Date | null }) {
  return orderCommand(deps, actor, input, "orders.operate", async (_ctx, order) => {
    if (order.status !== "requested" && order.status !== "confirmed") invalidTransition("El pedido ya está cerrado.");
    return { patch: { followUpAt: input.followUpAt }, event: "order.follow_up_set" };
  });
}

// ---------------------------------------------------------------------------
// Cobros

export type PaymentInput = {
  amountMinor: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  receivedAt: Date;
  /** Cobro informado por el transportista: queda pendiente de conciliar, no cuenta como recibido. */
  reportedByCarrier: boolean;
  /** Owner: registrar fondos recibidos por encima del saldo como devolución pendiente. */
  acceptExcess: boolean;
};

/**
 * Aplica un cobro dentro de la transacción (pedido ya bloqueado). Devuelve el parche del pedido.
 * Nunca omite dinero realmente recibido: exceso o pago sobre cancelado generan obligación de devolución.
 */
async function applyPayment(deps: SalesDeps, actor: SalesActor, ctx: TxContext, order: OrderRow, input: PaymentInput & { operationKey: string }): Promise<OrderPatch> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new SalesFailure("VALIDATION_ERROR", "Indica un importe mayor que 0.", "amount");
  if (input.receivedAt.getTime() > deps.clock.now().getTime() + 5 * 60_000) throw new SalesFailure("VALIDATION_ERROR", "La fecha de cobro no puede ser futura.", "receivedAt");
  if (order.status === "completed") invalidTransition("El pedido está completado y pagado.");

  const obligations = await ctx.sales.lockObligations(order.id);
  let status: "verified" | "reported" = "verified";
  if (input.reportedByCarrier) {
    const revision = await ctx.sales.getRevision(order.id, order.currentRevision);
    if (revision.collectionResponsible !== "carrier") invalidTransition("Este pedido no tiene cobro por transportista.");
    if (order.fulfillmentStatus !== "dispatched" && order.fulfillmentStatus !== "delivered") invalidTransition("El transportista informa el cobro tras el despacho.");
    status = "reported";
  }

  let excessMinor = 0;
  let origin: "overpayment" | "late_payment" | null = null;
  if (order.status === "cancelled") {
    if (status === "reported") invalidTransition("Un pedido cancelado no tiene cobros de transportista.");
    excessMinor = input.amountMinor;
    origin = "late_payment";
  } else {
    const balance = Math.max(0, order.totalMinor - order.paidMinor - order.reportedMinor);
    if (input.amountMinor > balance) {
      if (!input.acceptExcess || status === "reported") {
        throw new SalesFailure("OVERPAYMENT", `El saldo pendiente es S/ ${(balance / 100).toFixed(2)}. Si recibiste más, el propietario debe registrar el exceso como devolución pendiente.`, "amount");
      }
      authorize(deps, actor, "refunds.manage", "Solo el propietario registra cobros en exceso.");
      excessMinor = input.amountMinor - balance;
      origin = "overpayment";
    }
  }

  let obligationId: string | null = null;
  if (origin) {
    const obligation = await ctx.sales.insertObligation({
      orderId: order.id,
      origin,
      reason: origin === "late_payment" ? "Pago recibido sobre pedido cancelado." : "Pago recibido por encima del total.",
      authorizedMinor: excessMinor,
      actorId: actor.membershipId,
    });
    obligations.push(obligation);
    obligationId = obligation.id;
  }

  await ctx.sales.insertPayment({
    orderId: order.id,
    kind: "payment",
    status,
    method: input.method,
    amountMinor: input.amountMinor,
    reference: trimOrNull(input.reference, 120),
    note: trimOrNull(input.note, 300),
    receivedAt: input.receivedAt,
    operationKey: input.operationKey,
    obligationId,
    actorId: actor.membershipId,
  });
  await ctx.sales.insertEvent({
    orderId: order.id,
    event: status === "reported" ? "payment.reported" : "payment.recorded",
    actorId: actor.membershipId,
    data: { amountMinor: input.amountMinor, method: input.method, excessMinor },
  });

  const paidMinor = order.paidMinor + (status === "verified" ? input.amountMinor : 0);
  return {
    paidMinor,
    reportedMinor: order.reportedMinor + (status === "reported" ? input.amountMinor : 0),
    collectionStatus: collectionStatus(order.totalMinor, paidMinor),
    refundStatus: refundStatus(obligations),
  };
}

export function recordPayment(deps: SalesDeps, actor: SalesActor, input: Ref & PaymentInput): Promise<SalesResult<{ orderId: string }>> {
  return salesResult(() =>
    deps.store.transaction(async (ctx) => {
      authorize(deps, actor, "payments.record", "No tienes permiso para registrar cobros.");
      const order = await ctx.sales.lockOrder(input.orderId);
      if (!order) throw new SalesFailure("NOT_FOUND", "El pedido no existe.");
      const previous = await ctx.sales.findPaymentByKey(input.operationKey);
      if (previous) {
        if (previous.orderId !== order.id || previous.amountMinor !== input.amountMinor || previous.kind !== "payment") {
          throw new SalesFailure("IDEMPOTENCY_CONFLICT", "Este cobro ya se registró con otros datos. Recarga la página.");
        }
        return { orderId: order.id };
      }
      if (order.version !== input.expectedVersion) throw new SalesFailure("VERSION_CONFLICT", "El pedido cambió mientras tanto. Recarga la página.");
      const patch = await applyPayment(deps, actor, ctx, order, input);
      await ctx.sales.updateOrder(order.id, patch);
      return { orderId: order.id };
    }),
  );
}

/** Conciliación: la empresa recibió el dinero que cobró el transportista. */
export function verifyReportedPayment(deps: SalesDeps, actor: SalesActor, input: Ref & { paymentId: string }) {
  return orderCommand(deps, actor, input, "payments.record", async ({ sales }, order) => {
    const payment = await sales.lockPayment(input.paymentId);
    if (!payment || payment.orderId !== order.id || payment.kind !== "payment") throw new SalesFailure("NOT_FOUND", "El cobro no existe.");
    if (payment.status !== "reported") invalidTransition("Ese cobro ya está verificado.");
    await sales.markPaymentVerified(payment.id, actor.membershipId);
    const paidMinor = order.paidMinor + payment.amountMinor;
    return {
      patch: { paidMinor, reportedMinor: order.reportedMinor - payment.amountMinor, collectionStatus: collectionStatus(order.totalMinor, paidMinor) },
      event: "payment.reconciled",
      data: { amountMinor: payment.amountMinor },
    };
  });
}

// ---------------------------------------------------------------------------
// Preparación y entrega

async function acceptedTerms(ctx: TxContext, order: OrderRow) {
  return ctx.sales.getRevision(order.id, order.acceptedRevision ?? order.currentRevision);
}

async function requirePaymentGate(ctx: TxContext, order: OrderRow) {
  const terms = await acceptedTerms(ctx, order);
  const problem = fulfillmentPaymentProblem({ paymentMode: terms.paymentMode!, requiredDepositMinor: terms.requiredDepositMinor, totalMinor: order.totalMinor, paidMinor: order.paidMinor });
  if (problem) throw new SalesFailure("PAYMENT_REVIEW_REQUIRED", problem.message);
  return terms;
}

function requireFulfillment(order: OrderRow, transition: keyof typeof FULFILLMENT_TRANSITIONS) {
  const rule = FULFILLMENT_TRANSITIONS[transition];
  if (order.status !== "confirmed" || !(rule.from as readonly string[]).includes(order.fulfillmentStatus)) {
    invalidTransition("Esta acción no corresponde al estado actual de la entrega.");
  }
  return rule.to;
}

export function markPreparing(deps: SalesDeps, actor: SalesActor, input: Ref) {
  return orderCommand(deps, actor, input, "orders.operate", async (ctx, order) => {
    const to = requireFulfillment(order, "prepare");
    await requirePaymentGate(ctx, order);
    return { patch: { fulfillmentStatus: to }, event: "fulfillment.preparing" };
  });
}

export function markReady(deps: SalesDeps, actor: SalesActor, input: Ref) {
  return orderCommand(deps, actor, input, "orders.operate", async (_ctx, order) => {
    return { patch: { fulfillmentStatus: requireFulfillment(order, "ready") }, event: "fulfillment.ready" };
  });
}

/** Envío: despacho consume la reserva una sola vez (descuenta físico). */
export function dispatchOrder(deps: SalesDeps, actor: SalesActor, input: Ref & { carrier: string | null; trackingCode: string | null }) {
  return orderCommand(deps, actor, input, "orders.operate", async (ctx, order) => {
    const to = requireFulfillment(order, "dispatch");
    const terms = await requirePaymentGate(ctx, order);
    if (terms.deliveryMode !== "shipping") invalidTransition("Este pedido es de recojo: usa «Entregar en tienda».");
    await ctx.inventory.consume({ orderId: order.id, actorId: actor.membershipId });
    return {
      patch: { fulfillmentStatus: to, dispatchedAt: deps.clock.now(), carrier: trimOrNull(input.carrier, 80), trackingCode: trimOrNull(input.trackingCode, 80) },
      event: "fulfillment.dispatched",
    };
  });
}

export function markDelivered(deps: SalesDeps, actor: SalesActor, input: Ref) {
  return orderCommand(deps, actor, input, "orders.operate", async (_ctx, order) => {
    return { patch: { fulfillmentStatus: requireFulfillment(order, "deliverShipping"), deliveredAt: deps.clock.now() }, event: "fulfillment.delivered" };
  });
}

/**
 * Recojo: entrega en tienda con el saldo cobrado en el mismo acto (nunca se entrega
 * con saldo sin registrar el cobro verificado). Consume la reserva.
 */
export function handOverPickup(deps: SalesDeps, actor: SalesActor, input: Ref & { payment: (Omit<PaymentInput, "reportedByCarrier" | "acceptExcess"> & { operationKey: string }) | null }) {
  return orderCommand(deps, actor, input, "orders.operate", async (ctx, order) => {
    const to = requireFulfillment(order, "handOverPickup");
    const terms = await acceptedTerms(ctx, order);
    if (terms.deliveryMode !== "pickup") invalidTransition("Este pedido es de envío: usa «Despachar».");
    let current = order;
    let patch: OrderPatch = {};
    if (input.payment) {
      authorize(deps, actor, "payments.record", "No tienes permiso para registrar cobros.");
      patch = await applyPayment(deps, actor, ctx, order, { ...input.payment, reportedByCarrier: false, acceptExcess: false });
      current = { ...order, paidMinor: patch.paidMinor ?? order.paidMinor };
    }
    if (current.paidMinor < current.totalMinor) {
      throw new SalesFailure("PAYMENT_REVIEW_REQUIRED", `Registra el cobro del saldo (S/ ${((current.totalMinor - current.paidMinor) / 100).toFixed(2)}) al entregar.`);
    }
    await ctx.inventory.consume({ orderId: order.id, actorId: actor.membershipId });
    return { patch: { ...patch, fulfillmentStatus: to, deliveredAt: deps.clock.now() }, event: "fulfillment.picked_up" };
  });
}

export function completeOrder(deps: SalesDeps, actor: SalesActor, input: Ref) {
  return orderCommand(deps, actor, input, "orders.operate", async ({ sales }, order) => {
    const obligations = await sales.lockObligations(order.id);
    const problems = completionProblems({ ...order, outstandingRefundMinor: outstandingRefunds(obligations) });
    if (problems.length > 0) invalidTransition(`No se puede completar: ${problems.join(" ")}`);
    return { patch: { status: "completed", completedAt: deps.clock.now() }, event: "order.completed" };
  });
}

// ---------------------------------------------------------------------------
// Cancelación, reembolsos y devoluciones

/**
 * Antes del despacho: libera la reserva una vez. Con dinero recibido: solo owner, y crea la
 * obligación de devolverlo (no es deuda del cliente). Tras despacho solo si volvió todo.
 */
export function cancelOrder(deps: SalesDeps, actor: SalesActor, input: Ref & { reason: string }) {
  return orderCommand(deps, actor, input, "orders.operate", async ({ sales, inventory }, order) => {
    const reason = input.reason.trim();
    if (reason.length < 3) throw new SalesFailure("VALIDATION_ERROR", "Indica el motivo de la cancelación.", "reason");
    if (order.status === "cancelled" || order.status === "completed") invalidTransition("El pedido ya está cerrado.");

    const beforeDispatch = cancellableBeforeDispatch(order.status, order.fulfillmentStatus);
    if (!beforeDispatch) {
      authorize(deps, actor, "orders.cancel_paid", "Tras el despacho solo el propietario cancela, y únicamente si se registró la devolución de todas las prendas.");
      const revision = await acceptedTerms({ sales } as TxContext, order);
      const returned = await sales.returnedUnits(order.id);
      const allBack = revision.lines.every((l) => (returned.get(l.variantId) ?? 0) >= l.quantity);
      if (!allBack) invalidTransition("Tras el despacho, registra primero la devolución de todas las prendas.");
    }
    if (order.paidMinor > 0) authorize(deps, actor, "orders.cancel_paid", "Solo el propietario cancela pedidos con cobros.");

    if (order.status === "confirmed" && beforeDispatch) await inventory.release({ orderId: order.id, actorId: actor.membershipId });

    const obligations = await sales.lockObligations(order.id);
    const refundable = order.paidMinor - obligations.reduce((s, o) => s + o.authorizedMinor, 0);
    if (refundable > 0) {
      obligations.push(await sales.insertObligation({ orderId: order.id, origin: "cancellation", reason, authorizedMinor: refundable, actorId: actor.membershipId }));
    }
    return {
      patch: {
        status: "cancelled",
        fulfillmentStatus: beforeDispatch ? "cancelled" : order.fulfillmentStatus,
        cancelReason: reason.slice(0, 300),
        cancelledAt: deps.clock.now(),
        refundStatus: refundStatus(obligations),
      },
      event: "order.cancelled",
      reason,
      data: { refundableMinor: Math.max(0, refundable) },
    };
  });
}

/** Devolución de dinero contra una obligación autorizada. No repone inventario. */
export function recordRefund(
  deps: SalesDeps,
  actor: SalesActor,
  input: Ref & { obligationId: string; amountMinor: number; method: PaymentMethod; reference: string | null; note: string | null; refundedAt: Date },
) {
  return orderCommand(deps, actor, input, "refunds.manage", async ({ sales }, order) => {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new SalesFailure("VALIDATION_ERROR", "Indica un importe mayor que 0.", "amount");
    const obligations = await sales.lockObligations(order.id);
    const obligation = obligations.find((o) => o.id === input.obligationId);
    if (!obligation) throw new SalesFailure("NOT_FOUND", "La devolución pendiente no existe.");
    const pending = obligation.authorizedMinor - obligation.refundedMinor;
    if (input.amountMinor > pending) throw new SalesFailure("OVERPAYMENT", `Quedan S/ ${(pending / 100).toFixed(2)} por devolver en esta obligación.`, "amount");

    await sales.insertPayment({
      orderId: order.id,
      kind: "refund",
      status: "verified",
      method: input.method,
      amountMinor: input.amountMinor,
      reference: trimOrNull(input.reference, 120),
      note: trimOrNull(input.note, 300),
      receivedAt: input.refundedAt,
      operationKey: input.operationKey,
      obligationId: obligation.id,
      actorId: actor.membershipId,
    });
    await sales.addRefundToObligation(obligation.id, input.amountMinor);
    obligation.refundedMinor += input.amountMinor;
    return {
      patch: { refundedMinor: order.refundedMinor + input.amountMinor, refundStatus: refundStatus(obligations) },
      event: "refund.recorded",
      data: { amountMinor: input.amountMinor, method: input.method },
    };
  });
}

/**
 * Recepción de prendas devueltas (o entrega fallida). Solo las aptas vuelven al stock;
 * el dinero se trata aparte (obligación opcional, nunca automática por el reingreso).
 */
export function recordReturnReceipt(
  deps: SalesDeps,
  actor: SalesActor,
  input: Ref & { reason: string; items: { variantId: string; received: number; restock: number }[]; refundMinor: number },
) {
  return orderCommand(deps, actor, input, "refunds.manage", async ({ sales, inventory }, order) => {
    if (order.fulfillmentStatus !== "dispatched" && order.fulfillmentStatus !== "delivered") invalidTransition("Solo se reciben devoluciones de pedidos despachados o entregados.");
    const reason = input.reason.trim();
    if (reason.length < 3) throw new SalesFailure("VALIDATION_ERROR", "Indica el motivo de la devolución.", "reason");
    const revision = await acceptedTerms({ sales } as TxContext, order);
    const sold = new Map(revision.lines.map((l) => [l.variantId, l]));
    const already = await sales.returnedUnits(order.id);
    const items = input.items.filter((i) => i.received > 0);
    if (items.length === 0) throw new SalesFailure("VALIDATION_ERROR", "Indica al menos una prenda recibida.", "items");
    for (const item of items) {
      const line = sold.get(item.variantId);
      if (!line) throw new SalesFailure("VALIDATION_ERROR", "Esa prenda no pertenece al pedido.", "items");
      if (!Number.isSafeInteger(item.received) || !Number.isSafeInteger(item.restock) || item.restock < 0 || item.restock > item.received) {
        throw new SalesFailure("VALIDATION_ERROR", "Las aptas no pueden superar las recibidas.", "items");
      }
      if ((already.get(item.variantId) ?? 0) + item.received > line.quantity) {
        throw new SalesFailure("VALIDATION_ERROR", `${line.sku}: no puedes recibir más unidades de las entregadas.`, "items");
      }
    }

    await sales.insertReturnReceipt({ orderId: order.id, reason, operationKey: input.operationKey, actorId: actor.membershipId, items: items.map((i) => ({ variantId: i.variantId, received: i.received, restocked: i.restock })) });
    for (const item of items) {
      if (item.restock > 0) {
        await inventory.restockReturn({ orderId: order.id, variantId: item.variantId, quantity: item.restock, operationKey: `return:${input.operationKey}:${item.variantId}`, actorId: actor.membershipId, note: reason.slice(0, 300) });
      }
    }

    const patch: OrderPatch = {};
    if (input.refundMinor > 0) {
      const obligations = await sales.lockObligations(order.id);
      const refundable = order.paidMinor - obligations.reduce((s, o) => s + o.authorizedMinor, 0);
      if (input.refundMinor > refundable) throw new SalesFailure("VALIDATION_ERROR", `Como máximo puedes comprometer S/ ${(Math.max(0, refundable) / 100).toFixed(2)} (lo cobrado aún no comprometido).`, "refund");
      obligations.push(await sales.insertObligation({ orderId: order.id, origin: "return", reason, authorizedMinor: input.refundMinor, actorId: actor.membershipId }));
      patch.refundStatus = refundStatus(obligations);
    }
    return { patch, event: "return.received", reason, data: { items: items.map((i) => ({ sku: sold.get(i.variantId)!.sku, received: i.received, restocked: i.restock })), refundMinor: input.refundMinor } };
  });
}

/** Corrección histórica del cliente vinculado: solo owner, con motivo. No toca snapshots. */
export function correctCustomerLink(deps: SalesDeps, actor: SalesActor, input: Ref & { customerId: string; reason: string }) {
  return orderCommand(deps, actor, input, "customers.archive", async ({ customers }, order) => {
    const reason = input.reason.trim();
    if (reason.length < 3) throw new SalesFailure("VALIDATION_ERROR", "Indica el motivo de la corrección.", "reason");
    if (order.status === "requested") invalidTransition("La ficha se elige al confirmar.");
    if (order.customerId === input.customerId) invalidTransition("El pedido ya está vinculado a esa ficha.");
    const link = await customers.requireLinkable(actor, input.customerId);
    if (!link.ok) throw new SalesFailure("CUSTOMER_REQUIRED", link.message);
    return { patch: { customerId: link.id }, event: "order.customer_relinked", reason, data: { from: order.customerId, to: link.id } };
  });
}
