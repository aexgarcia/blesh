import { describe, expect, it } from "vitest";

import { buildWhatsAppLinks, buildWhatsAppMessage, formatSoles, WHATSAPP_SAFE_URL_LENGTH, type MessageLine } from "@/modules/sales/domain/whatsapp-message";

const line = (over: Partial<MessageLine> = {}): MessageLine => ({
  productTitle: "Boxy Essential",
  colorLabel: "Negro",
  sizeCode: "M",
  sku: "BOXY-NEGRO-M",
  quantity: 2,
  unitPriceMinor: 4000,
  lineTotalMinor: 8000,
  ...over,
});

describe("mensaje de WhatsApp", () => {
  it("incluye referencia, cada línea completa, subtotal y envío por acordar", () => {
    const message = buildWhatsAppMessage({
      reference: "BL-ABC234",
      lines: [line(), line({ colorLabel: "Blanco", sizeCode: "UNICA", sku: "BOXY-BLANCO-U", quantity: 1, lineTotalMinor: 4000 })],
      subtotalMinor: 12000,
      deliveryPreference: "pickup",
    });
    expect(message).toBe(
      [
        "Hola BLESH, quiero coordinar esta solicitud:",
        "Referencia: BL-ABC234",
        "",
        "1. Boxy Essential — Negro / Talla M",
        "   SKU BOXY-NEGRO-M · 2 × S/ 40.00 = S/ 80.00",
        "2. Boxy Essential — Blanco / Talla única",
        "   SKU BOXY-BLANCO-U · 1 × S/ 40.00 = S/ 40.00",
        "",
        "Subtotal (3 prendas): S/ 120.00",
        "Envío: por acordar",
        "Total provisional: S/ 120.00 + envío",
        "Entrega preferida: Recojo en tienda",
        "",
        "Entiendo que esta solicitud aún no confirma la compra, el pago ni la reserva de las prendas.",
      ].join("\n"),
    );
  });

  it("es determinista y muestra el descuento si existe", () => {
    const input = { reference: "BL-ABC234", lines: [line()], subtotalMinor: 8000, discountMinor: 500, deliveryPreference: "undecided" as const };
    expect(buildWhatsAppMessage(input)).toBe(buildWhatsAppMessage(input));
    expect(buildWhatsAppMessage(input)).toContain("Descuento: −S/ 5.00");
    expect(buildWhatsAppMessage(input)).toContain("Total provisional: S/ 75.00 + envío");
    expect(buildWhatsAppMessage(input)).toContain("Entrega preferida: Por definir");
  });

  it("no incluye datos personales (no recibe nombre, teléfono ni dirección)", () => {
    const message = buildWhatsAppMessage({ reference: "BL-ABC234", lines: [line()], subtotalMinor: 8000, deliveryPreference: "shipping" });
    expect(message).not.toMatch(/\+51|\d{9}/);
    expect(message).toContain("Entrega preferida: Envío");
  });

  it("muestra el descuento del pack y el total con pack", () => {
    const message = buildWhatsAppMessage({
      reference: "BL-ABC234",
      lines: [line({ quantity: 3, lineTotalMinor: 12000 })],
      subtotalMinor: 12000,
      promotion: { label: "Pack Boxy Essential", discountMinor: 2100 },
      deliveryPreference: "pickup",
    });
    expect(message).toContain("Descuento Pack Boxy Essential: −S/ 21.00");
    expect(message).toContain("Total provisional: S/ 99.00 + envío");
  });

  it("formatea soles con miles y céntimos exactos", () => {
    expect(formatSoles(0)).toBe("S/ 0.00");
    expect(formatSoles(5)).toBe("S/ 0.05");
    expect(formatSoles(125_000)).toBe("S/ 1,250.00");
    expect(formatSoles(123_456_789)).toBe("S/ 1,234,567.89");
    expect(() => formatSoles(1.5)).toThrow();
  });

  it("50 líneas: nunca se recorta; si no cabe en el enlace solo se ofrece el chat", () => {
    const lines = Array.from({ length: 50 }, (_, i) => line({ sku: `SKU-${i}`, productTitle: `Prenda número ${i}` }));
    const message = buildWhatsAppMessage({ reference: "BL-ABC234", lines, subtotalMinor: 400_000, deliveryPreference: "undecided" });
    for (let i = 0; i < 50; i++) expect(message).toContain(`SKU SKU-${i} `);
    const links = buildWhatsAppLinks("51900000000", message);
    expect(links.withText).toBeNull();
    expect(links.chat).toBe("https://wa.me/51900000000");
  });

  it("un mensaje corto cabe en el enlace con el texto codificado completo", () => {
    const message = buildWhatsAppMessage({ reference: "BL-ABC234", lines: [line()], subtotalMinor: 8000, deliveryPreference: "pickup" });
    const links = buildWhatsAppLinks("51900000000", message);
    expect(links.withText).not.toBeNull();
    expect(links.withText!.length).toBeLessThanOrEqual(WHATSAPP_SAFE_URL_LENGTH);
    expect(decodeURIComponent(new URL(links.withText!).searchParams.get("text")!)).toBe(message);
  });

  it("rechaza números inválidos", () => {
    expect(() => buildWhatsAppLinks("+51 900", "x")).toThrow();
  });
});

describe("cupón de bienvenida en la solicitud", async () => {
  const { buildWhatsAppMessage, couponFromNote, couponNote } = await import("@/modules/sales/domain/whatsapp-message");
  it("viaja en el mensaje y se recupera de la nota guardada", () => {
    const base = { reference: "BL-TEST01", lines: [{ productTitle: "Boxy", colorLabel: "Negro", sizeCode: "M", sku: "BOXY-NEG-M", quantity: 1, unitPriceMinor: 4000, lineTotalMinor: 4000 }], subtotalMinor: 4000, deliveryPreference: "undecided" as const };
    expect(buildWhatsAppMessage({ ...base, coupon: "BIENVENIDA10" })).toContain("Cupón de bienvenida: BIENVENIDA10");
    expect(buildWhatsAppMessage(base)).not.toContain("Cupón");
    expect(couponFromNote(couponNote("BIENVENIDA10"))).toBe("BIENVENIDA10");
    expect(couponFromNote("Nota cualquiera")).toBeNull();
  });
});
