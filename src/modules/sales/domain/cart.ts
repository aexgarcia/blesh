/**
 * Carrito anónimo del navegador (ADR-006): solo ids de variante y cantidades.
 * `seenPriceMinor` es dato de visualización descartable: el precio que la persona vio,
 * usado para avisar si el servidor cotiza otro. Nunca es autoridad de precio.
 */
import { MAX_ORDER_LINES, MAX_UNITS_PER_LINE } from "../contracts";

export const CART_STORAGE_KEY = "blesh.cart";
export const CART_STORAGE_VERSION = 1;

export type CartLine = { variantId: string; quantity: number; seenPriceMinor?: number };
export type CartState = {
  lines: CartLine[];
  /** Clave de idempotencia de la solicitud en curso; se conserva para reintentos. */
  requestKey?: string;
};

export const EMPTY_CART: CartState = { lines: [] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

const validQuantity = (q: unknown): q is number => typeof q === "number" && Number.isSafeInteger(q) && q > 0;
const validPrice = (p: unknown): p is number => typeof p === "number" && Number.isSafeInteger(p) && p > 0;

/**
 * Lee el carrito guardado de forma tolerante: JSON inválido, versión desconocida o entradas
 * manipuladas no rompen la tienda. Se descartan ids no válidos, se unen repetidos y se
 * respetan los límites (el servidor los vuelve a aplicar).
 */
export function parseStoredCart(raw: string | null | undefined): CartState {
  if (!raw) return EMPTY_CART;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_CART;
  }
  if (!data || typeof data !== "object") return EMPTY_CART;
  const record = data as { v?: unknown; lines?: unknown; requestKey?: unknown };
  if (record.v !== CART_STORAGE_VERSION || !Array.isArray(record.lines)) return EMPTY_CART;

  let state: CartState = { lines: [] };
  for (const entry of record.lines.slice(0, MAX_ORDER_LINES * 2)) {
    if (!entry || typeof entry !== "object") continue;
    const { variantId, quantity, seenPriceMinor } = entry as Record<string, unknown>;
    if (!isUuid(variantId) || !validQuantity(quantity)) continue;
    state = addToCart(state, { variantId: variantId.toLowerCase(), quantity, seenPriceMinor: validPrice(seenPriceMinor) ? seenPriceMinor : undefined }).state;
  }
  if (isUuid(record.requestKey)) state.requestKey = record.requestKey;
  return state;
}

export function serializeCart(state: CartState): string {
  return JSON.stringify({ v: CART_STORAGE_VERSION, lines: state.lines, ...(state.requestKey ? { requestKey: state.requestKey } : {}) });
}

export type AddResult = {
  state: CartState;
  /** Unidades realmente agregadas (puede ser menos de lo pedido por el límite). */
  added: number;
  limit: "units" | "lines" | null;
};

/** Agrega unidades respetando 10 por talla y 50 tallas distintas; informa si se limitó. */
export function addToCart(state: CartState, line: CartLine): AddResult {
  if (!validQuantity(line.quantity)) return { state, added: 0, limit: null };
  const index = state.lines.findIndex((l) => l.variantId === line.variantId);
  if (index === -1) {
    if (state.lines.length >= MAX_ORDER_LINES) return { state, added: 0, limit: "lines" };
    const quantity = Math.min(line.quantity, MAX_UNITS_PER_LINE);
    const next: CartLine = { variantId: line.variantId, quantity, ...(line.seenPriceMinor ? { seenPriceMinor: line.seenPriceMinor } : {}) };
    return { state: { ...state, lines: [...state.lines, next] }, added: quantity, limit: quantity < line.quantity ? "units" : null };
  }
  const current = state.lines[index];
  const quantity = Math.min(current.quantity + line.quantity, MAX_UNITS_PER_LINE);
  const added = quantity - current.quantity;
  const lines = state.lines.map((l, i) => (i === index ? { ...l, quantity, seenPriceMinor: line.seenPriceMinor ?? l.seenPriceMinor } : l));
  return { state: { ...state, lines }, added, limit: added < line.quantity ? "units" : null };
}

/** Fija la cantidad (1–10). Cero o menos elimina la línea. */
export function setQuantity(state: CartState, variantId: string, quantity: number): CartState {
  if (!Number.isSafeInteger(quantity)) return state;
  if (quantity <= 0) return removeLine(state, variantId);
  const capped = Math.min(quantity, MAX_UNITS_PER_LINE);
  return { ...state, lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: capped } : l)) };
}

export function removeLine(state: CartState, variantId: string): CartState {
  return { ...state, lines: state.lines.filter((l) => l.variantId !== variantId) };
}

/** Marca como vistos (aceptados) los precios que cotizó el servidor. */
export function acceptPrices(state: CartState, prices: ReadonlyMap<string, number>): CartState {
  return { ...state, lines: state.lines.map((l) => (prices.has(l.variantId) ? { ...l, seenPriceMinor: prices.get(l.variantId) } : l)) };
}

export function cartUnits(state: CartState): number {
  return state.lines.reduce((sum, l) => sum + l.quantity, 0);
}
