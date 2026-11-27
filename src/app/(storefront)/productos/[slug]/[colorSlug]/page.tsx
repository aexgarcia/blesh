import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductNeighbours, getStoreProduct, getStoreProductPaths, type StoreCard } from "@/composition/storefront";
import { ProductCard } from "@/modules/catalog/presentation/storefront/product-card";
import { ProductGallery } from "@/modules/catalog/presentation/storefront/product-gallery";
import { ColorOptions, SizeGuideTable, type ColorOption } from "@/modules/catalog/presentation/storefront/product-options";
import { SizeGuideDialog } from "@/modules/catalog/presentation/storefront/size-guide-dialog";
import { getStorefrontContent } from "@/modules/content/server";
import { packApplies } from "@/modules/sales/contracts";
import { getPublicPackPolicies } from "@/modules/sales/server";
import { PurchasePanel } from "@/modules/sales/presentation/storefront/purchase-panel";
import { QuickAdd } from "@/modules/sales/presentation/storefront/quick-add";
import { buttonVariants } from "@/shared/ui/button";
import { Rail } from "@/shared/ui/rail";
import { getSiteConfig } from "@/infrastructure/seo/server";
import { pageMetadata, serializeJsonLd } from "@/shared/seo/metadata";
import { productStructuredData } from "@/composition/product-seo";
import { AnalyticsImpression } from "@/shared/analytics/impression";

/**
 * Se lee `params` antes de transmitir para responder 404 real (y no 200 + noindex) cuando el
 * producto/categoría no es público. Las rutas conocidas se prerenderizan completas; las nuevas
 * esperan su primer render. Ver ADR-019.
 */
export const instant = false;

/** Prerender de las fichas publicadas; nuevas publicaciones se generan en la primera visita. */
export async function generateStaticParams() {
  const paths = await getStoreProductPaths();
  return paths.length ? paths : [{ slug: "__sin-productos__", colorSlug: "__sin-color__" }];
}

export async function generateMetadata({ params }: PageProps<"/productos/[slug]/[colorSlug]">): Promise<Metadata> {
  const { slug, colorSlug } = await params;
  const product = await getStoreProduct(slug, colorSlug);
  if (!product) notFound();
  return pageMetadata({
    origin: getSiteConfig().origin, path: `/productos/${product.slug}/${product.color.slug}`,
    title: product.seoTitle ? `${product.seoTitle} — ${product.color.label}` : `${product.title} ${product.color.label}`,
    description: product.seoDescription ?? (product.shortDescription || `${product.title} en color ${product.color.label}. Streetwear hecho en Perú.`),
    image: product.images[0],
  });
}

/** Diseños hermanos de un producto de un solo color: «Diseño» si el título lleva el nombre entre comillas. */
function siblingOptions(siblings: StoreCard[], currentHref: string): { label: string; options: ColorOption[] } {
  const quoted = (title: string) => /"(.+)"/.exec(title)?.[1] ?? null;
  const byDesign = siblings.every((s) => quoted(s.title));
  return {
    label: byDesign ? "Diseño" : "Color",
    options: siblings.map((s) => ({
      slug: s.key,
      label: byDesign ? quoted(s.title)! : s.colorLabel,
      swatchHex: s.swatchHex,
      href: s.href,
      current: s.href === currentHref,
      image: s.image,
    })),
  };
}

const Accordion = ({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) => (
  <details open={open} className="group border-b border-line">
    <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[11px] font-black uppercase tracking-[0.05em] [&::-webkit-details-marker]:hidden">
      {title}
      <span aria-hidden className="text-[18px] font-normal transition-transform group-open:rotate-45">
        +
      </span>
    </summary>
    <div className="pb-[18px] text-[13px] leading-relaxed text-[#444]">{children}</div>
  </details>
);

export default async function ProductColorPage({ params }: PageProps<"/productos/[slug]/[colorSlug]">) {
  const { slug, colorSlug } = await params;
  const product = await getStoreProduct(slug, colorSlug);
  if (!product) notFound();
  const content = await getStorefrontContent();
  const extras = content.products[product.slug] ?? {};
  const { siblings, related } = await getProductNeighbours(product.category?.slug ?? null, product.slug);
  const currentHref = `/productos/${product.slug}/${product.color.slug}`;
  const options = product.colors.length > 1 ? { label: "Color", options: product.colors } : siblingOptions(siblings, currentHref);
  const pack = (await getPublicPackPolicies()).find((p) => packApplies(p, { productSlug: product.slug, categorySlug: product.category?.slug ?? null })) ?? null;
  const packText = pack ? pack.tierTotalsMinor.map((t, i) => `${i + 1} x S/${t / 100}`).join(" · ") : null;
  const hasCompare = product.sizes.some((s) => s.compareAtMinor);

  return (
    <main className="pt-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productStructuredData(product, getSiteConfig().origin)) }} />
      <AnalyticsImpression event={{ name: "view_item", items: [{ itemId: `/productos/${product.slug}/${product.color.slug}`, itemName: product.title, itemVariant: product.color.label, priceMinor: Math.min(...product.sizes.map((s) => s.priceMinor)), quantity: 1 }] }} />
      <div className="mx-auto w-full max-w-site px-4 md:px-5">
        <nav aria-label="Ruta de navegación" className="mb-4">
          <ol className="flex flex-wrap gap-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                Inicio
              </Link>
            </li>
            <li aria-hidden>/</li>
            {product.category ? (
              <>
                <li>
                  <Link href={`/categorias/${product.category.slug}`} className="hover:text-ink">
                    {product.category.name}
                  </Link>
                </li>
                <li aria-hidden>/</li>
              </>
            ) : null}
            <li aria-current="page" className="text-ink">
              {product.title}
            </li>
          </ol>
        </nav>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] lg:gap-7">
          <ProductGallery images={product.images} title={`${product.title} ${product.color.label}`} />

          <div className="flex flex-col gap-[18px] lg:sticky lg:top-[calc(var(--chrome-h,96px)+12px)]">
            <div>
              {extras.badge || (extras.launchPrice && hasCompare) || product.soldOut ? (
                <div className="mb-3 flex gap-1.5">
                  {product.soldOut ? <span className="tag">Agotado</span> : null}
                  {extras.badge ? <span className="tag">{extras.badge}</span> : null}
                  {extras.launchPrice && hasCompare ? <span className="tag tag-light border border-line">Precio lanzamiento</span> : null}
                </div>
              ) : null}
              <h1 className="text-[clamp(24px,2.4vw,32px)] font-black uppercase leading-none tracking-[-0.035em]">
                {product.title}
                <small className="ml-1.5 align-middle text-[13px] font-medium normal-case tracking-normal text-muted">{product.color.label}</small>
              </h1>
            </div>

            <PurchasePanel
              productSlug={product.slug}
              productTitle={product.title}
              colorLabel={product.color.label}
              sizes={product.sizes}
              sizeGuide={product.sizeGuide ? <SizeGuideDialog whatsappHref={content.socials.whatsapp?.href ?? null} guide={product.sizeGuide} productSlug={product.slug} productTitle={product.title} availableSizes={product.sizes.filter((s) => !s.soldOut).map((s) => s.sizeCode)} /> : null}
              afterPrice={
                <>
                  {extras.subtitle || product.shortDescription ? <p className="-mt-3 text-[12px] text-muted">{extras.subtitle ?? product.shortDescription}</p> : null}
                  {pack ? (
                    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface px-4 py-3.5">
                      <div>
                        <b className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em]">Arma tu pack</b>
                        <span className="text-[11.5px] text-muted">Combina colores y tallas. Descuento automático en el carrito.</span>
                      </div>
                      <strong className="whitespace-nowrap text-[15px] font-black">3 x S/{pack.tierTotalsMinor[2] / 100}</strong>
                    </div>
                  ) : (
                    <div className="rounded-[12px] border border-line bg-surface px-4 py-3.5">
                      <b className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em]">{content.shippingNote.title}</b>
                      <span className="text-[11.5px] text-muted">{content.shippingNote.text}</span>
                    </div>
                  )}
                  <hr className="border-line" />
                  <ColorOptions colors={options.options} label={options.label} />
                </>
              }
              afterBuy={
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {content.productChips.map((chip) => (
                      <div key={chip} className="grid h-[42px] place-items-center rounded-full border border-line bg-surface px-2.5 text-center text-[10px] font-extrabold uppercase leading-tight tracking-[0.04em]">
                        {chip}
                      </div>
                    ))}
                  </div>
                  {content.pack.enabled && pack && packText ? (
                    <div className="flex items-center gap-3 rounded-[12px] bg-ink px-4 py-3.5 text-white">
                      <div>
                        <b className="block text-[11px] font-black uppercase tracking-[0.04em]">{packText}</b>
                        <span className="text-[11.5px] opacity-75">Arma tu pack desde la página principal.</span>
                      </div>
                      <Link href="/#pack" className={buttonVariants({ variant: "white", size: "sm", className: "ml-auto h-9" })}>
                        Armar
                      </Link>
                    </div>
                  ) : null}
                </>
              }
            />

            <div className="border-t border-line">
              {product.description ? (
                <Accordion title="Descripción" open>
                  <p className="whitespace-pre-line">{product.description}</p>
                </Accordion>
              ) : null}
              {extras.details?.length ? (
                <Accordion title="Detalles">
                  <ul className="grid gap-1.5">
                    {extras.details.map((d) => (
                      <li key={d} className="relative pl-4 before:absolute before:left-0 before:top-[3px] before:text-[9px] before:content-['★']">
                        {d}
                      </li>
                    ))}
                  </ul>
                </Accordion>
              ) : null}
              {product.sizeGuide ? (
                <Accordion title="Guía de tallas">
                  <SizeGuideTable guide={product.sizeGuide} />
                </Accordion>
              ) : null}
              <Accordion title="Envíos y cambios">
                <p>{content.policiesText.shipping}</p>
                <p className="mt-2">{content.policiesText.changes}</p>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="relacionados" className="py-12 md:py-16">
          <div className="mx-auto max-w-site px-4 md:px-5">
            <div className="section-head">
              <div>
                <p className="eyebrow mb-2">Completa el look</p>
                <h2 id="relacionados" className="h-section">
                  También te puede gustar
                </h2>
              </div>
              <Link href="/#productos" className="link-arrow">
                Ver todo →
              </Link>
            </div>
            <Rail label="También te puede gustar">
              {related.map((card) => (
                <li key={card.key}>
                  <ProductCard card={card} sizes="(max-width: 900px) 45vw, 20vw" quickAdd={<QuickAdd title={card.title} colorLabel={card.colorLabel} sizes={card.sizes} />} />
                </li>
              ))}
            </Rail>
          </div>
        </section>
      ) : null}
    </main>
  );
}
