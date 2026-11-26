"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

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

/** Grupo desplegable en escritorio; en móvil el enlace abre el índice de secciones. */
export function SidebarLinkGroup({ href, label, icon, links }: { href: string; label: string; icon: React.ReactNode; links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const id = useId();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const [toggle, setToggle] = useState<{ path: string; open: boolean } | null>(null);
  const expanded = toggle?.path === pathname ? toggle.open : active;
  return <>
    <div className="md:hidden"><SidebarLink href={href} icon={icon}>{label}</SidebarLink></div>
    <div className="hidden md:block">
      <div className={cn("flex items-center rounded-full", active && "bg-white/8")}>
        <Link href={href} aria-current={pathname === href ? "page" : undefined} className={cn(base, "min-w-0 flex-1", pathname === href && activeClass)}>{icon}{label}</Link>
        <button type="button" className="mr-1 grid size-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label={`${expanded ? "Contraer" : "Expandir"} ${label}`} aria-expanded={expanded} aria-controls={id} onClick={() => setToggle({ path: pathname, open: !expanded })}><ChevronDown aria-hidden className={cn("size-4 transition-transform", expanded && "rotate-180")} /></button>
      </div>
      <ul id={id} hidden={!expanded} className="ml-6 mt-2 space-y-1 border-l border-white/15 pl-3">
        {links.map((link) => <li key={link.href}><Link href={link.href} aria-current={pathname === link.href ? "page" : undefined} className={cn("block rounded-xl px-3 py-2 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/8 hover:text-white", pathname === link.href && "bg-white text-ink hover:bg-white hover:text-ink")}>{link.label}</Link></li>)}
      </ul>
    </div>
  </>;
}
