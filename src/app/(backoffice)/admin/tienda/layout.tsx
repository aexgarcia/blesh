import Link from "next/link";
import { Suspense } from "react";

import { StorefrontSectionNav } from "@/modules/content/presentation/storefront-section-nav";

export default function StorefrontSettingsLayout({ children }: LayoutProps<"/admin/tienda">) {
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
      <Link href="/admin/tienda" className="text-muted underline underline-offset-4">Configuración de tienda</Link>
      <a href="/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Abrir tienda ↗</a>
    </div>
    <Suspense fallback={null}><StorefrontSectionNav /></Suspense>
    {children}
  </>;
}
