/**
 * Mensaje de WhatsApp de una solicitud registrada (BuildWhatsAppMessage). Función pura y
 * determinista: mismo snapshot → mismo texto. Incluye TODAS las líneas; no lleva nombre,
 * teléfono, dirección ni datos de pago. El importe del texto nunca es fuente de verdad.
 */
import type { DeliveryMode } from "../contracts";

export type MessageLine = {
  productTitle: string;
  colorLabel: string;
  sizeCode: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

export type MessageInput = {
  reference: string;
  lines: readonly MessageLine[];
  subtotalMinor: number;
  /** Descuento excepcional (acordado en una revisión). */
  discountMinor?: number;
  /** Packs aplicados por el servidor. */
  promotion?: { label: string; discountMinor: number } | null;
  deliveryPreference: DeliveryMode;
  /** Cupón de bienvenida validado; el descuento se aplica al coordinar. */
  coupon?: string | null;
};

const DELIVERY_TEXT: Record<DeliveryMode, string> = {
  pickup: "Recojo en tienda",
  shipping: "Envío",
  undecided: "Por definir",
};

/** S/ 1,250.00 — formato fijo (sin Intl) para que el texto no dependa del entorno. */
export function formatSoles(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new RangeError(`Importe inválido: ${minor}`);
  const soles = Math.floor(minor / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `S/ ${soles}.${String(minor % 100).padStart(2, "0")}`;
}

export const sizeText = (sizeCode: string) => (sizeCode === "UNICA" ? "Talla única" : `Talla ${sizeCode}`);

export function buildWhatsAppMessage(input: MessageInput): string {
  const units = input.lines.reduce((sum, l) => sum + l.quantity, 0);
  const discount = input.discountMinor ?? 0;
  const promotion = input.promotion && input.promotion.discountMinor > 0 ? input.promotion : null;
  const body = input.lines.map((l, i) =>
    [
      `${i + 1}. ${l.productTitle} — ${l.colorLabel} / ${sizeText(l.sizeCode)}`,
      `   SKU ${l.sku} · ${l.quantity} × ${formatSoles(l.unitPriceMinor)} = ${formatSoles(l.lineTotalMinor)}`,
    ].join("\n"),
  );
  const totals = [`Subtotal (${units} ${units === 1 ? "prenda" : "prendas"}): ${formatSoles(input.subtotalMinor)}`];
  if (promotion) totals.push(`Descuento ${promotion.label}: −${formatSoles(promotion.discountMinor)}`);
  if (discount > 0) totals.push(`Descuento: −${formatSoles(discount)}`);
  totals.push("Envío: por acordar", `Total provisional: ${formatSoles(input.subtotalMinor - (promotion?.discountMinor ?? 0) - discount)} + envío`);

  return [
    "Hola BLESH, quiero coordinar esta solicitud:",
    `Referencia: ${input.reference}`,
    "",
    ...body,
    "",
    ...totals,
    `Entrega preferida: ${DELIVERY_TEXT[input.deliveryPreference]}`,
    ...(input.coupon ? [`Cupón de bienvenida: ${input.coupon}`] : []),
    "",
    "Entiendo que esta solicitud aún no confirma la compra, el pago ni la reserva de las prendas.",
  ].join("\n");
}

/**
 * Longitud máxima del enlace con texto que consideramos segura. No hay un límite universal
 * documentado de WhatsApp: valor conservador, a verificar en móviles reales (SDD 5.1).
 */
/** El cupón se guarda en la nota de la revisión 1 (visible en el pedido) y se recupera en reintentos. */
const COUPON_NOTE = "Cupón de bienvenida: ";
export const couponNote = (code: string) => `${COUPON_NOTE}${code}`;
export function couponFromNote(note: string | null | undefined): string | null {
  return note?.startsWith(COUPON_NOTE) ? note.slice(COUPON_NOTE.length).trim() || null : null;
}

export const WHATSAPP_SAFE_URL_LENGTH = 2000;

export type WhatsAppLinks = {
  /** Enlace con el mensaje completo, o null si superaría el tamaño seguro. */
  withText: string | null;
  /** Abre el chat sin texto (para pegar el mensaje copiado). */
  chat: string;
};

/** Enlaces wa.me. Nunca recorta el mensaje: si no cabe, solo ofrece el chat vacío. */
export function buildWhatsAppLinks(phoneDigits: string, message: string, maxLength = WHATSAPP_SAFE_URL_LENGTH): WhatsAppLinks {
  if (!/^\d{8,15}$/.test(phoneDigits)) throw new Error("Número de WhatsApp inválido.");
  const chat = `https://wa.me/${phoneDigits}`;
  const withText = `${chat}?text=${encodeURIComponent(message)}`;
  return { withText: withText.length <= maxLength ? withText : null, chat };
}
