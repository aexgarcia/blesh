import { Suspense } from "react";

import { getSiteConfig } from "@/infrastructure/seo/server";
import { listingPath, pageMetadata } from "@/shared/seo/metadata";
import { getStoreCards } from "@/composition/storefront";

import { CatalogGrid, CatalogGridSkeleton, CategoryTabs, pageFrom } from "../_components/catalog-listing";

export async function generateMetadata({ searchParams }: PageProps<"/productos">) {
  const { pagina } = await searchParams;
  const { page } = await getStoreCards({ page: pageFrom(pagina) });
  return pageMetadata({ origin: getSiteConfig().origin, path: listingPath("/productos", String(page)), title: page > 1 ? `Productos — Página ${page}` : "Productos", description: "Todas las prendas de BLESH: streetwear hecho en Perú, precios en soles." });
}

async function Listing({ searchParams }: { searchParams: PageProps<"/productos">["searchParams"] }) {
  const { pagina } = await searchParams;
  return <CatalogGrid basePath="/productos" page={pageFrom(pagina)} />;
}

export default function ProductsPage({ searchParams }: PageProps<"/productos">) {
  return (
    <main className="mx-auto w-full max-w-site flex-1 px-5 py-12">
      <p className="eyebrow mb-2">Catálogo</p>
      <h1 className="h-section mb-6">Todas las prendas</h1>
      <CategoryTabs />
      <Suspense fallback={<CatalogGridSkeleton />}>
        <Listing searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
