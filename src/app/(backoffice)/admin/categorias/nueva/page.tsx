import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CategoryForm } from "@/modules/catalog/presentation/components/category-form";
import { requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Nueva categoría" };
async function Form() { await requireAdminActor(); return <Card className="p-5 md:p-7"><CategoryForm operationKey={randomUUID()} /></Card>; }
export default function NewCategoryPage() {
  return <><PageHeader eyebrow="Catálogo" title="Nueva categoría" description="La URL se genera al escribir el nombre y queda fija al crearla." /><Suspense fallback={<CardSkeleton rows={5} />}><Form /></Suspense></>;
}
