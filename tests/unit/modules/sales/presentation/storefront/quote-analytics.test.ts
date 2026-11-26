import { describe, expect, it } from "vitest";

import { ga4Event } from "@/shared/analytics/ga4";
import { sanitizeEvent } from "@/shared/analytics/events";

import type { CartQuote, CartQuoteLine } from "@/modules/sales/contracts";
import { quotedAnalyticsItems } from "@/modules/sales/presentation/storefront/quote-analytics";

const line = (sku: string, quantity: number, packEligible = true): CartQuoteLine => ({
  variantId: sku, quantity, packEligible, status: "ok", previousPriceMinor: null, maxQuantity: null,
  item: { sku, productTitle: "Boxy", colorLabel: "Negro", sizeCode: "M", unitPriceMinor: 4000,
    lineTotalMinor: 4000 * quantity, href: null, image: null },
});
const quote = (lines: CartQuoteLine[], promotionMinor: number): CartQuote => {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.item!.lineTotalMinor, 0);
  return { lines, promotionMinor, subtotalMinor, totalMinor: subtotalMinor - promotionMinor,
    promotionLabel: "Pack", pack: null, units: lines.reduce((sum, l) => sum + l.quantity, 0), ready: true };
};

describe("carrito cotizado en Analytics", () => {
  it("3 × S/40 informa S/99 y S/7 de descuento unitario, sin descontar dos veces", () => {
    const cart = quote([line("SKU-M", 3)], 2100);
    const items = quotedAnalyticsItems(cart);
    expect(items).toMatchObject([{ itemId: "SKU-M", priceMinor: 3300, discountMinor: 700, quantity: 3 }]);
    expect(ga4Event({ name: "view_cart", items, valueMinor: cart.totalMinor }).params)
      .toMatchObject({ value: 99, items: [{ price: 33, discount: 7, quantity: 3 }] });
  });
  it("conserva céntimos impares y no descuenta prendas ajenas al pack ni agotadas", () => {
    const cart = quote([line("SKU-M", 3), line("OTRO", 1, false)], 2101);
    cart.lines.push({ ...line("AGOTADO", 1), status: "sold_out" });
    const items = quotedAnalyticsItems(cart);
    expect(items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0)).toBe(cart.totalMinor);
    expect(items.find((i) => i.itemId === "OTRO")).toMatchObject({ priceMinor: 4000, discountMinor: 0 });
    expect(items.some((i) => i.itemId === "AGOTADO")).toBe(false);
  });
  it("no trunca el carrito máximo cuando el reparto divide una talla en dos importes", () => {
    const cart = quote(Array.from({ length: 50 }, (_, i) => line(`SKU-${i}`, 3)), 1);
    const event = sanitizeEvent({ name: "view_cart", items: quotedAnalyticsItems(cart), valueMinor: cart.totalMinor });
    expect(event.name).toBe("view_cart");
    if (event.name !== "view_cart") throw new Error("Evento inesperado");
    expect(event.items).toHaveLength(51);
    expect(event.items.reduce((sum, i) => sum + i.priceMinor * i.quantity, 0)).toBe(cart.totalMinor);
  });
});
