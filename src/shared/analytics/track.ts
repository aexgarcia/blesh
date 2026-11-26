import { sanitizeEvent, type AnalyticsEvent } from "./events";

/**
 * Fachada de analítica del navegador. En la fase 6 no hay proveedor registrado ni cuenta GA4:
 * `trackEvent` no envía nada. El adaptador GA4 (fase 7) se registra con
 * `registerAnalyticsProvider` solo tras consentimiento explícito. Un fallo o bloqueo del
 * proveedor nunca interrumpe la compra.
 */

export type AnalyticsProvider = { send: (event: AnalyticsEvent) => void };

export const ANALYTICS_CONSENT_KEY = "blesh.analytics-consent";

let provider: AnalyticsProvider | null = null;
let consentOverride: boolean | null = null;

/** Fallo al guardar una revocación: nunca volver a habilitar por un valor viejo del disco. */
export function setRuntimeAnalyticsConsent(granted: boolean) {
  consentOverride = granted;
}

export function registerAnalyticsProvider(next: AnalyticsProvider | null) {
  provider = next;
}

/** Denegado por defecto: solo "granted" guardado explícitamente habilita el envío. */
export function hasAnalyticsConsent(): boolean {
  try {
    return consentOverride !== false && typeof window !== "undefined" && window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function trackEvent(event: AnalyticsEvent): void {
  if (!provider || !hasAnalyticsConsent()) return;
  try {
    provider.send(sanitizeEvent(event));
  } catch {
    // Analítica bloqueada o caída: se ignora.
  }
}
