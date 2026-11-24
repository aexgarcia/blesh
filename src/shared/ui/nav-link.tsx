"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "./cn";

type SidebarLinkProps = { href: string; icon?: React.ReactNode; children: React.ReactNode };

const base =
  "group flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-white/60 transition-colors hover:bg-white/8 hover:text-white [&_svg]:size-4";
const activeClass = "bg-white text-ink hover:bg-white hover:text-ink";

/**
 * Enlace de navegación lateral con estado activo (`aria-current`).
 * Usa `usePathname()`: debe renderizarse dentro de `<Suspense>`.
 */
export function SidebarLink({ href, icon, children }: SidebarLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(base, active && activeClass)}>
      {icon}
      {children}
    </Link>
  );
}

/** Variante sin estado activo para el marco estático (fallback de Suspense). */
export function SidebarLinkStatic({ href, icon, children }: SidebarLinkProps) {
  return (
    <Link href={href} className={base}>
      {icon}
      {children}
    </Link>
  );
}
