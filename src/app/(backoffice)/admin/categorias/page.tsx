import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { listAdminCategories } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { Button } from "@/shared/ui/button";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Categorías" };
async function Categories() {
  const rows = await listAdminCategories(await requireAdminActor());
  return <div className="grid gap-4 md:grid-cols-2">{rows.map((row) => <Card key={row.id} className="space-y-3 p-5">
    <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-black">{row.name}</h2><span className="text-xs font-bold">{row.active ? "Activa" : "Inactiva"}</span></div>
    <p className="break-all text-sm text-muted">/categorias/{row.slug}</p>
    <p className="text-sm text-muted">Orden {row.position} · {row.productCount} productos · {row.publishedCount} publicados</p>
    <Button asChild variant="secondary"><Link href={`/admin/categorias/${row.id}`}>Ver y editar</Link></Button>
  </Card>)}{!rows.length ? <Card className="p-6">Crea la primera categoría para organizar tus prendas.</Card> : null}</div>;
}
export default function CategoriesPage() {
  return <><PageHeader eyebrow="Catálogo" title="Categorías" description="Organiza tus prendas y el orden de las categorías en la tienda." actions={<Button asChild><Link href="/admin/categorias/nueva">Nueva categoría</Link></Button>} /><Suspense fallback={<CardSkeleton rows={4} />}><Categories /></Suspense></>;
}
