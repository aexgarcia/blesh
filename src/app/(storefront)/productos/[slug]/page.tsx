import { notFound, permanentRedirect } from "next/navigation";

import { getStorePrimaryHref, getStoreProductPaths } from "@/composition/storefront";

/**
 * Se lee `params` antes de transmitir para responder 404 real (y no 200 + noindex) cuando el
 * producto/categoría no es público. Las rutas conocidas se prerenderizan completas; las nuevas
 * esperan su primer render. Ver ADR-019.
 */
export const instant = false;

export async function generateStaticParams() {
  const slugs = [...new Set((await getStoreProductPaths()).map((p) => p.slug))];
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__sin-productos__" }];
}

export async function generateMetadata({ params }: PageProps<"/productos/[slug]">) {
  const href = await getStorePrimaryHref((await params).slug);
  if (!href) notFound();
  return {};
}

/** El producto padre no es una página: redirige (308) al color principal (catalogo-e-importacion.md). */
export default async function ProductParentPage({ params }: PageProps<"/productos/[slug]">) {
  const href = await getStorePrimaryHref((await params).slug);
  if (!href) notFound();
  permanentRedirect(href);
}
