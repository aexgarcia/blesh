import type { AnalyticsItem } from "@/shared/analytics/events";

import type { CartQuote } from "../../contracts";

/** Reparte solo el descuento cotizado, en céntimos, sin volver a calcular el pack. */
export function quotedAnalyticsItems(quote: CartQuote): AnalyticsItem[] {
  const lines = quote.lines.filter((l) => l.item && (l.status === "ok" || l.status === "insufficient"));
  const eligibleSubtotal = lines.reduce((sum, l) => sum + (l.packEligible ? l.item!.lineTotalMinor : 0), 0);
  // Se reparte por unidad para conservar exactamente el total incluso con céntimos impares.
  const units = lines.flatMap((line) => Array.from({ length: line.quantity }, () => ({
    line,
    discount: line.packEligible && eligibleSubtotal > 0
      ? Math.floor(quote.promotionMinor * line.item!.unitPriceMinor / eligibleSubtotal)
      : 0,
  })));
  let remainder = quote.promotionMinor - units.reduce((sum, u) => sum + u.discount, 0);
  for (const unit of units) {
    if (remainder > 0 && unit.line.packEligible && unit.discount < unit.line.item!.unitPriceMinor) {
      unit.discount++;
      remainder--;
    }
  }
  const items = new Map<string, AnalyticsItem>();
  for (const { line, discount } of units) {
    const item = line.item!;
    const key = `${line.variantId}:${discount}`;
    const previous = items.get(key);
    if (previous) previous.quantity++;
    else items.set(key, {
      itemId: item.sku, itemName: item.productTitle, itemVariant: item.colorLabel,
      priceMinor: item.unitPriceMinor - discount, discountMinor: discount, quantity: 1,
    });
  }
  return [...items.values()];
}
