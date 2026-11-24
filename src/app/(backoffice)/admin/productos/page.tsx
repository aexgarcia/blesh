import { ChevronLeft, ChevronRight, Package, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { listProductsForAdmin } from "@/composition/product-admin";
import { PRODUCT_STATUS_LABELS, type ProductStatus } from "@/modules/catalog/contracts";
import { listCategoryOptions } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { formatLimaDate } from "@/shared/domain/dates";
import { Button } from "@/shared/ui/button";
import { Input, Select } from "@/shared/ui/form";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Badge, Card, EmptyState, PageHeader } from "@/shared/ui/surface";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";

export const metadata: Metadata = { title: "Productos" };

const PAGE_SIZE = 20;
const STATUS_TONE = { published: "success", draft: "neutral", archived: "warning" } as const;

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/productos">) {
  return (
    <>
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        description="Productos, colores, tallas, fotos y stock."
        actions={
          <Button asChild size="lg">
            <Link href="/admin/productos/nuevo">
              <Plus aria-hidden /> Nuevo producto
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<CardSkeleton rows={5} />}>
        <ProductsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function ProductsList({ searchParams }: Pick<PageProps<"/admin/productos">, "searchParams">) {
  await requireAdminActor();
  const params = await searchParams;
  const q = one(params.q)?.slice(0, 80) ?? "";
  const statusParam = one(params.estado);
  const status = statusParam && statusParam in PRODUCT_STATUS_LABELS ? (statusParam as ProductStatus) : undefined;
  const categoryId = one(params.categoria) || undefined;
  const page = Math.max(1, Number.parseInt(one(params.pagina) ?? "1", 10) || 1);

  const [categories, { rows, total }] = await Promise.all([
    listCategoryOptions(),
    listProductsForAdmin({ search: q, status, categoryId: categoryId && /^[0-9a-f-]{36}$/.test(categoryId) ? categoryId : undefined, page, pageSize: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("estado", status);
    if (categoryId) sp.set("categoria", categoryId);
    sp.set("pagina", String(p));
    return `/admin/productos?${sp}`;
  };

  return (
    <Card>
      <form className="flex flex-wrap gap-3 border-b border-line p-5" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder="Buscar por título o SKU" className="pl-10" />
        </div>
        <label htmlFor="estado" className="sr-only">
          Estado
        </label>
        <Select id="estado" name="estado" defaultValue={status ?? ""} className="w-48">
          <option value="">Todos los estados</option>
          {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label htmlFor="categoria" className="sr-only">
          Categoría
        </label>
        <Select id="categoria" name="categoria" defaultValue={categoryId ?? ""} className="w-48">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="lg">
          Filtrar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={q || status || categoryId ? "Sin resultados" : "Aún no hay productos"}
          description={q || status || categoryId ? "Prueba con otros filtros." : "Crea el primer producto y agrega sus colores, tallas, fotos y stock."}
          action={
            q || status || categoryId ? undefined : (
              <Button asChild>
                <Link href="/admin/productos/nuevo">Nuevo producto</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Producto</Th>
                <Th>Estado</Th>
                <Th>Categoría</Th>
                <Th className="text-right">Colores / tallas</Th>
                <Th className="text-right">Disponible</Th>
                <Th>Actualizado</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <Tr key={p.id} className="hover:bg-bg/70">
                  <Td>
                    <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3 font-bold underline-offset-4 hover:underline">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-[10px] bg-card">
                        {p.cover ? <Image src={p.cover.url} alt="" fill sizes="48px" className="object-cover" /> : null}
                      </span>
                      {p.title}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[p.status]}>{PRODUCT_STATUS_LABELS[p.status]}</Badge>
                  </Td>
                  <Td className="text-muted">{p.categoryName ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {p.colorCount} / {p.variantCount}
                  </Td>
                  <Td className="text-right">
                    {p.stock.unregistered > 0 ? (
                      <Badge tone="warning">Sin registrar</Badge>
                    ) : p.variantCount === 0 ? (
                      "—"
                    ) : p.stock.available > 0 ? (
                      <span className="font-extrabold tabular-nums">{p.stock.available}</span>
                    ) : (
                      <Badge tone="danger">Agotado</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatLimaDate(new Date(p.updatedAt))}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <nav aria-label="Paginación" className="flex items-center justify-between border-t border-line px-6 py-4 text-[13px] text-muted">
            <span>
              {total} producto{total === 1 ? "" : "s"} · página {page} de {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft aria-hidden /> Anterior
                  </Link>
                </Button>
              ) : null}
              {page < pages ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Siguiente <ChevronRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </Card>
  );
}
