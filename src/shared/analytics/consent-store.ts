import { ANALYTICS_CONSENT_KEY, setRuntimeAnalyticsConsent } from "./track";

export type Consent = "granted" | "denied" | "unset";
const CHANGED = "blesh:analytics-consent";
let fallback: Consent | null = null;

export function getConsent(): Consent {
  if (fallback) return fallback;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : "unset";
  } catch { return "unset"; }
}

export function saveConsent(value: Exclude<Consent, "unset">): boolean {
  if (value === "denied") setRuntimeAnalyticsConsent(false);
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    fallback = null;
    setRuntimeAnalyticsConsent(value === "granted");
    window.dispatchEvent(new Event(CHANGED));
    return true;
  } catch {
    fallback = "denied";
    setRuntimeAnalyticsConsent(false);
    window.dispatchEvent(new Event(CHANGED));
    return false;
  }
}

export function subscribeConsent(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
    fallback = null;
    setRuntimeAnalyticsConsent(event.newValue === "granted");
    callback();
  };
  window.addEventListener(CHANGED, callback);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(CHANGED, callback); window.removeEventListener("storage", onStorage); };
}

export const serverConsent = (): Consent => "unset";
