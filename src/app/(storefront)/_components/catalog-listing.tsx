import Link from "next/link";

import { getStoreCards, getStoreCategories } from "@/composition/storefront";
import type { StoreCard } from "@/composition/storefront";
import { ProductGrid } from "@/modules/catalog/presentation/storefront/product-card";
import { QuickAdd } from "@/modules/sales/presentation/storefront/quick-add";
import { cn } from "@/shared/ui/cn";
import { Skeleton } from "@/shared/ui/skeleton";
import { AnalyticsImpression } from "@/shared/analytics/impression";

/** Pestañas de categoría como enlaces rastreables (no filtros combinatorios). */
export async function CategoryTabs({ current }: { current?: string }) {
  const categories = await getStoreCategories();
  const tabs = [{ href: "/productos", label: "Todo", active: !current }, ...categories.map((c) => ({ href: `/categorias/${c.slug}`, label: c.name, active: c.slug === current }))];
  return (
    <nav aria-label="Categorías" className="mb-6">
      <ul className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "inline-flex h-[34px] items-center rounded-full border border-line bg-surface px-4 text-[10.5px] font-extrabold uppercase tracking-[0.04em] transition-colors hover:border-ink",
                t.active && "border-ink bg-ink text-white",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Página `n` desde `?pagina=` (entero ≥ 1; cualquier otra cosa es la 1). */
export function pageFrom(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

export async function CatalogGrid({ basePath, categorySlug, page }: { basePath: string; categorySlug?: string; page: number }) {
  const result = await getStoreCards({ categorySlug, page });
  if (result.total === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-8">
        <p className="font-semibold">Todavía no hay productos publicados aquí.</p>
        <p className="mt-1 text-muted">Vuelve pronto para ver la colección.</p>
      </div>
    );
  }
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?pagina=${p}`);
  return (
    <>
      <AnalyticsImpression event={{ name: "view_item_list", listId: categorySlug ?? "catalog", items: result.cards.map((c) => ({ itemId: c.href, itemName: c.title, itemVariant: c.colorLabel, priceMinor: c.minPriceMinor, quantity: 1 })) }} />
      <p className="eyebrow mb-4" aria-live="polite">
        {result.total} {result.total === 1 ? "prenda" : "prendas"}
      </p>
      <ProductGrid cards={result.cards} priorityCount={4} quickAdd={(card) => <QuickAdd title={card.title} colorLabel={card.colorLabel} sizes={sizesOf(result.cards, card.key)} />} />
      {result.pageCount > 1 ? (
        <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-1.5">
          {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={href(p)}
              aria-current={p === result.page ? "page" : undefined}
              aria-label={`Página ${p}`}
              className={cn(
                "grid size-10 place-items-center rounded-full border border-line bg-surface text-[12px] font-extrabold hover:border-ink",
                p === result.page && "border-ink bg-ink text-white",
              )}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}

export function CatalogGridSkeleton() {
  return (
    <div aria-busy aria-label="Cargando productos" className="grid grid-cols-2 gap-x-2.5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="space-y-2.5">
          <Skeleton className="aspect-[4/5] rounded-card" />
          <Skeleton className="mx-auto h-3 w-2/3" />
          <Skeleton className="mx-auto h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

const sizesOf = (cards: StoreCard[], key: string) => cards.find((c) => c.key === key)?.sizes ?? [];
