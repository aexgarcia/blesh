import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ProductInfoForm } from "@/modules/catalog/presentation/components/product-info-form";
import { listCategoryOptions, listSizeGuideOptions } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        eyebrow={"Productos"}
        title="Nuevo producto"
        description="Se crea como borrador. Después agregarás colores, tallas, fotos y stock antes de publicar."
      />
      <Suspense fallback={<CardSkeleton rows={4} />}>
        <NewProductForm />
      </Suspense>
      <p className="mt-6 text-[13px] text-muted">
        <Link href="/admin/productos" className="font-semibold text-ink underline-offset-4 hover:underline">
          ← Volver a productos
        </Link>
      </p>
    </>
  );
}

async function NewProductForm() {
  await requireAdminActor();
  const [categories, sizeGuides] = await Promise.all([listCategoryOptions(), listSizeGuideOptions()]);
  return (
    <Card className="p-6 md:p-8">
      <ProductInfoForm categories={categories} sizeGuides={sizeGuides} />
    </Card>
  );
}
