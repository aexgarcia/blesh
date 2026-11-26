import type { Metadata } from "next";

import { RequestSuccess } from "@/modules/sales/presentation/storefront/request-success";

export const metadata: Metadata = {
  title: "Solicitud registrada",
  robots: { index: false, follow: false },
};

/**
 * Sin referencia en la URL: la pantalla lee solo la recuperación local de este navegador
 * (contratos.md). No consulta pedidos en el servidor.
 */
export default function RequestPage() {
  return (
    <main className="mx-auto w-full max-w-site flex-1 px-5 py-12">
      <RequestSuccess />
    </main>
  );
}
