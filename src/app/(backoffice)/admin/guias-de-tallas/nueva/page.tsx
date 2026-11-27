import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { Suspense } from "react";

import { SizeGuideForm } from "@/modules/catalog/presentation/components/size-guide-form";
import { requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Nueva guía de tallas" };
async function Form() {
  await requireAdminActor();
  return <Card className="p-5 md:p-7"><SizeGuideForm operationKey={randomUUID()} /></Card>;
}
export default function NewSizeGuidePage() {
  return <><PageHeader eyebrow="Catálogo" title="Nueva guía de tallas" description="Registra nombre, tallas y medidas antes de asignarla a tus productos." /><Suspense fallback={<CardSkeleton rows={6} />}><Form /></Suspense></>;
}
