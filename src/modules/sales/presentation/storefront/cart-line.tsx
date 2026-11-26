"use client";

import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { formatPEN } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";

import { MAX_UNITS_PER_LINE, type CartQuoteLine } from "../../contracts";
import { sizeText } from "../../domain/whatsapp-message";

const STATUS_TEXT = {
  unavailable: "Ya no está disponible.",
  sold_out: "Agotado por ahora.",
} as const;

/** Línea del carrito: datos y precio cotizados por el servidor, con avisos y acciones. */
export function CartLineRow({ line, onQuantity, onRemove, onNavigate }: {
  line: CartQuoteLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onNavigate: () => void;
}) {
  const item = line.item;
  const title = item ? item.productTitle : "Producto no disponible";
  const blocked = line.status === "unavailable" || line.status === "sold_out";
  const max = Math.min(MAX_UNITS_PER_LINE, line.maxQuantity ?? MAX_UNITS_PER_LINE);
  const label = item ? `${item.productTitle} ${item.colorLabel}, ${sizeText(item.sizeCode)}` : "producto no disponible";

  return (
    <li className="grid grid-cols-[72px_1fr_auto] gap-3 border-b border-line py-4 last:border-b-0">
      <div className={cn("relative aspect-[4/5] overflow-hidden rounded-[10px] bg-card", blocked && "opacity-50")}>
        {item?.image ? <Image src={item.image.url} alt="" fill sizes="72px" className="object-cover" /> : null}
      </div>

      <div className="min-w-0">
        <p className="text-[11.5px] font-extrabold uppercase leading-tight">
          {item?.href ? (
            <Link href={item.href} onClick={onNavigate} className="hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {item ? (
          <p className="mt-0.5 text-[11.5px] text-muted">
            {item.colorLabel} · {sizeText(item.sizeCode)} · <span className="tabular-nums">SKU {item.sku}</span>
          </p>
        ) : null}

        {blocked ? (
          <p className="mt-2 text-[12px] font-semibold text-sale">{STATUS_TEXT[line.status as keyof typeof STATUS_TEXT]}</p>
        ) : (
          <div className="mt-2.5 inline-flex h-8 items-center rounded-full border border-line bg-surface" role="group" aria-label={`Cantidad de ${label}`}>
            <button
              type="button"
              className="grid h-full w-8 place-items-center text-muted hover:text-ink disabled:opacity-30"
              onClick={() => onQuantity(line.quantity - 1)}
              disabled={line.quantity <= 1}
              aria-label={`Quitar una unidad de ${label}`}
            >
              <Minus className="size-3.5" aria-hidden />
            </button>
            <span className="min-w-6 text-center text-[12px] font-bold tabular-nums" aria-live="polite">
              {line.quantity}
            </span>
            <button
              type="button"
              className="grid h-full w-8 place-items-center text-muted hover:text-ink disabled:opacity-30"
              onClick={() => onQuantity(line.quantity + 1)}
              disabled={line.quantity >= max}
              aria-label={`Agregar una unidad de ${label}`}
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
        )}

        {line.status === "insufficient" && line.maxQuantity !== null ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-warning">
            <span>Solo hay {line.maxQuantity} disponible{line.maxQuantity === 1 ? "" : "s"} por ahora.</span>
            <Button size="sm" variant="secondary" onClick={() => onQuantity(line.maxQuantity!)}>
              Ajustar a {line.maxQuantity}
            </Button>
          </div>
        ) : null}
        {line.previousPriceMinor !== null && item ? (
          <p className="mt-2 text-[12px] font-semibold text-warning">
            El precio cambió: antes {formatPEN(line.previousPriceMinor)}, ahora {formatPEN(item.unitPriceMinor)}.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end justify-between gap-2 text-right">
        <p className={cn("text-[12.5px] font-extrabold tabular-nums", blocked && "text-muted line-through")}>
          {item ? formatPEN(item.lineTotalMinor) : "—"}
        </p>
        <button type="button" onClick={onRemove} className="text-[11px] text-muted underline underline-offset-2 hover:text-ink">
          Quitar<span className="sr-only"> {label}</span>
        </button>
      </div>
    </li>
  );
}
