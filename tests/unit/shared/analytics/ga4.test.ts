import { afterEach, describe, expect, it, vi } from "vitest";

import { analyticsPage, createGa4Client, ga4Event } from "@/shared/analytics/ga4";
import { ANALYTICS_CONSENT_KEY, registerAnalyticsProvider, trackEvent } from "@/shared/analytics/track";

afterEach(() => { registerAnalyticsProvider(null); vi.unstubAllGlobals(); });

describe("GA4: minimización y consentimiento", () => {
  it("rechaza rutas privadas y elimina query/hash de URLs y referrer", () => {
    const origin = "https://blesh.example";
    for (const path of ["/admin", "/admin/login", "/solicitud", "/carrito", "https://evil.example/productos"]) expect(analyticsPage(path, origin)).toBeNull();
    const page = analyticsPage(`${origin}/productos/boxy/negro?phone=987654321#BL-ABC123`, origin, "https://google.com/search?q=Ana+987654321");
    expect(page).toEqual({ page_location: `${origin}/productos/boxy/negro`, page_title: "BLESH — Producto", page_referrer: "https://google.com" });
    expect(analyticsPage(`${origin}/productos?pagina=2&phone=987654321`, origin)?.page_location).toBe(`${origin}/productos?pagina=2`);
  });
  it("convierte dinero sin colar PII ni el mensaje de WhatsApp", () => {
    expect(ga4Event({ name: "add_to_cart", items: [{ itemId: "SKU-1", itemName: "Boxy", priceMinor: 4000, quantity: 2 }] })).toMatchObject({ params: { currency: "PEN", value: 80, items: [{ price: 40, quantity: 2 }] } });
    expect(ga4Event({ name: "whatsapp_click", placement: "cart", itemCount: 3 })).toEqual({ name: "whatsapp_click", params: { placement: "cart", item_count: 3 } });
  });
  it("sin permiso no configura ni envía; no duplica pageview por efectos repetidos", () => {
    let consent = "denied";
    const target = { location: { href: "https://blesh.example/productos?phone=987654321" }, localStorage: { getItem: (key: string) => key === ANALYTICS_CONSENT_KEY ? consent : null }, dataLayer: [] as unknown[] };
    vi.stubGlobal("window", target);
    const client = createGa4Client("G-TEST12345", "https://blesh.example", target as unknown as Window);
    const page = analyticsPage(target.location.href, "https://blesh.example")!;
    client.activate(page);
    trackEvent({ name: "whatsapp_click", placement: "cart" });
    expect(target.dataLayer).toEqual([]);
    consent = "granted";
    client.activate(page);
    client.pause(); // Simula cleanup de StrictMode.
    client.activate(page);
    const commands = () => target.dataLayer.map((c) => Array.from(c as IArguments));
    expect(commands().filter((c) => c[0] === "event" && c[1] === "page_view")).toHaveLength(1);
    trackEvent({ name: "order_request_created", valueMinor: 9900, itemCount: 3, phone: "987654321" } as never);
    expect(commands().at(-1)).toMatchObject(["event", "order_request_created", { value: 99, page_location: "https://blesh.example/productos" }]);
    expect(JSON.stringify(commands())).not.toContain("987654321");
    target.location.href = "https://blesh.example/productos/boxy/negro?token=private";
    client.activate(analyticsPage(target.location.href, "https://blesh.example")!);
    expect(commands().at(-1)).toMatchObject(["event", "page_view", { page_referrer: "https://blesh.example/productos", page_location: "https://blesh.example/productos/boxy/negro" }]);
    const before = target.dataLayer.length;
    target.location.href = "https://blesh.example/solicitud";
    trackEvent({ name: "whatsapp_click", placement: "request_success" });
    consent = "denied";
    client.pause();
    target.location.href = "https://blesh.example/productos";
    trackEvent({ name: "view_cart", items: [], valueMinor: 0 });
    expect(target.dataLayer).toHaveLength(before);
    expect(commands().some((c) => c[1] === "purchase")).toBe(false);
  });
});
