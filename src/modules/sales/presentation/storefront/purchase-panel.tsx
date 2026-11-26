"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { trackEvent } from "@/shared/analytics/track";
import { SIZE_SELECTION_EVENT, type SizeSelection } from "@/modules/catalog/contracts";
import { formatPEN } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";

import { MAX_UNITS_PER_LINE } from "../../contracts";
import { useCart } from "./cart-context";

export type PurchaseSize = {
  variantId: string;
  sku: string;
  sizeLabel: string;
  priceMinor: number;
  compareAtMinor: number | null;
  soldOut: boolean;
};

/**
 * Selección de talla y cantidad de una ficha por color. Las tallas son radios nativos
 * (flechas del teclado, lector de pantalla); las agotadas quedan deshabilitadas y anunciadas.
 * La disponibilidad es orientativa: el carrito vuelve a cotizar en el servidor.
 */
export function PurchasePanel({ productTitle, productSlug, colorLabel, sizes, sizeGuide, afterPrice, afterBuy }: {
  productTitle: string;
  productSlug?: string;
  colorLabel: string;
  sizes: PurchaseSize[];
  /** Botón/enlace de guía de tallas (lo aporta la ficha). */
  sizeGuide?: React.ReactNode;
  /** Subtítulo, aviso de entrega y colores (orden del prototipo: entre precio y talla). */
  afterPrice?: React.ReactNode;
  /** Chips, nota de pack, etc. */
  afterBuy?: React.ReactNode;
}) {
  const cart = useCart();
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(() => (sizes.filter((s) => !s.soldOut).length === 1 ? sizes.find((s) => !s.soldOut)!.variantId : null));
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const groupRef = useRef<HTMLFieldSetElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const onSize = (event: Event) => {
      const detail = (event as CustomEvent<SizeSelection>).detail;
      if (!detail || detail.productSlug !== productSlug || typeof detail.sizeCode !== "string") return;
      const size = sizes.find((s) => s.sizeLabel === detail.sizeCode || (detail.sizeCode === "UNICA" && s.sizeLabel === "Única"));
      if (!size || size.soldOut) { setMessage({ tone: "error", text: "La talla sugerida no está disponible en este color." }); return; }
      setSelected(size.variantId);
      setMessage({ tone: "info", text: `Talla ${size.sizeLabel} seleccionada. Revisa el ajuste antes de añadir la prenda.` });
    };
    window.addEventListener(SIZE_SELECTION_EVENT, onSize);
    return () => window.removeEventListener(SIZE_SELECTION_EVENT, onSize);
  }, [productSlug, sizes]);

  const size = sizes.find((s) => s.variantId === selected) ?? null;
  const allSoldOut = sizes.every((s) => s.soldOut);
  const prices = sizes.map((s) => s.priceMinor);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const shownPrice = size?.priceMinor ?? minPrice;
  const compareAt = size ? size.compareAtMinor : (sizes.find((s) => s.compareAtMinor)?.compareAtMinor ?? null);
  const off = compareAt && compareAt > shownPrice ? Math.round((1 - shownPrice / compareAt) * 100) : null;

  useEffect(() => {
    const target = buyRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function add() {
    if (!size) {
      setMessage({ tone: "error", text: "Elige una talla." });
      groupRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus();
      groupRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const result = cart.add({ variantId: size.variantId, quantity, seenPriceMinor: size.priceMinor });
    if (result.added === 0) {
      setMessage({
        tone: "error",
        text: result.limit === "lines" ? "Tu carrito llegó al máximo de productos distintos." : `Ya tienes el máximo de ${MAX_UNITS_PER_LINE} unidades de esta talla.`,
      });
      return;
    }
    trackEvent({ name: "add_to_cart", items: [{ itemId: size.sku, itemName: productTitle, itemVariant: colorLabel, priceMinor: size.priceMinor, quantity: result.added }] });
    setMessage({
      tone: "info",
      text: result.limit === "units" ? `Agregamos ${result.added} (máximo ${MAX_UNITS_PER_LINE} por talla).` : `Agregado al carrito: ${productTitle} ${colorLabel}, talla ${size.sizeLabel}.`,
    });
    setQuantity(1);
    cart.setOpen(true);
  }

  const buttonText = allSoldOut ? "Agotado" : size ? `Agregar al carrito · ${formatPEN(size.priceMinor * quantity)}` : "Agregar al carrito";

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <strong className="text-[24px] font-black tracking-[-0.02em] tabular-nums">
          {!size && minPrice !== maxPrice ? `Desde ${formatPEN(minPrice)}` : formatPEN(shownPrice)}
        </strong>
        {off ? (
          <>
            <s className="text-[15px] text-muted tabular-nums">{formatPEN(compareAt!)}</s>
            <span className="tag tag-sale">-{off}%</span>
          </>
        ) : null}
      </div>
      {afterPrice}

      <fieldset ref={groupRef} aria-describedby={message?.tone === "error" ? `${groupId}-msg` : undefined} className="grid grid-cols-[64px_1fr] items-center gap-3">
        <legend className="sr-only">Talla</legend>
        <span aria-hidden className="text-[10.5px] font-extrabold uppercase tracking-[0.05em]">
          Talla
        </span>
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => (
            <label
              key={s.variantId}
              className={cn(
                "relative grid h-10 min-w-[46px] cursor-pointer place-items-center rounded-full border border-line bg-surface px-3.5 text-[12px] font-extrabold transition-colors hover:border-ink",
                "has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ink/30 has-focus-visible:ring-offset-2",
                s.soldOut && "cursor-not-allowed bg-transparent text-[#b9b6b7] line-through hover:border-line",
              )}
            >
              <input
                type="radio"
                name={`size-${groupId}`}
                value={s.variantId}
                checked={selected === s.variantId}
                disabled={s.soldOut}
                onChange={() => {
                  setSelected(s.variantId);
                  setMessage(null);
                }}
                className="sr-only"
              />
              {s.sizeLabel}
              {s.soldOut ? <span className="sr-only"> (agotada)</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      {sizeGuide}

      <div ref={buyRef} className="grid grid-cols-[auto_1fr] gap-2">
        <div className="inline-flex h-[46px] items-center rounded-full border border-line bg-surface" role="group" aria-label="Cantidad">
          <button
            type="button"
            className="grid h-full w-[38px] place-items-center text-muted hover:text-ink disabled:opacity-30"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || allSoldOut}
            aria-label="Restar una unidad"
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span className="min-w-6 text-center text-[13px] font-bold tabular-nums" aria-live="polite" aria-label={`${quantity} unidades`}>
            {quantity}
          </span>
          <button
            type="button"
            className="grid h-full w-[38px] place-items-center text-muted hover:text-ink disabled:opacity-30"
            onClick={() => setQuantity((q) => Math.min(MAX_UNITS_PER_LINE, q + 1))}
            disabled={quantity >= MAX_UNITS_PER_LINE || allSoldOut}
            aria-label="Sumar una unidad"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
        <Button size="lg" onClick={add} disabled={allSoldOut}>
          {buttonText}
        </Button>
      </div>
      {afterBuy}
      <p id={`${groupId}-msg`} role="status" className={cn("-mt-2 min-h-[18px] text-[12px] font-semibold", message?.tone === "error" ? "text-sale" : "text-success")}>
        {message?.text}
      </p>

      {/* Barra fija en móvil cuando el botón principal sale de la vista. */}
      <div
        aria-hidden={!showSticky}
        className={cn(
          "fixed inset-x-2.5 bottom-2.5 z-40 flex items-center gap-2.5 rounded-full bg-bg/85 py-2 pl-4 pr-2 shadow-[0_10px_30px_rgba(0,0,0,0.15)] backdrop-blur-lg transition-transform duration-300 lg:hidden",
          showSticky ? "translate-y-0" : "pointer-events-none translate-y-[150%]",
        )}
      >
        <p className="min-w-0 flex-1 truncate text-[11px] font-extrabold uppercase">
          {productTitle} · {formatPEN(shownPrice)}
        </p>
        <Button size="md" onClick={add} disabled={allSoldOut} tabIndex={showSticky ? 0 : -1}>
          {allSoldOut ? "Agotado" : size ? "Agregar" : "Elegir talla"}
        </Button>
      </div>
    </div>
  );
}
