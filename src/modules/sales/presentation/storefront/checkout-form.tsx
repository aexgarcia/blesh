"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { welcomeCoupon } from "@/shared/coupon/welcome-coupon";

import { formatPEN } from "@/shared/domain/money";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Field, Input } from "@/shared/ui/form";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Alert, Badge } from "@/shared/ui/surface";
import { useActionForm } from "@/shared/ui/use-action-form";

import { DELIVERY_MODES, REQUEST_TERMS, type CartQuote, type DeliveryMode, type OrderingStatus } from "../../contracts";
import { submitRequestAction, type RequestFormState } from "../storefront-actions";

const DELIVERY_OPTIONS: Record<DeliveryMode, { label: string; hint: string }> = {
  pickup: { label: "Recojo en tienda", hint: "Coordinamos sede y horario." },
  shipping: { label: "Envío", hint: "La dirección y el costo se acuerdan después." },
  undecided: { label: "Aún no lo sé", hint: "Lo vemos por WhatsApp." },
};

/**
 * Datos mínimos de la solicitud (nombre, preferencia opcional y condiciones). El celular
 * no se pide: la persona escribe desde su WhatsApp.
 * La clave de idempotencia es la de la intención en curso, guardada con el carrito: un
 * reintento o doble clic devuelve la misma solicitud.
 */
export function CheckoutForm({ quote, ordering, creationKey, onBack, onResult }: {
  quote: CartQuote;
  ordering: OrderingStatus;
  creationKey: string;
  onBack: () => void;
  /** `whatsapp`: pestaña abierta en el clic de envío (el navegador solo permite abrirla con el gesto). */
  onResult: (state: RequestFormState, whatsapp: Window | null) => void;
}) {
  const whatsappTab = useRef<Window | null>(null);
  const [delivery, setDelivery] = useState<DeliveryMode>("undecided");
  const coupon = useSyncExternalStore(welcomeCoupon.subscribe, welcomeCoupon.get, welcomeCoupon.getServerSnapshot);
  const { state, onSubmit, pending } = useActionForm<RequestFormState>(
    async (prev, formData) => {
      let next: RequestFormState;
      try {
        next = await submitRequestAction(prev, formData);
      } catch {
        // Red o servidor caídos: la clave se conserva y el reintento no duplica la solicitud.
        next = { status: "error", code: "UNAVAILABLE", message: "No pudimos registrar tu solicitud ahora. Revisa tu conexión y vuelve a intentarlo: no se duplicará." };
      }
      const tab = whatsappTab.current;
      whatsappTab.current = null;
      onResult(next, tab);
      return next;
    },
    { toastOnSuccess: false },
  );
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const formRef = useRef<HTMLFormElement>(null);
  // Tras un envío con errores, el foco va al primer campo inválido (teclado y lector de pantalla).
  useEffect(() => {
    if (state.status === "error" && state.fieldErrors) formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [state]);
  const accepted = quote.lines
    .filter((l) => l.item)
    .map((l) => ({ variantId: l.variantId, quantity: l.quantity, acceptedPriceMinor: l.item!.unitPriceMinor }));

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        // Se abre ya (gesto del usuario) y se dirige a WhatsApp cuando la solicitud quede guardada.
        if (!pending && !whatsappTab.current) whatsappTab.current = window.open("", "_blank");
        onSubmit(event);
      }}
      className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden /> Volver al carrito
        </button>

        <div className="flex items-baseline justify-between rounded-[12px] border border-line bg-surface px-4 py-3">
          <span className="text-[12px] text-muted">
            {quote.units} {quote.units === 1 ? "prenda" : "prendas"} · envío por acordar
          </span>
          <span className="text-[15px] font-black tabular-nums">{formatPEN(quote.totalMinor)}</span>
        </div>

        {ordering.testMode ? (
          <Alert tone="warning" title="Entorno de prueba">
            El número de WhatsApp y las condiciones son de prueba. No se atienden pedidos reales.
          </Alert>
        ) : null}
        {state.status === "error" && state.message && !state.fieldErrors ? <Alert tone="danger">{state.message}</Alert> : null}

        <input type="hidden" name="lines" value={JSON.stringify(accepted)} />
        <input type="hidden" name="creationKey" value={creationKey} />
        <input type="hidden" name="acceptedTotalMinor" value={quote.totalMinor} />
        <input type="hidden" name="termsVersion" value={REQUEST_TERMS.version} />
        {coupon ? <input type="hidden" name="couponCode" value={coupon} /> : null}
        {coupon ? (
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-dashed border-ink px-4 py-3 text-[12.5px]">
            <span>Cupón <b className="tracking-[0.04em]">{coupon}</b>: lo enviamos en tu mensaje y se aplica al coordinar.</span>
            <button type="button" onClick={welcomeCoupon.clear} className="shrink-0 text-[11px] font-bold underline">Quitar</button>
          </div>
        ) : null}

        <Field label="Nombre" error={errors.customerName}>
          {(a) => <Input {...a} name="customerName" autoComplete="name" maxLength={120} required />}
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em]">
            Entrega <span className="font-semibold normal-case tracking-normal text-muted">(opcional)</span>
          </legend>
          <div className="grid gap-2">
            {DELIVERY_MODES.map((mode) => (
              <label
                key={mode}
                className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line bg-surface px-3.5 py-3 has-checked:border-ink has-focus-visible:ring-2 has-focus-visible:ring-ink/20"
              >
                <input
                  type="radio"
                  name="deliveryPreference"
                  value={mode}
                  checked={delivery === mode}
                  onChange={() => setDelivery(mode)}
                  className="mt-0.5 size-4 accent-ink"
                />
                <span>
                  <span className="block text-[13px] font-bold">{DELIVERY_OPTIONS[mode].label}</span>
                  <span className="block text-[12px] text-muted">{DELIVERY_OPTIONS[mode].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2 rounded-[12px] border border-line bg-surface px-4 py-3.5">
          <Dialog>
            <div className="flex items-start gap-2.5 text-[13px] font-semibold">
              <input
                id="accepted-terms"
                type="checkbox"
                name="acceptedTerms"
                className="mt-0.5 size-4 accent-ink"
                aria-invalid={errors.acceptedTerms ? true : undefined}
                aria-describedby={errors.acceptedTerms ? "terms-error" : undefined}
              />
              <span>
                <label htmlFor="accepted-terms" className="cursor-pointer">Acepto las </label>
                <DialogTrigger className="underline underline-offset-2 hover:text-ink/70">términos y condiciones</DialogTrigger>
                {REQUEST_TERMS.status === "draft" ? <Badge tone="warning" className="ml-2 align-middle">Borrador</Badge> : null}
              </span>
            </div>
            <DialogContent title="Términos y condiciones">
              <ul className="list-disc space-y-2 pl-4 text-[13px] leading-snug text-ink/80">
                {REQUEST_TERMS.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {REQUEST_TERMS.status === "draft" ? (
                <p className="mt-4 text-[11.5px] text-muted">Versión en revisión. Las políticas completas de entrega, cambios y privacidad se publicarán antes de vender.</p>
              ) : null}
              <a href="/terminos-y-condiciones" target="_blank" rel="noopener" className="mt-4 inline-block text-[12px] font-bold underline">Ver página completa</a>
              <DialogClose className="mt-5 min-h-11 w-full rounded-full bg-ink px-5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-white hover:bg-ink/90">Entendido</DialogClose>
            </DialogContent>
          </Dialog>
          {errors.acceptedTerms ? (
            <p id="terms-error" className="text-[12px] font-semibold text-sale">
              {errors.acceptedTerms}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-line px-5 py-4">
        <SubmitButton block size="lg" pending={pending} pendingLabel="Registrando solicitud…">
          Registrar solicitud
        </SubmitButton>
        <p className="text-center text-[11.5px] text-muted">Guardamos tu solicitud y abrimos WhatsApp con el mensaje listo para enviar.</p>
      </div>
    </form>
  );
}
