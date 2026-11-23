import Link from "next/link";

import { Logo } from "@/shared/ui/brand";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/productos", label: "Productos" },
] as const;

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 px-3 pt-2.5">
        <div className="mx-auto grid h-14 max-w-site grid-cols-[1fr_auto_1fr] items-center rounded-full border border-white/60 bg-bg/75 px-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-lg">
          <nav aria-label="Principal" className="flex gap-1">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="nav-pill">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/" aria-label="BLESH, ir al inicio">
            <Logo alt="" preload className="h-7" />
          </Link>
          {/* Carrito: fase 6 (Tienda y WhatsApp). */}
          <span aria-hidden="true" />
        </div>
      </header>

      <div id="contenido" className="flex flex-1 flex-col">
        {children}
      </div>

      <footer className="bg-darker px-5 pb-7 pt-16 text-white">
        <div className="mx-auto max-w-site">
          <Logo tone="white" className="mx-auto mb-12 h-[clamp(60px,12vw,160px)] opacity-95" />
          {/* Contactos y políticas: se publican cuando el negocio entregue los datos reales. */}
          <div className="flex flex-wrap justify-between gap-4 border-t border-white/10 pt-5 text-[11px] text-white/50">
            <span>© BLESH · Hecho en Perú</span>
            <span>Precios en soles (PEN)</span>
          </div>
        </div>
      </footer>
    </>
  );
}
