import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { listAdminSizeGuides } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { Button } from "@/shared/ui/button";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Guías de tallas" };

async function Guides() {
  const actor = await requireAdminActor();
  const guides = await listAdminSizeGuides(actor);
  return <div className="grid gap-4 md:grid-cols-2">{guides.map((guide) => <Card key={guide.id} className="flex flex-col gap-3 p-5">
    <h2 className="text-lg font-black">{guide.name}</h2>
    <p className="text-sm text-muted">Tallas: {guide.rows.map((r) => r.sizeCode === "UNICA" ? "Única" : r.sizeCode).join(", ") || "Sin medidas"}</p>
    <p className="text-xs text-muted">{guide.productCount} productos · Versión {guide.version}</p>
    <Button asChild variant="secondary" className="mt-auto self-start"><Link href={`/admin/guias-de-tallas/${guide.id}`}>Ver y editar</Link></Button>
  </Card>)}{!guides.length ? <Card className="p-6">Todavía no hay guías. Registra las medidas reales de tu primera prenda.</Card> : null}</div>;
}

export default function SizeGuidesPage() {
  return <>
    <PageHeader eyebrow="Catálogo" title="Guías de tallas" description="Medidas reales reutilizables en productos y en la calculadora de tallas." actions={<Button asChild><Link href="/admin/guias-de-tallas/nueva"><Plus aria-hidden /> Nueva guía</Link></Button>} />
    <Suspense fallback={<CardSkeleton rows={4} />}><Guides /></Suspense>
  </>;
}
