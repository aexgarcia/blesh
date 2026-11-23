import type { Metadata } from "next";
import { Suspense } from "react";

import { CUSTOMERS_PAGE_SIZE } from "@/modules/customers/contracts";
import { CustomerDirectory } from "@/modules/customers/presentation/components/customer-directory";
import { NewCustomerDialog } from "@/modules/customers/presentation/components/new-customer-dialog";
import { searchCustomers } from "@/modules/customers/server";
import { requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Clientes" };

export default function AdminCustomersPage() {
  return (
    <>
      <PageHeader eyebrow="Cartera" title="Clientes" description="Fichas de contacto e historial de pedidos." actions={<NewCustomerDialog />} />
      <Suspense fallback={<CardSkeleton rows={5} />}>
        <Directory />
      </Suspense>
    </>
  );
}

async function Directory() {
  const actor = await requireAdminActor();
  const initial = await searchCustomers(actor, { search: "", status: "active", page: 1, pageSize: CUSTOMERS_PAGE_SIZE });
  return (
    <Card>
      <CustomerDirectory initial={initial} />
    </Card>
  );
}
