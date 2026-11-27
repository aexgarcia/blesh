import { describe, expect, it } from "vitest";

import { sanitizeEvent, type AnalyticsEvent } from "@/shared/analytics/events";

describe("eventos de analítica", () => {
  it("solo conserva campos permitidos (sin datos personales colados)", () => {
    const dirty = {
      name: "order_request_created",
      valueMinor: 8000,
      itemCount: 2,
      reference: "BL-ABC234",
      phone: "+51987654321",
    } as unknown as AnalyticsEvent;
    expect(sanitizeEvent(dirty)).toEqual({ name: "order_request_created", valueMinor: 8000, itemCount: 2 });

    const item = { itemId: "SKU-1", itemName: "Boxy", priceMinor: 4000, quantity: 1, customerName: "Ana" } as never;
    expect(sanitizeEvent({ name: "add_to_cart", items: [item] })).toEqual({
      name: "add_to_cart",
      items: [{ itemId: "SKU-1", itemName: "Boxy", priceMinor: 4000, quantity: 1 }],
    });
    expect(sanitizeEvent({ name: "whatsapp_click", placement: "request_success" })).toEqual({ name: "whatsapp_click", placement: "request_success" });
  });
});
