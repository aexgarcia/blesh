import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { SizeGuideForm } from "@/modules/catalog/presentation/components/size-guide-form";
import { getAdminSizeGuide } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Editar guía de tallas" };
async function Editor({ params }: PageProps<"/admin/guias-de-tallas/[id]">) {
  const actor = await requireAdminActor();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const guide = await getAdminSizeGuide(actor, id.data);
  if (!guide) notFound();
  return <div className="space-y-5"><Card className="p-5 md:p-7"><SizeGuideForm key={guide.version} guide={guide} operationKey={randomUUID()} /></Card>
    {guide.products.length ? <Card className="p-5"><h2 className="mb-3 font-black">Productos que usan esta guía</h2><ul className="space-y-2 text-sm">{guide.products.map((product) => <li key={product.id}><Link href={`/admin/productos/${product.id}`} className="underline">{product.title}</Link></li>)}</ul></Card> : null}
  </div>;
}
export default function EditSizeGuidePage(props: PageProps<"/admin/guias-de-tallas/[id]">) {
  return <><PageHeader eyebrow="Catálogo" title="Editar guía de tallas" description="La guía se comparte entre los productos asignados. Revisa el impacto antes de guardar." /><Suspense fallback={<CardSkeleton rows={6} />}><Editor {...props} /></Suspense></>;
}
