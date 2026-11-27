import { FlaskConical } from "lucide-react";

import type { OrderingStatus } from "../../contracts";

/** Aviso visible fuera de producción: número de WhatsApp y condiciones de prueba. */
export function TestModeBanner({ ordering }: { ordering: OrderingStatus }) {
  if (!ordering.testMode) return null;
  return (
    <div role="note" className="flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-white">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        Entorno de prueba: WhatsApp y condiciones de prueba
        {ordering.enabled ? "" : " (solicitudes sin configurar)"}. No se atienden pedidos reales.
      </span>
    </div>
  );
}
