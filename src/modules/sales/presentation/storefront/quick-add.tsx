"use client";

import { trackEvent } from "@/shared/analytics/track";

import { useCart } from "./cart-context";

export type QuickAddSize = { variantId: string; sku: string; sizeLabel: string; priceMinor: number; soldOut: boolean };

/**
 * Tallas sobre la foto de la tarjeta (prototipo `.card__quick`): aparecen al pasar el cursor
 * o con el foco del teclado; ocultas en móviles pequeños. Agrega 1 unidad y abre el carrito.
 */
export function QuickAdd({ title, colorLabel, sizes }: { title: string; colorLabel: string; sizes: QuickAddSize[] }) {
  const cart = useCart();
  return (
    <div className="absolute inset-x-2.5 bottom-2.5 z-[2] hidden translate-y-1.5 justify-center gap-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 sm:flex">
      {sizes.map((s) => (
        <button
          key={s.variantId}
          type="button"
          disabled={s.soldOut}
          onClick={() => {
            const result = cart.add({ variantId: s.variantId, quantity: 1, seenPriceMinor: s.priceMinor });
            if (result.added > 0) trackEvent({ name: "add_to_cart", items: [{ itemId: s.sku, itemName: title, itemVariant: colorLabel, priceMinor: s.priceMinor, quantity: result.added }] });
            cart.setOpen(true);
          }}
          aria-label={s.soldOut ? `Talla ${s.sizeLabel} agotada` : `Agregar ${title} ${colorLabel}, talla ${s.sizeLabel}`}
          className="h-8 min-w-[38px] rounded-full bg-white/90 px-2.5 text-[11px] font-extrabold text-ink backdrop-blur-lg transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:line-through disabled:opacity-40"
        >
          {s.sizeLabel}
        </button>
      ))}
    </div>
  );
}
