/**
 * Eventos públicos de analítica (docs/analitica-y-seo.md §2). Tipos sin SDK: la UI llama a
 * `trackEvent` y un proveedor (GA4, fase 7) los traduce. Solo campos controlados: nunca
 * nombre, teléfono, referencia de pedido, claves de idempotencia ni texto de WhatsApp.
 */

export type AnalyticsItem = {
  /** SKU con talla elegida; id de presentación producto/color si aún no hay talla. */
  itemId: string;
  itemName: string;
  itemVariant?: string;
  /** Céntimos: el adaptador los convierte a unidades (4000 → 40.00). */
  priceMinor: number;
  /** Descuento unitario ya incluido en priceMinor; no restarlo otra vez. */
  discountMinor?: number;
  quantity: number;
};

export type AnalyticsEvent =
  | { name: "view_item_list"; items: AnalyticsItem[]; listId: string }
  | { name: "select_item"; items: AnalyticsItem[]; listId: string }
  | { name: "view_item"; items: AnalyticsItem[] }
  | { name: "add_to_cart"; items: AnalyticsItem[] }
  | { name: "remove_from_cart"; items: AnalyticsItem[] }
  | { name: "view_cart"; items: AnalyticsItem[]; valueMinor: number }
  | { name: "order_request_created"; valueMinor: number; itemCount: number }
  | { name: "whatsapp_click"; placement: "cart" | "request_success" | "contact"; itemCount?: number };

/** Copia solo los campos permitidos (defensa ante objetos con datos de más). */
export function sanitizeEvent(event: AnalyticsEvent): AnalyticsEvent {
  const minor = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000 ? n : 0;
  const count = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 500 ? n : 0;
  const items = (list: AnalyticsItem[]) =>
    // Hasta 50 tallas; un reparto de céntimos puede generar dos importes por talla.
    list.slice(0, 100).map((i) => ({
      itemId: String(i.itemId).slice(0, 100),
      itemName: String(i.itemName).slice(0, 100),
      ...(i.itemVariant ? { itemVariant: String(i.itemVariant).slice(0, 100) } : {}),
      priceMinor: minor(i.priceMinor),
      ...(i.discountMinor !== undefined ? { discountMinor: minor(i.discountMinor) } : {}),
      quantity: count(i.quantity),
    }));
  switch (event.name) {
    case "view_item_list":
    case "select_item":
      return { name: event.name, items: items(event.items), listId: String(event.listId).slice(0, 80) };
    case "view_item":
    case "add_to_cart":
    case "remove_from_cart":
      return { name: event.name, items: items(event.items) };
    case "view_cart":
      return { name: event.name, items: items(event.items), valueMinor: minor(event.valueMinor) };
    case "order_request_created":
      return { name: event.name, valueMinor: minor(event.valueMinor), itemCount: count(event.itemCount) };
    case "whatsapp_click":
      return { name: event.name, placement: event.placement, ...(event.itemCount !== undefined ? { itemCount: event.itemCount } : {}) };
  }
}
