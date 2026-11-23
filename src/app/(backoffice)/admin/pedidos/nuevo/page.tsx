import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireAdminActor } from "@/modules/identity/server";
import { ManualOrderForm } from "@/modules/sales/presentation/components/manual-order-form";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Pedido manual" };

export default function NewOrderPage() {
  return (
    <>
      <Link href="/admin/pedidos" className="mb-6 inline-flex items-center gap-2 text-[12px] font-bold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>
      <PageHeader
        eyebrow="Pedidos"
        title="Pedido manual"
        description="Venta por WhatsApp o en tienda. Se registra como solicitud con precios del catálogo; después acuerdas entrega y cobro, y confirmas para reservar."
      />
      <Suspense fallback={<CardSkeleton rows={4} />}>
        <Gate />
      </Suspense>
    </>
  );
}

async function Gate() {
  await requireAdminActor();
  return (
    <Card className="p-6 md:p-8">
      <ManualOrderForm />
    </Card>
  );
}
