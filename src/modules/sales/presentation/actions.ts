"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CATALOG_CACHE_TAG, searchQuotableVariants } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { getBalances } from "@/modules/inventory/server";
import { getImagesByIds } from "@/modules/media/server";
import { errorState, fieldErrorsFrom, type FormState } from "@/shared/forms/form-state";
import { parsePENInput } from "@/shared/domain/money";

import * as commands from "../application/order-commands";
import type { SalesResult } from "../application/ports";
import { COLLECTION_RESPONSIBLES, DELIVERY_MODES, ORDER_SOURCES, PAYMENT_METHODS, PAYMENT_MODES } from "../contracts";
import { getSalesDeps } from "../server";

const fields = (formData: FormData) => Object.fromEntries(formData) as Record<string, string>;

const ref = z.object({ orderId: z.uuid(), expectedVersion: z.coerce.number().int().positive(), operationKey: z.uuid() });
const optionalText = (max: number) => z.string().max(max).optional().transform((v) => (v?.trim() ? v.trim() : null));
const money = (field: string, { optional = false } = {}) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) {
        if (optional) return 0;
        ctx.addIssue({ code: "custom", message: "Indica el importe.", path: [] });
        return z.NEVER;
      }
      const minor = parsePENInput(v);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: "Importe no válido (ej. 70 o 70.50).", path: [] });
        return z.NEVER;
      }
      return minor;
    })
    .describe(field);
const dateInput = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(`${v}T12:00:00-05:00`) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Fecha no válida.");
const linesSchema = z
  .string()
  .transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Líneas inválidas." });
      return z.NEVER;
    }
  })
  .pipe(z.array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(10) })).max(50));

/** `stock`: el comando cambió el disponible (reserva, liberación o reingreso) → tienda pública. */
function finish(result: SalesResult<unknown>, success: string, { stock = false } = {}): FormState {
  if (!result.ok) return { ...errorState(result.message, result.field ? { [result.field]: result.message } : undefined), code: result.code };
  if (stock) updateTag(CATALOG_CACHE_TAG);
  refresh();
  return { status: "success", message: success };
}

function invalid(error: z.ZodError): FormState {
  return errorState("Revisa los datos.", fieldErrorsFrom(error.issues));
}

// ---------------------------------------------------------------------------

export type VariantOption = { variantId: string; label: string; sku: string; priceMinor: number; available: number | null; imageUrl: string | null };

/** Búsqueda de variantes vendibles para armar líneas (precio y disponible orientativos). */
export async function searchVariantsAction(term: string): Promise<VariantOption[]> {
  await requireAdminActor();
  const variants = await searchQuotableVariants(String(term).slice(0, 80), 20);
  const [balances, images] = await Promise.all([
    getBalances(variants.map((v) => v.variantId)),
    getImagesByIds(variants.map((v) => v.imageMediaId).filter((id): id is string => id !== null)),
  ]);
  return variants.map((v) => ({
    imageUrl: v.imageMediaId ? (images.get(v.imageMediaId)?.url ?? null) : null,
    variantId: v.variantId,
    label: `${v.productTitle} · ${v.colorLabel} / ${v.sizeCode === "UNICA" ? "Única" : v.sizeCode}`,
    sku: v.sku,
    priceMinor: v.priceMinor,
    available: balances.get(v.variantId)?.available ?? null,
  }));
}

const manualOrderSchema = z.object({
  source: z.enum(ORDER_SOURCES).refine((s) => s !== "web", "Origen no válido."),
  customerName: z.string().max(200),
  customerPhone: z.string().max(40),
  deliveryPreference: z.enum(DELIVERY_MODES),
  lines: linesSchema,
  note: optionalText(500),
  creationKey: z.uuid(),
});

export async function createManualOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = manualOrderSchema.safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const result = await commands.createOrderRequest(getSalesDeps(), actor, parsed.data);
  if (!result.ok) return finish(result, "");
  redirect(`/admin/pedidos/${result.value.id}?creado=1`);
}

const revisionSchema = ref.extend({
  lines: linesSchema,
  discount: money("discount", { optional: true }),
  shipping: money("shipping", { optional: true }),
  deliveryMode: z.enum(DELIVERY_MODES),
  deliveryAddress: optionalText(300),
  deliveryNote: optionalText(300),
  paymentMode: z.union([z.enum(PAYMENT_MODES), z.literal("")]).transform((v) => v || null),
  deposit: money("deposit", { optional: true }),
  collectionResponsible: z.enum(COLLECTION_RESPONSIBLES),
  note: optionalText(500),
});

export async function reviseAgreementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = revisionSchema.safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { discount, shipping, deposit, ...rest } = parsed.data;
  return finish(
    await commands.reviseAgreement(getSalesDeps(), actor, { ...rest, discountMinor: discount, shippingMinor: shipping, requiredDepositMinor: deposit }),
    "Nueva revisión guardada. Registra la aceptación del cliente.",
  );
}

export async function recordAgreementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ revision: z.coerce.number().int().positive(), reason: optionalText(300) }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  return finish(await commands.recordCustomerAgreement(getSalesDeps(), actor, { ...parsed.data, note: parsed.data.reason }), "Acuerdo registrado.");
}

const confirmSchema = ref.extend({
  customerMode: z.enum(["existing", "new"]),
  customerId: z.string().optional(),
  name: z.string().max(200).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  email: z.string().max(254).optional().default(""),
  confirmSharedPhone: z.literal("on").optional(),
  followUpAt: dateInput,
});

export async function confirmOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = confirmSchema.safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.customerMode === "existing" && !z.uuid().safeParse(d.customerId).success) return errorState("Elige una ficha de cliente.", { customerId: "Elige una ficha." });
  const customer: commands.CustomerChoice =
    d.customerMode === "existing"
      ? { kind: "existing", customerId: d.customerId! }
      : { kind: "new", name: d.name, phone: d.phone, email: d.email || null, confirmSharedPhone: d.confirmSharedPhone === "on" };
  return finish(await commands.confirmOrder(getSalesDeps(), actor, { ...d, customer, followUpAt: d.followUpAt }), "Pedido confirmado y stock reservado.", { stock: true });
}

export async function setFollowUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ followUpAt: dateInput }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  return finish(await commands.setFollowUp(getSalesDeps(), actor, parsed.data), "Seguimiento actualizado.");
}

const paymentFields = {
  amount: money("amount"),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(120),
  note: optionalText(300),
  receivedAt: dateInput,
};

export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ ...paymentFields, reportedByCarrier: z.literal("on").optional(), acceptExcess: z.literal("on").optional() }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { amount, receivedAt, reportedByCarrier, acceptExcess, ...rest } = parsed.data;
  return finish(
    await commands.recordPayment(getSalesDeps(), actor, { ...rest, amountMinor: amount, receivedAt: receivedAt ?? new Date(), reportedByCarrier: reportedByCarrier === "on", acceptExcess: acceptExcess === "on" }),
    reportedByCarrier === "on" ? "Cobro del transportista registrado como pendiente de conciliar." : "Cobro registrado.",
  );
}

export async function verifyReportedPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ paymentId: z.uuid() }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  return finish(await commands.verifyReportedPayment(getSalesDeps(), actor, parsed.data), "Cobro conciliado.");
}

const STEP_COMMANDS = {
  prepare: [commands.markPreparing, "Pedido en preparación."],
  ready: [commands.markReady, "Pedido listo."],
  delivered: [commands.markDelivered, "Entrega registrada."],
  complete: [commands.completeOrder, "Pedido completado."],
} as const;

export async function fulfillmentStepAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ step: z.enum(["prepare", "ready", "delivered", "complete"]) }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const [command, message] = STEP_COMMANDS[parsed.data.step];
  return finish(await command(getSalesDeps(), actor, parsed.data), message);
}

export async function dispatchOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ carrier: optionalText(80), trackingCode: optionalText(80) }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  return finish(await commands.dispatchOrder(getSalesDeps(), actor, parsed.data), "Pedido despachado; stock descontado.");
}

export async function handOverPickupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const raw = fields(formData);
  const parsed = ref.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  let payment: Parameters<typeof commands.handOverPickup>[2]["payment"] = null;
  if (raw.amount?.trim()) {
    const p = z.object(paymentFields).safeParse(raw);
    if (!p.success) return invalid(p.error);
    payment = { amountMinor: p.data.amount, method: p.data.method, reference: p.data.reference, note: p.data.note, receivedAt: p.data.receivedAt ?? new Date(), operationKey: parsed.data.operationKey };
  }
  return finish(await commands.handOverPickup(getSalesDeps(), actor, { ...parsed.data, payment }), "Entregado en tienda.");
}

export async function cancelOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ reason: z.string().max(300) }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  return finish(await commands.cancelOrder(getSalesDeps(), actor, parsed.data), "Pedido cancelado.", { stock: true });
}

export async function recordRefundAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ obligationId: z.uuid(), ...paymentFields }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { amount, receivedAt, ...rest } = parsed.data;
  return finish(await commands.recordRefund(getSalesDeps(), actor, { ...rest, amountMinor: amount, refundedAt: receivedAt ?? new Date() }), "Devolución de dinero registrada.");
}

export async function recordReturnAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const raw = fields(formData);
  const parsed = ref.extend({ reason: z.string().max(300), refund: money("refund", { optional: true }) }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const items: { variantId: string; received: number; restock: number }[] = [];
  for (const [name, value] of Object.entries(raw)) {
    const match = /^received:(.+)$/.exec(name);
    if (!match) continue;
    const received = Number.parseInt(value || "0", 10);
    const restock = Number.parseInt(raw[`restock:${match[1]}`] || "0", 10);
    if (!z.uuid().safeParse(match[1]).success || Number.isNaN(received) || Number.isNaN(restock)) return errorState("Cantidades no válidas.");
    items.push({ variantId: match[1], received, restock });
  }
  const { refund, ...rest } = parsed.data;
  return finish(await commands.recordReturnReceipt(getSalesDeps(), actor, { ...rest, items, refundMinor: refund }), "Devolución registrada.", { stock: true });
}

export async function correctCustomerLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ customerId: z.uuid(), reason: z.string().max(300) }).safeParse(fields(formData));
  if (!parsed.success) return invalid(parsed.error);
  return finish(await commands.correctCustomerLink(getSalesDeps(), actor, parsed.data), "Vínculo corregido.");
}
