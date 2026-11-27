import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { randomBytes } from "node:crypto";

import { getDb } from "@/infrastructure/database/client";
import { CATALOG_CACHE_TAG } from "@/shared/cache/tags";
import type { AnyDatabase } from "@/infrastructure/database/types";
import { getStorefrontConfig } from "@/infrastructure/config/server";
import { getCartVariantDisplay, getQuotableVariants } from "@/modules/catalog/server";
import { normalizeName, normalizePhone } from "@/modules/customers/contracts";
import { createCustomerWithin, CustomerFailure, requireLinkableCustomerWithin } from "@/modules/customers/server";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";
import { getBalances, inventoryWithin } from "@/modules/inventory/server";
import { getPublicImagesByIds } from "@/modules/media/server";

import type { CustomerPort, SalesStore } from "./application/ports";
import { quoteCart, submitWebRequest, type WebRequestGuards, type WebRequestInput, type WebSalesDeps } from "./application/web-requests";
import { REQUEST_TERMS, type CartQuote, type CartQuoteLine, type CustomerOrderRow, type OrderingStatus, type OrderSummary, type WebRequestReceipt } from "./contracts";
import type { EvaluatedQuote, QuoteRequestLine } from "./domain/cart-quote";
import { packApplies } from "./domain/promotions";
import { PackSettingsFailure, packSettingsSchema } from "./application/pack-settings";
import { readPackSettings, writePackSettingsWithin } from "./infrastructure/pack-settings";
import type { PackSettingsInput } from "./contracts";
import { z } from "zod";

export { PackSettingsFailure } from "./application/pack-settings";

export async function getActivePackPolicies(db: AnyDatabase = getDb()) {
  const config = await readPackSettings(db);
  return config.enabled ? [config.policy] : [];
}

export async function getPublicPackPolicies() {
  "use cache";
  cacheTag(CATALOG_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return getActivePackPolicies();
}

export async function getAdminPackSettings(actor: AdminActor, db: AnyDatabase = getDb()) {
  if (!actorCan(actor, "content.manage")) throw new PackSettingsFailure("FORBIDDEN", "Solo el propietario puede configurar la tienda.");
  return readPackSettings(db);
}

/** Dentro de la transacción que guarda también el contenido del pack. */
export async function savePackSettingsWithin(db: AnyDatabase, actor: AdminActor, input: PackSettingsInput & { expectedVersion: number; operationKey: string }) {
  if (!actorCan(actor, "content.manage")) throw new PackSettingsFailure("FORBIDDEN", "Solo el propietario puede cambiar el pack.");
  const parsed = packSettingsSchema.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !z.uuid().safeParse(input.operationKey).success) throw new PackSettingsFailure("VALIDATION_ERROR", parsed.success ? "Formulario inválido." : parsed.error.issues.map((i) => i.message).join(" "));
  return writePackSettingsWithin(db, actor.membershipId, { ...parsed.data, expectedVersion: input.expectedVersion, operationKey: input.operationKey });
}
import { buildWhatsAppLinks } from "./domain/whatsapp-message";
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

export function getSalesDeps(): WebSalesDeps {
  return buildSalesDeps(getDb());
}

/** Dependencias sobre una conexión dada (aplicación o base de pruebas). */
export function buildSalesDeps(db: AnyDatabase): WebSalesDeps {
  return {
    packPolicies: () => getActivePackPolicies(db),
    availability: async (ids) => new Map([...(await getBalances(ids, db)).values()].map((b) => [b.variantId, b.available])),
    store: createSalesStore(db),
    quote: (ids) => getQuotableVariants(ids, db),
    authorize: (actor, capability) => actorCan(actor as AdminActor, capability),
    randomBytes: () => randomBytes(8),
    clock: { now: () => new Date() },
    normalizeContact: ({ name, phone }) => {
      const n = normalizeName(name);
      if (!n.ok) return { ok: false, field: "name", message: n.problem.message };
      if (phone === null) return { ok: true, name: n.value, phone: null };
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

// ---------------------------------------------------------------------------
// Tienda pública (fase 6). Sin actor; las Server Actions validan forma y límites de tasa.

/**
 * ¿Se pueden registrar solicitudes en este despliegue? Requiere número de WhatsApp
 * configurado y, en producción, condiciones finales (no borrador).
 */
export function getOrderingStatus(whatsappNumber?: string | null): OrderingStatus {
  const config = getStorefrontConfig();
  if (!(whatsappNumber === undefined ? config.whatsappNumber : whatsappNumber)) {
    return { enabled: false, testMode: config.testMode, reason: "Las solicitudes por WhatsApp aún no están habilitadas en esta tienda." };
  }
  if (!config.testMode && REQUEST_TERMS.status !== "final") {
    return { enabled: false, testMode: false, reason: "Las solicitudes estarán disponibles cuando publiquemos las condiciones finales." };
  }
  return { enabled: true, testMode: config.testMode };
}

/** Añade enlace y foto (catálogo/media) a una cotización evaluada. */
async function toCartQuote(quote: EvaluatedQuote, db: AnyDatabase): Promise<CartQuote> {
  const display = new Map((await getCartVariantDisplay(quote.lines.map((l) => l.variantId), db)).map((d) => [d.variantId, d]));
  const images = await getPublicImagesByIds(
    [...display.values()].map((d) => d.coverMediaId).filter((id): id is string => id !== null),
    db,
  );
  const policy = quote.packPolicy ?? null;
  const packUnits = policy ? quote.lines.filter((l) => (l.status === "ok" || l.status === "insufficient") && l.variant && packApplies(policy, { categorySlug: l.variant.categorySlug ?? null, productSlug: l.variant.productSlug })).reduce((s, l) => s + l.quantity, 0) : 0;
  return {
    subtotalMinor: quote.subtotalMinor,
    promotionMinor: quote.promotion.discountMinor,
    promotionLabel: quote.promotion.applied.map((a) => a.label).join(", ") || null,
    totalMinor: quote.totalMinor,
    pack: policy ? { label: policy.label, units: packUnits, tierTotalsMinor: policy.tierTotalsMinor } : null,
    units: quote.units,
    ready: quote.ready,
    lines: quote.lines.map((l): CartQuoteLine => {
      const d = display.get(l.variantId);
      const image = d?.coverMediaId ? images.get(d.coverMediaId) : undefined;
      return {
        variantId: l.variantId,
        quantity: l.quantity,
        status: l.status,
        maxQuantity: l.maxQuantity,
        previousPriceMinor: l.previousPriceMinor,
        packEligible: Boolean(policy && l.variant && packApplies(policy, { categorySlug: l.variant.categorySlug ?? null, productSlug: l.variant.productSlug })),
        item: l.variant
          ? {
              sku: l.variant.sku,
              productTitle: l.variant.productTitle,
              colorLabel: l.variant.colorLabel,
              sizeCode: l.variant.sizeCode,
              unitPriceMinor: l.variant.priceMinor,
              lineTotalMinor: l.variant.priceMinor * l.quantity,
              href: d?.href ?? null,
              image: image ? { url: image.url, width: image.width, height: image.height, alt: d?.coverAlt ?? "" } : null,
            }
          : null,
      };
    }),
  };
}

/** QuoteCart público: precios, publicación y disponibilidad orientativa vigentes. */
export async function quoteStorefrontCart(lines: readonly QuoteRequestLine[], db: AnyDatabase = getDb()) {
  const result = await quoteCart(buildSalesDeps(db), lines);
  if (!result.ok) return result;
  return { ok: true as const, quote: await toCartQuote(result.quote, db) };
}

export type StorefrontRequestResult =
  | { ok: true; receipt: WebRequestReceipt; replayed: boolean }
  | { ok: false; code: string; message: string; field?: string; quote?: CartQuote };

/** Registra (o recupera por reintento) la solicitud web y arma los enlaces de WhatsApp. */
export async function submitStorefrontRequest(input: WebRequestInput, guards: WebRequestGuards, db: AnyDatabase = getDb(), whatsappNumber?: string | null): Promise<StorefrontRequestResult> {
  const number = whatsappNumber === undefined ? getStorefrontConfig().whatsappNumber : whatsappNumber;
  const status = getOrderingStatus(number);
  if (!status.enabled || !number) return { ok: false, code: "ORDERING_DISABLED", message: status.enabled ? "Solicitudes deshabilitadas." : status.reason };
  const result = await submitWebRequest(buildSalesDeps(db), input, guards);
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message, field: result.field, quote: result.quote ? await toCartQuote(result.quote, db) : undefined };
  }
  const links = buildWhatsAppLinks(number, result.request.message);
  return {
    ok: true,
    replayed: result.replayed,
    receipt: { ...result.request, whatsappUrl: links.withText, whatsappChatUrl: links.chat },
  };
}
