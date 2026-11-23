import { Users } from "lucide-react";
import type { Metadata } from "next";

import { requireAdminActor } from "@/modules/identity/server";
import { Card, EmptyState, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Clientes" };

export default async function AdminCustomersPage() {
  await requireAdminActor();
  return (
    <>
      <PageHeader eyebrow="Cartera" title="Clientes" description="Directorio de clientes e historial de pedidos." />
      <Card>
        <EmptyState icon={<Users />} title="Sección en construcción" description="Disponible en la fase 4 del desarrollo." />
      </Card>
    </>
  );
}
