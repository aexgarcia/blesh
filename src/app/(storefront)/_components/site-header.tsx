"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ContentLink } from "@/modules/content/contracts";
import { CartButton } from "@/modules/sales/presentation/storefront/cart-button";
import { cn } from "@/shared/ui/cn";

import { InstagramIcon, SocialLinks } from "./social-icons";

type Socials = { instagram: ContentLink | null; tiktok: ContentLink | null; whatsapp: ContentLink | null; email: ContentLink | null };

/**
 * Cabecera del prototipo: marquesina de anuncios + barra flotante. En el inicio es
 * transparente sobre el hero y se vuelve sólida al hacer scroll; en el resto, sólida.
 * Mide su altura (--chrome-h) para que las páginas sin hero no queden debajo.
 */
export function SiteHeader({ announcements, nav, socials, banner }: { announcements: string[]; nav: ContentLink[]; socials: Socials; banner?: React.ReactNode }) {
  const currentPath = usePathname();
  // El HTML prerenderizado en Vercel puede no conocer la ruta real: lo que dependa de ella se
  // aplica tras montar para que la hidratación coincida (si no, React reintenta sin fin).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Activación intencional tras la hidratación.
  useEffect(() => setMounted(true), []);
  const pathname = mounted ? currentPath : null;
  const hasHero = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const chromeRef = useRef<HTMLDivElement>(null);
  const solid = !hasHero || scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const apply = () => document.documentElement.style.setProperty("--chrome-h", `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const items = announcements.map((text) => (
    <span key={text} className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] after:ml-12 after:opacity-50 after:content-['✦'] max-sm:text-[9.5px]">
      {text}
    </span>
  ));

  return (
    <>
      <div ref={chromeRef} className="fixed inset-x-0 top-0 z-40">
        {banner}
        <div role="region" aria-label="Anuncios" className="flex h-[30px] items-center overflow-hidden bg-darker text-white">
          <div className="marquee-track flex gap-12 whitespace-nowrap pl-12" aria-hidden>
            {items}
            {items}
            {items}
            {items}
          </div>
          <p className="sr-only">{announcements.join(". ")}</p>
        </div>
        <header className="px-3 pt-2.5">
          <div
            className={cn(
              "mx-auto grid h-[52px] max-w-site grid-cols-[1fr_auto_1fr] items-center rounded-full border px-1.5 transition-[background-color,color,box-shadow,border-color] duration-300 md:h-14 md:pl-3.5 md:pr-2.5",
              solid ? "border-white/60 bg-[rgba(248,245,246,0.72)] text-ink shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-[18px] backdrop-saturate-[1.4]" : "border-transparent text-white",
            )}
          >
            <div className="flex items-center">
              <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" className="grid size-10 place-items-center rounded-full hover:bg-[rgba(127,127,127,0.18)] md:hidden">
                <Menu className="size-5" aria-hidden />
              </button>
              <nav aria-label="Principal" className="hidden gap-1 md:flex">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.href === pathname ? "page" : undefined}
                    className={cn("nav-pill hover:bg-[rgba(127,127,127,0.18)]", item.href === pathname && "bg-[rgba(127,127,127,0.18)]")}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <Link href="/" aria-label="BLESH, ir al inicio" className="relative block h-[26px] w-[90px] md:h-[30px] md:w-[104px]">
              <Image src="/brand/logo-blanco.png" alt="" fill sizes="104px" priority className={cn("object-contain transition-opacity", solid ? "opacity-0" : "opacity-100")} />
              <Image src="/brand/logo-tinta.png" alt="" fill sizes="104px" priority className={cn("object-contain transition-opacity", solid ? "opacity-100" : "opacity-0")} />
            </Link>
            <div className="flex items-center justify-end gap-0.5">
              {socials.instagram ? (
                <a href={socials.instagram.href} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="hidden size-10 place-items-center rounded-full hover:bg-[rgba(127,127,127,0.18)] sm:grid">
                  <InstagramIcon className="size-5" />
                </a>
              ) : null}
              <CartButton inverted={!solid} />
            </div>
          </div>
        </header>
      </div>
      {/* Siempre presente (estructura estable); se oculta por CSS si la página tiene hero. */}
      <div aria-hidden style={{ height: "var(--chrome-h, 96px)" }} className="[body:has([data-page-hero])_&]:hidden" />

      <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col gap-2 bg-darker px-6 pb-8 pt-[90px] text-white focus:outline-none data-[state=open]:animate-[fadeUp_.3s_ease]">
            <DialogPrimitive.Title className="sr-only">Menú</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Navegación de la tienda</DialogPrimitive.Description>
            <DialogPrimitive.Close className="absolute right-5 top-10 grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar menú">
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
            <nav aria-label="Menú móvil" className="flex flex-col gap-2">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="text-[34px] font-black uppercase leading-tight tracking-[-0.03em]">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex gap-4 text-[12px] font-bold uppercase opacity-70">
              <SocialLinks socials={socials} variant="text" />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
