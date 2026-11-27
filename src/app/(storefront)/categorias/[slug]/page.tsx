import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getStoreCards, getStoreCategories, getStoreCategory } from "@/composition/storefront";
import { getSiteConfig } from "@/infrastructure/seo/server";
import { listingPath, pageMetadata } from "@/shared/seo/metadata";

import { CatalogGrid, CatalogGridSkeleton, CategoryTabs, pageFrom } from "../../_components/catalog-listing";

/**
 * Se lee `params` antes de transmitir para responder 404 real (y no 200 + noindex) cuando el
 * producto/categoría no es público. Las rutas conocidas se prerenderizan completas; las nuevas
 * esperan su primer render. Ver ADR-019.
 */
export const instant = false;

export async function generateStaticParams() {
  const categories = await getStoreCategories();
  // Cache Components exige al menos un parámetro: marcador que responde 404.
  return categories.length ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "__sin-categorias__" }];
}

export async function generateMetadata({ params, searchParams }: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const category = await getStoreCategory((await params).slug);
  if (!category) notFound();
  const { pagina } = await searchParams;
  const { page } = await getStoreCards({ categorySlug: category.slug, page: pageFrom(pagina) });
  return pageMetadata({ origin: getSiteConfig().origin, path: listingPath(`/categorias/${category.slug}`, String(page)), title: page > 1 ? `${category.name} — Página ${page}` : category.name, description: category.description ?? `${category.name} de BLESH: streetwear hecho en Perú.` });
}

async function Listing({ slug, searchParams }: { slug: string; searchParams: PageProps<"/categorias/[slug]">["searchParams"] }) {
  const { pagina } = await searchParams;
  return <CatalogGrid basePath={`/categorias/${slug}`} categorySlug={slug} page={pageFrom(pagina)} />;
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categorias/[slug]">) {
  const { slug } = await params;
  const category = await getStoreCategory(slug);
  if (!category) notFound();
  return (
    <main className="mx-auto w-full max-w-site flex-1 px-5 py-12">
      <p className="eyebrow mb-2">Categoría</p>
      <h1 className="h-section mb-3">{category.name}</h1>
      {category.description ? <p className="mb-6 max-w-2xl text-muted">{category.description}</p> : <div className="mb-6" />}
      <CategoryTabs current={slug} />
      <Suspense fallback={<CatalogGridSkeleton />}>
        <Listing slug={slug} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
