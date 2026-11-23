import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";

import { requireAdminActor } from "@/modules/identity/server";
import { Card, EmptyState, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Pedidos" };

export default async function AdminOrdersPage() {
  await requireAdminActor();
  return (
    <>
      <PageHeader eyebrow="Operación" title="Pedidos" description="Solicitudes web y pedidos manuales, acuerdos, cobros y entregas." />
      <Card>
        <EmptyState icon={<ShoppingBag />} title="Sección en construcción" description="Disponible en la fase 5 del desarrollo." />
      </Card>
    </>
  );
}
