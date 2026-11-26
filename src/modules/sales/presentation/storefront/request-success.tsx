"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { trackEvent } from "@/shared/analytics/track";
import { formatPEN } from "@/shared/domain/money";
import { Button, buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";
import { Skeleton } from "@/shared/ui/skeleton";
import { Alert, Card } from "@/shared/ui/surface";

import { markOpened } from "../../domain/request-history";
import { requestHistoryStore } from "./browser-store";

const subscribeHydration = () => () => undefined;

/**
 * Pantalla de solicitud registrada. Lee la recuperación local (este navegador): abrir,
 * copiar o volver a abrir WhatsApp nunca llama al servidor ni duplica la solicitud.
 */
export function RequestSuccess() {
  const history = useSyncExternalStore(requestHistoryStore.subscribe, requestHistoryStore.get, requestHistoryStore.getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);

  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const request = history.find((r) => r.reference === selected) ?? history[0];
  if (!request) {
    return (
      <Card className="p-8">
        <p className="text-[15px] font-extrabold">No hay solicitudes recientes en este dispositivo.</p>
        <p className="mt-1 text-muted">Por privacidad, solo guardamos aquí tus últimas solicitudes durante 7 días.</p>
        <Button asChild className="mt-5">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </Card>
    );
  }

  function opened() {
    requestHistoryStore.set(markOpened(requestHistoryStore.get(), request.reference));
    trackEvent({ name: "whatsapp_click", placement: "request_success", itemCount: request.units });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(request.message);
    } catch {
      // Sin permiso de portapapeles: se selecciona el texto para copiarlo a mano.
      textRef.current?.focus();
      textRef.current?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  const openLabel = request.opened ? "Volver a abrir WhatsApp" : "Abrir WhatsApp";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
      <div className="space-y-6">
        <div>
          <p className="eyebrow mb-2">Referencia {request.reference}</p>
          <h1 className="h-section">Solicitud registrada; pendiente de coordinación</h1>
          <p className="mt-3 max-w-xl text-muted">
            {request.units} {request.units === 1 ? "prenda" : "prendas"} · {formatPEN(request.totalMinor ?? request.subtotalMinor)} + envío por acordar.
          </p>
        </div>

        <Alert tone="warning" title="Aún no es una compra">
          Abrir WhatsApp no confirma la compra, el pago ni la reserva. Envía el mensaje para coordinar: BLESH confirmará disponibilidad, entrega y forma de pago, y
          solo entonces apartará tus prendas.
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {request.whatsappUrl ? (
            <a href={request.whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={opened} className={buttonVariants({ size: "lg" })}>
              <MessageCircle aria-hidden /> {openLabel}
            </a>
          ) : null}
          <Button variant={request.whatsappUrl ? "secondary" : "primary"} size="lg" onClick={copy} aria-describedby={textId}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Mensaje copiado" : "Copiar mensaje"}
          </Button>
          {!request.whatsappUrl ? (
            <a href={request.whatsappChatUrl} target="_blank" rel="noopener noreferrer" onClick={opened} className={buttonVariants({ variant: "secondary", size: "lg" })}>
              <MessageCircle aria-hidden /> {request.opened ? "Volver a abrir el chat" : "Abrir chat de WhatsApp"}
            </a>
          ) : null}
        </div>
        <p role="status" className="sr-only">
          {copied ? "Mensaje copiado al portapapeles." : ""}
        </p>
        {!request.whatsappUrl ? (
          <Alert tone="info" title="Tu carrito es extenso">
            El mensaje completo no cabe en un enlace de WhatsApp. Cópialo y pégalo en el chat: no recortamos ninguna línea.
          </Alert>
        ) : null}

        {history.length > 1 ? (
          <div>
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.05em]">Otras solicitudes recientes en este dispositivo</p>
            <div className="flex flex-wrap gap-1.5">
              {history.map((r) => (
                <button
                  key={r.reference}
                  type="button"
                  onClick={() => setSelected(r.reference)}
                  aria-pressed={r.reference === request.reference}
                  className={cn(
                    "h-[34px] rounded-full border border-line bg-surface px-4 text-[10.5px] font-extrabold uppercase tracking-[0.04em] transition-colors hover:border-ink",
                    r.reference === request.reference && "border-ink bg-ink text-white",
                  )}
                >
                  {r.reference}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Link href="/productos" className="inline-block text-[11px] font-extrabold uppercase tracking-[0.04em] underline underline-offset-4">
          Seguir viendo productos
        </Link>
      </div>

      <Card className="p-5">
        <label htmlFor={textId} className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.05em]">
          Mensaje completo
        </label>
        <textarea
          ref={textRef}
          id={textId}
          readOnly
          value={request.message}
          rows={Math.min(22, request.message.split("\n").length + 1)}
          className="w-full resize-y rounded-[12px] border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed text-ink focus-visible:border-ink focus-visible:outline-none"
        />
        <p className="mt-2 text-[11.5px] text-muted">Puedes revisarlo antes de enviarlo. El importe final lo confirma BLESH por WhatsApp.</p>
      </Card>
    </div>
  );
}
