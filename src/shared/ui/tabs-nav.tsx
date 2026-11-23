import Link from "next/link";

import { cn } from "./cn";

/** Pestañas como enlaces (estado en la URL: recargable y compartible). */
export function TabsNav({ tabs, active, label }: { tabs: { key: string; label: string; href: string; badge?: React.ReactNode }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-1 [scrollbar-width:none]">
      {tabs.map((tab) => {
        const current = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-[11px] font-extrabold uppercase tracking-[0.05em] transition-colors",
              current ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.badge}
          </Link>
        );
      })}
    </nav>
  );
}
