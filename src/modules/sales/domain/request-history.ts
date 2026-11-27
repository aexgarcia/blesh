/**
 * Recuperación local limitada de solicitudes registradas (contratos.md: sin URL pública por
 * referencia). Solo en este navegador: referencia, mensaje y enlaces; sin nombre ni teléfono.
 * Máximo 3 entradas y 7 días.
 */

export const REQUEST_HISTORY_KEY = "blesh.requests";
export const REQUEST_HISTORY_MAX = 3;
export const REQUEST_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredRequest = {
  reference: string;
  message: string;
  whatsappUrl: string | null;
  whatsappChatUrl: string;
  subtotalMinor: number;
  /** Subtotal − packs (opcional: entradas guardadas antes de los packs no lo tienen). */
  totalMinor?: number;
  units: number;
  /** ISO, hora del navegador. */
  savedAt: string;
  opened: boolean;
};

const REFERENCE_RE = /^BL-[0-9A-Z]{6}$/;
const WA_RE = /^https:\/\/wa\.me\/\d{8,15}(\?text=[^\s]*)?$/;

function isStoredRequest(value: unknown): value is StoredRequest {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.reference === "string" &&
    REFERENCE_RE.test(r.reference) &&
    typeof r.message === "string" &&
    r.message.length < 20_000 &&
    (r.whatsappUrl === null || (typeof r.whatsappUrl === "string" && WA_RE.test(r.whatsappUrl))) &&
    typeof r.whatsappChatUrl === "string" &&
    WA_RE.test(r.whatsappChatUrl) &&
    Number.isSafeInteger(r.subtotalMinor) &&
    (r.totalMinor === undefined || Number.isSafeInteger(r.totalMinor)) &&
    Number.isSafeInteger(r.units) &&
    typeof r.savedAt === "string" &&
    !Number.isNaN(Date.parse(r.savedAt)) &&
    typeof r.opened === "boolean"
  );
}

/** Lee el historial descartando entradas inválidas o vencidas; las más recientes primero. */
export function parseRequestHistory(raw: string | null | undefined, now: Date): StoredRequest[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .filter(isStoredRequest)
    .filter((r) => now.getTime() - Date.parse(r.savedAt) < REQUEST_HISTORY_TTL_MS)
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, REQUEST_HISTORY_MAX);
}

/** Añade o actualiza por referencia (un reintento no duplica la entrada). */
export function rememberRequest(history: readonly StoredRequest[], entry: StoredRequest): StoredRequest[] {
  const others = history.filter((r) => r.reference !== entry.reference);
  const previous = history.find((r) => r.reference === entry.reference);
  return [{ ...entry, opened: entry.opened || Boolean(previous?.opened) }, ...others].slice(0, REQUEST_HISTORY_MAX);
}

export function markOpened(history: readonly StoredRequest[], reference: string): StoredRequest[] {
  return history.map((r) => (r.reference === reference ? { ...r, opened: true } : r));
}
