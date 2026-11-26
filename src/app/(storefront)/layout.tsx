import { getStorefrontContent } from "@/modules/content/server";
import { WelcomeOffer } from "@/modules/content/presentation/welcome-offer";
import { getStoreOrderingStatus } from "@/composition/storefront-ordering";
import { CartProvider } from "@/modules/sales/presentation/storefront/cart-context";
import { CartSheet } from "@/modules/sales/presentation/storefront/cart-sheet";
import { TestModeBanner } from "@/modules/sales/presentation/storefront/test-mode-banner";
import { Suspense } from "react";

import { getSiteConfig } from "@/infrastructure/seo/server";
import { AnalyticsConsent } from "@/shared/analytics/consent";

import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";

export default async function StorefrontLayout({ children }: LayoutProps<"/">) {
  const ordering = await getStoreOrderingStatus();
  const content = await getStorefrontContent();
  const site = getSiteConfig();

  return (
    <CartProvider ordering={ordering}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>
      <SiteHeader announcements={content.announcements} nav={content.nav} socials={content.socials} banner={<TestModeBanner ordering={ordering} />} />
      <div id="contenido" className="flex flex-1 flex-col">
        {children}
      </div>
      <CartSheet />
      {content.welcomeOffer ? <WelcomeOffer offer={content.welcomeOffer} contactHref={content.socials.whatsapp?.href ?? null} /> : null}
      <SiteFooter content={content} />
      <Suspense fallback={null}><AnalyticsConsent measurementId={site.measurementId} origin={site.origin} /></Suspense>
    </CartProvider>
  );
}
