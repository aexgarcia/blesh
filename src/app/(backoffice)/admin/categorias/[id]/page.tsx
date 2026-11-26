import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CategoryForm } from "@/modules/catalog/presentation/components/category-form";
import { getAdminCategory } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Editar categoría" };
async function Editor({ params }: PageProps<"/admin/categorias/[id]">) {
  const actor = await requireAdminActor();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const category = await getAdminCategory(actor, id.data);
  if (!category) notFound();
  return <Card className="p-5 md:p-7"><CategoryForm key={category.version} category={category} operationKey={randomUUID()} /></Card>;
}
export default function EditCategoryPage(props: PageProps<"/admin/categorias/[id]">) {
  return <><PageHeader eyebrow="Catálogo" title="Editar categoría" description="Actualiza nombre, descripción, orden y visibilidad." /><Suspense fallback={<CardSkeleton rows={5} />}><Editor {...props} /></Suspense></>;
}
