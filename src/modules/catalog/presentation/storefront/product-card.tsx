import Image from "next/image";

import { formatPEN } from "@/shared/domain/money";
import { cn } from "@/shared/ui/cn";
import { AnalyticsLink } from "@/shared/analytics/impression";

type CardImage = { url: string; width: number; height: number; alt: string };

export type ProductCardData = {
  href: string;
  title: string;
  colorLabel: string;
  image: CardImage | null;
  hoverImage?: CardImage | null;
  minPriceMinor: number;
  maxPriceMinor: number;
  compareAtMinor: number | null;
  soldOut: boolean;
  badge?: string | null;
};

export const offPercent = (price: number, compareAt: number | null) => (compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : null);

/** Precio de tarjeta (prototipo `.price`): antes tachado + precio; rango solo entre tallas del color. */
export function CardPrice({ min, max, compareAt, className }: { min: number; max: number; compareAt: number | null; className?: string }) {
  return (
    <p className={cn("mt-0.5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-[13px] font-bold tabular-nums max-sm:text-[12px]", className)}>
      {compareAt && compareAt > max ? <s className="text-[12px] font-medium text-muted">{formatPEN(compareAt)}</s> : null}
      <span>{min === max ? formatPEN(min) : `Desde ${formatPEN(min)}`}</span>
    </p>
  );
}

/**
 * Tarjeta pública por color (prototipo `.card`): etiquetas, segunda foto al pasar el cursor,
 * número de ranking opcional y un espacio para «agregar rápido» (lo aporta ventas).
 */
export function ProductCard({ card, rank, quickAdd, priority = false, sizes = "(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw", dark = false }: {
  card: ProductCardData;
  rank?: number;
  quickAdd?: React.ReactNode;
  priority?: boolean;
  sizes?: string;
  dark?: boolean;
}) {
  const off = offPercent(card.maxPriceMinor, card.compareAtMinor);
  return (
    <article className="group flex flex-col gap-2.5">
      <div className={cn("relative aspect-[4/5] overflow-hidden rounded-card", dark ? "bg-[#2a2a2a]" : "bg-card")}>
        <AnalyticsLink href={card.href} event={{ name: "select_item", listId: "catalog", items: [{ itemId: card.href, itemName: card.title, itemVariant: card.colorLabel, priceMinor: card.minPriceMinor, quantity: 1 }] }} className="absolute inset-0" aria-label={`${card.title} ${card.colorLabel}`}>
          {card.image ? (
            <Image
              src={card.image.url}
              alt={card.image.alt}
              fill
              sizes={sizes}
              preload={priority}
              className={cn(
                "object-cover transition-[opacity,transform] duration-500",
                card.hoverImage ? "group-hover:opacity-0" : "group-hover:scale-[1.03]",
              )}
            />
          ) : (
            <span aria-hidden className="grid size-full place-items-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
              BLESH
            </span>
          )}
          {card.hoverImage ? (
            <Image src={card.hoverImage.url} alt="" aria-hidden fill sizes={sizes} className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          ) : null}
        </AnalyticsLink>
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-[2] flex flex-wrap gap-1">
          {card.badge ? <span className="tag">{card.badge}</span> : null}
          {off && !card.soldOut ? <span className="tag tag-sale">-{off}%</span> : null}
        </div>
        {rank ? (
          <span className="absolute right-2.5 top-2.5 z-[2] grid size-[22px] place-items-center rounded-full bg-[rgba(22,22,22,0.7)] text-[10px] font-extrabold text-white">
            {rank}
          </span>
        ) : null}
        {card.soldOut ? (
          <span className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-[2] grid h-8 place-items-center rounded-full bg-white/90 text-[10px] font-extrabold uppercase tracking-[0.06em] text-ink">
            Agotado
          </span>
        ) : (
          quickAdd
        )}
      </div>
      <AnalyticsLink href={card.href} event={{ name: "select_item", listId: "catalog", items: [{ itemId: card.href, itemName: card.title, itemVariant: card.colorLabel, priceMinor: card.minPriceMinor, quantity: 1 }] }} className="px-1.5 text-center">
        <h3 className="text-[11.5px] font-extrabold uppercase tracking-[0.02em] max-sm:text-[10.5px]">
          {card.title}
          <small className={cn("ml-1 text-[11px] font-medium normal-case", dark ? "text-white/55" : "text-muted")}>{card.colorLabel}</small>
        </h3>
        <CardPrice min={card.minPriceMinor} max={card.maxPriceMinor} compareAt={card.compareAtMinor} />
      </AnalyticsLink>
    </article>
  );
}

/** Rejilla del catálogo (4/3/2 columnas como el prototipo). */
export function ProductGrid({ cards, priorityCount = 0, quickAdd }: {
  cards: (ProductCardData & { key: string })[];
  priorityCount?: number;
  quickAdd?: (card: ProductCardData & { key: string }) => React.ReactNode;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-2.5 gap-y-[22px] sm:grid-cols-3 sm:gap-x-3 sm:gap-y-7 lg:grid-cols-4">
      {cards.map((card, i) => (
        <li key={card.key} className="animate-[fadeUp_.4s_ease_both]">
          <ProductCard card={card} priority={i < priorityCount} quickAdd={quickAdd?.(card)} />
        </li>
      ))}
    </ul>
  );
}
