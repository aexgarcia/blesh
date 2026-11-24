import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getProductEditorData } from "@/composition/product-admin";
import { PRODUCT_STATUS_LABELS, SIZE_LABELS } from "@/modules/catalog/contracts";
import { ColorsPanel } from "@/modules/catalog/presentation/components/colors-panel";
import { ImagesPanel } from "@/modules/catalog/presentation/components/images-panel";
import { ProductInfoForm } from "@/modules/catalog/presentation/components/product-info-form";
import { listCategoryOptions, listSizeGuideOptions } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { StockPanel } from "@/modules/inventory/presentation/components/stock-panel";
import { CardSkeleton, Skeleton } from "@/shared/ui/skeleton";
import { Alert, Badge, Card } from "@/shared/ui/surface";
import { TabsNav } from "@/shared/ui/tabs-nav";

import { PublicationPanel } from "./_components/publication-panel";

export const metadata: Metadata = { title: "Editar producto" };

const TABS = [
  { key: "informacion", label: "Información" },
  { key: "colores", label: "Colores y tallas" },
  { key: "imagenes", label: "Imágenes" },
  { key: "stock", label: "Stock" },
  { key: "publicacion", label: "Publicación" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const STATUS_TONE = { published: "success", draft: "neutral", archived: "warning" } as const;

export default function ProductEditorPage({ params, searchParams }: PageProps<"/admin/productos/[id]">) {
  return (
    <>
      <Link href="/admin/productos" className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Productos
      </Link>
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-12 w-80 rounded-full" />
            <CardSkeleton rows={4} />
          </div>
        }
      >
        <Editor params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Editor({ params, searchParams }: PageProps<"/admin/productos/[id]">) {
  await requireAdminActor();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const tab: TabKey = TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : "informacion";

  const data = await getProductEditorData(id);
  if (!data) notFound();
  const { product, balances, movements, issues } = data;
  const colorLabel = new Map(product.colors.map((c) => [c.id, c.label]));
  const colorOrder = new Map(product.colors.map((c) => [c.id, c.position]));
  const unregistered = product.variants.filter((v) => !balances[v.id]).length;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Producto</p>
          <h1 className="h-section">{product.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-muted">
            <Badge tone={STATUS_TONE[product.status]}>{PRODUCT_STATUS_LABELS[product.status]}</Badge>
            {product.colors.length} color(es) · {product.variants.length} talla(s)
          </p>
        </div>
      </header>

      {sp.creado ? (
        <Alert tone="success" title="Borrador creado" className="mb-6">
          Ahora agrega los colores y sus tallas.
        </Alert>
      ) : null}

      <TabsNav
        label="Secciones del producto"
        active={tab}
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          href: `/admin/productos/${product.id}?tab=${t.key}`,
          badge:
            t.key === "stock" && unregistered > 0 ? (
              <Badge tone="warning">{unregistered}</Badge>
            ) : t.key === "publicacion" && product.status === "draft" && issues.length > 0 ? (
              <Badge>{issues.length}</Badge>
            ) : undefined,
        }))}
      />

      {tab === "informacion" ? <InfoTab productId={product.id} product={product} /> : null}
      {tab === "colores" ? <ColorsPanel product={product} /> : null}
      {tab === "imagenes" ? <ImagesPanel product={product} /> : null}
      {tab === "stock" ? (
        <StockPanel
          rows={[...product.variants]
            .sort((a, b) => (colorOrder.get(a.colorId) ?? 0) - (colorOrder.get(b.colorId) ?? 0))
            .map((v) => ({
            variantId: v.id,
            label: `${colorLabel.get(v.colorId) ?? "—"} / ${SIZE_LABELS[v.sizeCode]}`,
            sku: v.sku,
            active: v.active,
          }))}
          balances={balances}
          movements={movements}
        />
      ) : null}
      {tab === "publicacion" ? <PublicationPanel product={product} issues={issues} /> : null}
    </>
  );
}

async function InfoTab({ product }: { productId: string; product: NonNullable<Awaited<ReturnType<typeof getProductEditorData>>>["product"] }) {
  const [categories, sizeGuides] = await Promise.all([listCategoryOptions(), listSizeGuideOptions()]);
  return (
    <Card className="p-6 md:p-8">
      <ProductInfoForm key={product.version} categories={categories} sizeGuides={sizeGuides} product={product} />
    </Card>
  );
}
