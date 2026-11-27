import Image from "next/image";
import Link from "next/link";

import { getHomeData } from "@/composition/storefront";
import { ProductCard } from "@/modules/catalog/presentation/storefront/product-card";
import { SizeGuideDialog } from "@/modules/catalog/presentation/storefront/size-guide-dialog";
import { getStorefrontContent } from "@/modules/content/server";
import { PackBuilder } from "@/modules/sales/presentation/storefront/pack-builder";
import { QuickAdd } from "@/modules/sales/presentation/storefront/quick-add";
import { buttonVariants } from "@/shared/ui/button";
import { Rail } from "@/shared/ui/rail";
import { getSiteConfig } from "@/infrastructure/seo/server";
import { pageMetadata, serializeJsonLd } from "@/shared/seo/metadata";

import { AllProducts } from "./_components/all-products";
import { Reels } from "./_components/reels";
import { FloatingWhatsapp } from "./_components/floating-whatsapp";

export async function generateMetadata() {
  const content = await getStorefrontContent();
  return pageMetadata({
    origin: getSiteConfig().origin,
    path: "/",
    title: "Ropa streetwear hecha en Perú",
    description:
      "Descubre las prendas de BLESH, sus colores, tallas y precios en soles. Coordina tu compra y entrega por WhatsApp.",
    image: content.hero.image,
  });
}

/** Portada: estructura y secciones del prototipo (prototipo/index.html). */
export default async function HomePage() {
  const content = await getStorefrontContent();
  const home = await getHomeData();
  const { hero } = content;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${getSiteConfig().origin}/#organization`,
            name: content.business.name,
            url: getSiteConfig().origin,
            logo: `${getSiteConfig().origin}/brand/logo-tinta.png`,
          }),
        }}
      />
      {/* HERO */}
      {hero.enabled ? <section data-page-hero className="relative h-svh max-h-[1000px] min-h-[560px] overflow-hidden bg-dark text-white">
        {hero.image ? (
          <Image
            src={hero.image.url}
            alt={hero.image.alt}
            fill
            preload
            sizes="100vw"
            className="object-cover object-[60%_center]"
          />
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 top-10 size-[460px] rounded-full bg-violet/20 blur-[130px]"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,transparent_22%,transparent_55%,rgba(0,0,0,0.55)_100%)]"
        />
        <div className="absolute inset-x-0 bottom-0 z-[2] mx-auto max-w-site px-4 pb-[34px] md:px-5">
          <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]">
            {hero.eyebrow}
          </p>
          <h1 className="h-display mb-6">{hero.title}</h1>
          <a
            href={hero.cta.href}
            className={buttonVariants({ variant: "white", size: "lg" })}
          >
            {hero.cta.label}
          </a>
          <div className="mt-[26px] flex items-end justify-between gap-5 border-t border-white/35 pt-5 max-sm:mt-0 max-sm:border-t-0 max-sm:pt-0">
            <div className="flex gap-7 text-[11px] font-bold uppercase tracking-[0.04em] opacity-90 max-sm:hidden">
              {hero.meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            {hero.metaRight ? (
              <div className="text-[11px] font-bold uppercase tracking-[0.04em] opacity-90 max-sm:hidden">
                {hero.metaRight}
              </div>
            ) : null}
          </div>
        </div>
      </section> : <h1 className="sr-only">BLESH — ropa streetwear</h1>}

      {/* CÍRCULOS DE CATEGORÍAS */}
      <div className="bg-darker py-[22px] pb-[26px]">
        <div className="mx-auto max-w-site px-4 md:px-5">
          <nav
            aria-label="Categorías"
            className="flex justify-start gap-1.5 overflow-x-auto rounded-[22px] border border-white/14 bg-white/[0.04] px-[18px] py-6 [scrollbar-width:none] md:justify-center md:rounded-full [&::-webkit-scrollbar]:hidden"
          >
            {home.circles.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group flex w-24 shrink-0 flex-col items-center gap-4 text-white"
              >
                <span className="relative size-[52px] overflow-hidden rounded-full border-2 border-transparent bg-[#f1f0f0] transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:scale-[1.6] group-focus-visible:-translate-y-1 group-focus-visible:scale-[1.6] motion-reduce:transition-none">
                  {c.image ? (
                    <Image
                      src={c.image.url}
                      alt=""
                      fill
                      sizes="84px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="text-center text-[9.5px] font-extrabold uppercase leading-tight tracking-[0.03em]">
                  {c.name}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* DROP 00 / NUEVOS INGRESOS */}
      <section
        id="drop"
        className="scroll-mt-[calc(var(--chrome-h,96px)+12px)] py-12 md:py-16"
        aria-labelledby="drop-title"
      >
        <div className="mx-auto max-w-site px-4 md:px-5">
          <div className="section-head">
            <div>
              <p className="eyebrow mb-2">{content.drop.eyebrow}</p>
              <h2 id="drop-title" className="h-section">
                {content.drop.title}
              </h2>
            </div>
            <a href="#productos" className="link-arrow">
              Ver todos →
            </a>
          </div>
          <Rail label={content.drop.title}>
            {home.drop.map((card, i) => (
              <li key={card.key}>
                <ProductCard
                  card={card}
                  rank={i + 1}
                  sizes="(max-width: 900px) 45vw, 20vw"
                  quickAdd={
                    <QuickAdd
                      title={card.title}
                      colorLabel={card.colorLabel}
                      sizes={card.sizes}
                    />
                  }
                />
              </li>
            ))}
          </Rail>
        </div>
      </section>

      {/* ARMA TU PACK */}
      {content.pack.enabled && home.pack ? (
        <section
          id="pack"
          className="scroll-mt-[calc(var(--chrome-h,96px)+12px)] pb-12 md:pb-16"
          aria-labelledby="pack-title"
        >
          <div className="mx-auto max-w-site px-4 md:px-5">
            <div className="section-head max-sm:flex-wrap">
              <div>
                <p className="eyebrow mb-2">{content.pack.eyebrow}</p>
                <h2 id="pack-title" className="h-section">
                  {content.pack.title}
                </h2>
              </div>
              {home.pack.guides.length ? (
                <SizeGuideDialog
                  whatsappHref={content.socials.whatsapp?.href ?? null}
                  guide={home.pack.guides[0].guide}
                  products={home.pack.guides}
                  label="¿No sabes tu talla?"
                  className="link-arrow"
                />
              ) : null}
            </div>
            <PackBuilder
              label={home.pack.label}
              tierTotalsMinor={home.pack.tierTotalsMinor}
              colors={home.pack.colors}
            />
          </div>
        </section>
      ) : null}

      {/* TODAS LAS PRENDAS */}
      <AllProducts
        cards={home.cards}
        categories={home.categories}
        eyebrow={content.catalog.eyebrow}
        title={content.catalog.title}
      />

      {/* COLECCIONES */}
      {content.collections.enabled && content.collections.items.length ? <section className="pb-12 md:pb-16" aria-labelledby="colecciones-title">
        <div className="mx-auto max-w-site px-4 md:px-5">
          <div className="section-head">
            <div>
              <p className="eyebrow mb-2">{content.collections.eyebrow}</p>
              <h2 id="colecciones-title" className="h-section">
                {content.collections.title}
              </h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {content.collections.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group relative aspect-square max-h-[78vh] w-full overflow-hidden rounded-card bg-card text-white after:absolute after:inset-0 after:bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,0.6))]"
              >
                {item.image ? (
                  <Image
                    src={item.image.url}
                    alt={item.image.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform duration-[800ms] group-hover:scale-[1.04]"
                  />
                ) : null}
                <div className="absolute inset-x-[22px] bottom-[22px] z-[2] flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-[clamp(24px,3vw,38px)] font-black uppercase leading-[0.95] tracking-[-0.035em]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[12px] opacity-85">{item.text}</p>
                  </div>
                  <span
                    className={buttonVariants({ variant: "white", size: "lg" })}
                  >
                    Ver ↗
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section> : null}

      {/* EN MOVIMIENTO */}
      {content.reels.enabled ? (
      <section
        id="movimiento"
        className="scroll-mt-[calc(var(--chrome-h,96px)+12px)] bg-darker py-12 text-white md:py-16"
        aria-labelledby="movimiento-title"
      >
        <div className="mx-auto max-w-site px-4 md:px-5">
          <div className="section-head border-white/14">
            <div>
              <p className="eyebrow mb-2 text-white/60">
                {content.reels.eyebrow}
              </p>
              <h2 id="movimiento-title" className="h-section">
                {content.reels.title}
              </h2>
            </div>
            {content.reels.more ? (
              <a
                href={content.reels.more.href}
                target="_blank"
                rel="noopener noreferrer"
                className="link-arrow"
              >
                {content.reels.more.label}
              </a>
            ) : null}
          </div>
          <Reels items={home.reels} handle={content.reels.handle} />
        </div>
      </section>
      ) : null}
      <FloatingWhatsapp contact={content.floatingWhatsapp} />
    </main>
  );
}
