"use client";

import { useState } from "react";

import type { StoreCard } from "@/composition/storefront";
import { ProductCard } from "@/modules/catalog/presentation/storefront/product-card";
import { QuickAdd } from "@/modules/sales/presentation/storefront/quick-add";
import { cn } from "@/shared/ui/cn";

/**
 * «Todas las prendas» del prototipo: pestañas por categoría con contador que filtran en el
 * sitio (las categorías también tienen su propia URL rastreable en /categorias/…).
 */
export function AllProducts({ cards, categories, eyebrow, title }: { cards: StoreCard[]; categories: { slug: string; name: string }[]; eyebrow: string; title: string }) {
  const [filter, setFilter] = useState<string>("all");
  const tabs = [{ slug: "all", name: "Todo", count: cards.length }, ...categories.map((c) => ({ ...c, count: cards.filter((card) => card.categorySlug === c.slug).length }))].filter(
    (t) => t.count > 0,
  );
  const list = filter === "all" ? cards : cards.filter((c) => c.categorySlug === filter);

  return (
    <section id="productos" className="scroll-mt-[calc(var(--chrome-h,96px)+12px)] py-12 md:py-16" aria-labelledby="todas-title">
      <div className="mx-auto max-w-site px-4 md:px-5">
        <div className="section-head">
          <div>
            <p className="eyebrow mb-2">{eyebrow}</p>
            <h2 id="todas-title" className="h-section">
              {title}
            </h2>
          </div>
          <span className="eyebrow" aria-live="polite">
            {list.length} {list.length === 1 ? "prenda" : "prendas"}
          </span>
        </div>
        <div className="mb-[22px] flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
          {tabs.map((t) => (
            <button
              key={t.slug}
              type="button"
              aria-pressed={filter === t.slug}
              onClick={() => setFilter(t.slug)}
              className={cn(
                "h-[34px] rounded-full border border-line bg-surface px-4 text-[10.5px] font-extrabold uppercase tracking-[0.04em] transition-colors hover:border-ink",
                filter === t.slug && "border-ink bg-ink text-white",
              )}
            >
              {t.name}
              <sup className="ml-[3px] text-[8.5px] opacity-60">{t.count}</sup>
            </button>
          ))}
        </div>
        <ul key={filter} className="grid grid-cols-2 gap-x-2.5 gap-y-[22px] sm:grid-cols-3 sm:gap-x-3 sm:gap-y-7 lg:grid-cols-4">
          {list.map((card) => (
            <li key={card.key} className="animate-[fadeUp_.4s_ease_both]">
              <ProductCard card={card} quickAdd={<QuickAdd title={card.title} colorLabel={card.colorLabel} sizes={card.sizes} />} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
