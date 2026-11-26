"use client";

import { ShoppingBag } from "lucide-react";

import { cn } from "@/shared/ui/cn";

import { useCart } from "./cart-context";

/** Botón del encabezado con el número de prendas (anunciado en su etiqueta). */
export function CartButton({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const { units, setOpen, hydrated } = useCart();
  const label = hydrated && units > 0 ? `Abrir carrito, ${units} ${units === 1 ? "prenda" : "prendas"}` : "Abrir carrito";
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      className={cn("relative grid size-10 place-items-center rounded-full transition-colors hover:bg-[rgba(127,127,127,0.18)]", className)}
    >
      <ShoppingBag className="size-5" aria-hidden />
      {hydrated && units > 0 ? (
        <span aria-hidden className={cn("absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9.5px] font-extrabold tabular-nums", inverted ? "bg-white text-ink" : "bg-ink text-white")}>
          {units}
        </span>
      ) : null}
    </button>
  );
}
