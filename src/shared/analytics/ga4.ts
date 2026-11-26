import type { AnalyticsEvent } from "./events";
import { hasAnalyticsConsent, registerAnalyticsProvider } from "./track";

export type AnalyticsPage = { page_location: string; page_title: string; page_referrer: string };
export type Gtag = (...args: unknown[]) => void;

/** Lista cerrada: sin teléfono, nombre, referencia, query arbitraria ni texto de WhatsApp. */
export function analyticsPage(href: string, origin: string, referrer = ""): AnalyticsPage | null {
  try {
    const url = new URL(href, origin);
    if (url.origin !== origin || !/^\/(?:productos(?:\/[a-z0-9-]+\/[a-z0-9-]+)?|categorias\/[a-z0-9-]+)?\/?$/.test(url.pathname)) return null;
    const n = Number(url.searchParams.get("pagina"));
    const paginated = /^\/(productos|categorias\/[a-z0-9-]+)$/.test(url.pathname) && Number.isSafeInteger(n) && n > 1 && n < 10_000;
    const location = `${origin}${url.pathname}${paginated ? `?pagina=${n}` : ""}`;
    let safeReferrer = "";
    if (referrer) {
      const ref = new URL(referrer);
      // El referrer ajeno conserva solo origen; el propio solo rutas conocidas.
      safeReferrer = ref.origin === origin ? analyticsPage(ref.href, origin)?.page_location ?? `${origin}/` : /^https?:$/.test(ref.protocol) ? ref.origin : "";
    }
    return { page_location: location, page_title: url.pathname === "/" ? "BLESH — Inicio" : url.pathname.startsWith("/categorias/") ? "BLESH — Categoría" : url.pathname === "/productos" ? "BLESH — Productos" : "BLESH — Producto", page_referrer: safeReferrer };
  } catch { return null; }
}

export function ga4Event(event: AnalyticsEvent): { name: string; params: Record<string, unknown> } {
  if (event.name === "whatsapp_click") return { name: event.name, params: { placement: event.placement, ...(event.itemCount !== undefined ? { item_count: event.itemCount } : {}) } };
  if (event.name === "order_request_created") return { name: event.name, params: { currency: "PEN", value: event.valueMinor / 100, item_count: event.itemCount } };
  const items = event.items.map((i) => ({ item_id: i.itemId, item_name: i.itemName, ...(i.itemVariant ? { item_variant: i.itemVariant } : {}), price: i.priceMinor / 100, ...(i.discountMinor !== undefined ? { discount: i.discountMinor / 100 } : {}), quantity: i.quantity }));
  return { name: event.name, params: { currency: "PEN", items, value: (event.name === "view_cart" ? event.valueMinor : event.items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0)) / 100, ...("listId" in event ? { item_list_id: event.listId } : {}) } };
}

type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

/** Adaptador técnico de navegador, sin módulos de negocio ni credenciales. */
export function createGa4Client(measurementId: string, origin: string, target: AnalyticsWindow = window) {
  let configured = false;
  let lastPage: string | null = null;
  let lastDescriptor: AnalyticsPage | null = null;
  let page: AnalyticsPage | null = null;
  const disableKey = `ga-disable-${measurementId}`;
  const flags = target as unknown as Record<string, unknown>;
  flags[disableKey] = true;
  const allowed = () => hasAnalyticsConsent() && analyticsPage(target.location.href, origin) !== null;
  const gtag: Gtag = function () {
    // Puente estándar gtag: dataLayer consume comandos como IArguments, no eventos libres.
    // eslint-disable-next-line prefer-rest-params -- Formato oficial del puente gtag/dataLayer.
    (target.dataLayer ??= []).push(arguments);
  };

  function pause() {
    flags[disableKey] = true;
    registerAnalyticsProvider(null);
    page = null;
  }

  function activate(next: AnalyticsPage) {
    if (!allowed()) { pause(); return; }
    page = lastPage === next.page_location && lastDescriptor
      ? lastDescriptor
      : { ...next, page_referrer: lastPage ?? next.page_referrer };
    lastDescriptor = page;
    flags[disableKey] = false;
    target.gtag = gtag;
    if (!configured) {
      gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      gtag("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      gtag("js", new Date());
      gtag("config", measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_domain: "none", ignore_referrer: true, ...page });
      configured = true;
    }
    gtag("set", page);
    registerAnalyticsProvider({ send(event) {
      if (!page || !allowed() || flags[disableKey]) return;
      const mapped = ga4Event(event);
      gtag("event", mapped.name, { ...mapped.params, ...page, send_to: measurementId });
    } });
    if (lastPage !== next.page_location) {
      gtag("event", "page_view", { ...page, send_to: measurementId });
      lastPage = next.page_location;
    }
  }
  return { activate, pause, isConfigured: () => configured };
}

/** Cookies propias GA; no tocar carrito, solicitudes ni sesión administrativa. */
export function clearAnalyticsCookies(doc: Pick<Document, "cookie"> = document) {
  for (const pair of doc.cookie.split(";")) {
    const name = pair.trim().split("=")[0];
    if (/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name)) doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
