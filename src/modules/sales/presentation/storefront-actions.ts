"use server";

import { headers } from "next/headers";

import { getDb } from "@/infrastructure/database/client";
import { submitConfiguredStorefrontRequest } from "@/composition/storefront-ordering";
import { consumeRateLimit, type RateRule } from "@/infrastructure/rate-limit/rate-limiter";
import { rateLimitSubject, trustsProxyHeaders } from "@/infrastructure/security/client-subject";
import { reportPublicFailure } from "@/infrastructure/observability/failure";
import { normalizeName } from "@/modules/customers/contracts";
import { fieldErrorsFrom, type FormState } from "@/shared/forms/form-state";

import type { CartQuote, WebRequestReceipt } from "../contracts";
import { quoteStorefrontCart } from "../server";
import { quoteLinesSchema, requestFormSchema } from "./storefront-schemas";

/**
 * Server Actions de la tienda pública. Son endpoints POST alcanzables por red: validan la
 * forma de la entrada, aplican límites de tasa compartidos y delegan en sales. Sin caché.
 */

/** Límites iniciales (configurables en código; observar falsos positivos tras el lanzamiento). */
const QUOTE_RULES: RateRule[] = [{ scope: "store.quote", limit: 120, windowSeconds: 600 }];
const REQUEST_RULES: RateRule[] = [
  { scope: "store.request", limit: 6, windowSeconds: 600 },
  { scope: "store.request.day", limit: 30, windowSeconds: 86_400 },
];

/**
 * Identifica al cliente por la IP que informa la plataforma (Vercel fija `x-forwarded-for`).
 * Sin cabecera, todos comparten un único cupo: es más estricto, no más laxo.
 */
async function clientSubject(): Promise<string> {
  const h = await headers();
  return rateLimitSubject(h, trustsProxyHeaders(process.env));
}

export type QuoteActionResult = { ok: true; quote: CartQuote } | { ok: false; message: string; code?: string };

/** QuoteCart: el navegador envía ids, cantidades y el precio que vio. */
export async function quoteCartAction(lines: unknown): Promise<QuoteActionResult> {
  const parsed = quoteLinesSchema.safeParse(lines);
  if (!parsed.success) return { ok: false, code: "VALIDATION_ERROR", message: "Tu carrito tiene datos no válidos. Quita los productos con problemas." };
  try {
    if (!(await consumeRateLimit(getDb(), await clientSubject(), QUOTE_RULES))) {
      return { ok: false, code: "RATE_LIMITED", message: "Demasiadas consultas seguidas. Espera un momento." };
    }
    const result = await quoteStorefrontCart(parsed.data);
    return result.ok ? { ok: true, quote: result.quote } : { ok: false, code: result.code, message: result.message };
  } catch {
    const requestId = reportPublicFailure("store.quote");
    return { ok: false, code: "UNAVAILABLE", message: `No pudimos consultar el carrito. Vuelve a intentarlo. Referencia de soporte: ${requestId}` };
  }
}

export type RequestFormState = FormState & { receipt?: WebRequestReceipt; replayed?: boolean; quote?: CartQuote };

/** CreateOrderRequest web: guarda la solicitud antes de construir el mensaje de WhatsApp. */
export async function submitRequestAction(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const parsed = requestFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error.issues);
    if (fieldErrors.lines || fieldErrors.creationKey) return { status: "error", code: "VALIDATION_ERROR", message: "Tu carrito tiene datos no válidos. Recarga la página y revísalo." };
    return { status: "error", code: "VALIDATION_ERROR", message: "Revisa los datos marcados.", fieldErrors };
  }
  const d = parsed.data;
  // Todos los errores de campo a la vez (el caso de uso se detiene en el primero).
  const fieldErrors: Record<string, string> = {};
  const name = normalizeName(d.customerName);
  if (!name.ok) fieldErrors.customerName = name.problem.message;
  if (d.acceptedTerms !== "on") fieldErrors.acceptedTerms = "Debes aceptar las condiciones de la solicitud.";
  if (Object.keys(fieldErrors).length) return { status: "error", code: "VALIDATION_ERROR", message: "Revisa los datos marcados.", fieldErrors };

  const subject = await clientSubject();
  let result: Awaited<ReturnType<typeof submitConfiguredStorefrontRequest>>;
  try {
    result = await submitConfiguredStorefrontRequest(
    {
      lines: d.lines,
      acceptedTotalMinor: d.acceptedTotalMinor,
      customerName: d.customerName,
      deliveryPreference: d.deliveryPreference,
      termsVersion: d.termsVersion,
      acceptedTerms: d.acceptedTerms === "on",
      creationKey: d.creationKey,
      couponCode: d.couponCode || null,
    },
    { consumeRateLimit: () => consumeRateLimit(getDb(), subject, REQUEST_RULES) },
    );
  } catch {
    const requestId = reportPublicFailure("store.request");
    return { status: "error", code: "UNAVAILABLE", message: `No pudimos registrar la solicitud. Reintenta con el mismo carrito. Referencia de soporte: ${requestId}` };
  }
  if (!result.ok) {
    return {
      status: "error",
      code: result.code,
      message: result.message,
      fieldErrors: result.field && result.field !== "lines" ? { [result.field]: result.message } : undefined,
      quote: result.quote,
    };
  }
  return { status: "success", message: "Solicitud registrada.", receipt: result.receipt, replayed: result.replayed };
}
