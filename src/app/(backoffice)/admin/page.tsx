import { redirect } from "next/navigation";

import { requireAdminActor } from "@/modules/identity/server";

/** `/admin` no tiene dashboard en V1: lleva a Pedidos. */
export default async function AdminIndexPage() {
  await requireAdminActor();
  redirect("/admin/pedidos");
}
