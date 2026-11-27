"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { trackEvent } from "@/shared/analytics/track";
import { formatPEN } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { Dialog, SheetContent } from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Alert } from "@/shared/ui/surface";

import type { CartQuote } from "../../contracts";
import { packTotalMinor, type PackPolicy } from "../../domain/promotions";
import { markOpened, rememberRequest } from "../../domain/request-history";
import type { RequestFormState } from "../storefront-actions";
import { requestHistoryStore } from "./browser-store";
import { useCart } from "./cart-context";
import { CartLineRow } from "./cart-line";
import { CheckoutForm } from "./checkout-form";
import { useCartQuote } from "./use-cart-quote";
import { quotedAnalyticsItems } from "./quote-analytics";

/** Carrito (panel lateral): revisión cotizada en servidor → datos de la solicitud. */
export function CartSheet() {
  const cart = useCart();
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [notice, setNotice] = useState<string | null>(null);
  const [creationKey, setCreationKey] = useState<string | null>(null);
  const { quote, error, fresh, loading, replaceQuote, reload } = useCartQuote(cart.cart.lines, cart.open);
  const viewedRef = useRef(false);

  const empty = cart.hydrated && cart.cart.lines.length === 0;
  const priceChanges = quote?.lines.filter((l) => l.previousPriceMinor !== null && l.item) ?? [];
  const canContinue = fresh && quote?.ready === true && cart.ordering.enabled;

  useEffect(() => {
    if (!cart.open) viewedRef.current = false;
    else if (fresh && quote && !viewedRef.current) {
      viewedRef.current = true;
      trackEvent({ name: "view_cart", items: quotedAnalyticsItems(quote), valueMinor: quote.totalMinor });
    }
  }, [cart.open, fresh, quote]);

  function onOpenChange(open: boolean) {
    cart.setOpen(open);
    if (!open) {
      setStep("cart");
      setNotice(null);
    }
  }

  function acceptPrices() {
    if (!quote) return;
    cart.acceptQuotedPrices(new Map(quote.lines.filter((l) => l.item).map((l) => [l.variantId, l.item!.unitPriceMinor])));
    setNotice(null);
  }

  function onResult(state: RequestFormState, whatsapp: Window | null) {
    if (state.status === "success" && state.receipt) {
      const r = state.receipt;
      const opened = openWhatsApp(whatsapp, r.whatsappUrl ?? r.whatsappChatUrl);
      requestHistoryStore.set(
        rememberRequest(requestHistoryStore.get(), {
          reference: r.reference,
          message: r.message,
          whatsappUrl: r.whatsappUrl,
          whatsappChatUrl: r.whatsappChatUrl,
          subtotalMinor: r.subtotalMinor,
          totalMinor: r.totalMinor,
          units: r.units,
          savedAt: new Date().toISOString(),
          opened: false,
        }),
      );
      if (opened) {
        requestHistoryStore.set(markOpened(requestHistoryStore.get(), r.reference));
        trackEvent({ name: "whatsapp_click", placement: "request_success", itemCount: r.units });
      }
      // Un reintento que recupera la misma solicitud no vuelve a contar la intención.
      if (!state.replayed) trackEvent({ name: "order_request_created", valueMinor: r.totalMinor, itemCount: r.units });
      cart.clearAfterRequest();
      onOpenChange(false);
      // Navegación completa: el éxito contiene resumen local y no debe conservar listeners GA.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Aislamiento de analítica: destruir etiqueta y listeners al entrar en la solicitud privada.
      window.location.assign("/solicitud");
      return;
    }
    whatsapp?.close();
    if (state.code === "QUOTE_CHANGED" && state.quote) {
      replaceQuote(state.quote, cart.cart.lines);
      setNotice(state.message ?? "Tu carrito cambió.");
      setStep("cart");
    } else if (state.code === "IDEMPOTENCY_CONFLICT") {
      setCreationKey(cart.rotateRequestKey());
      setNotice("Ya habías registrado una solicitud con otros datos desde este carrito. Revisa y vuelve a enviar para registrar una nueva.");
      setStep("cart");
    }
  }

  return (
    <Dialog open={cart.open} onOpenChange={onOpenChange}>
      <SheetContent
        title={step === "cart" ? `Tu carrito${cart.units ? ` (${cart.units})` : ""}` : "Datos de la solicitud"}
        description={step === "cart" ? "Precios en soles. El envío se acuerda por WhatsApp." : "Solo lo necesario para coordinar contigo."}
      >
        {step === "checkout" && quote && canContinue && creationKey ? (
          <CheckoutForm quote={quote} ordering={cart.ordering} creationKey={creationKey} onBack={() => setStep("cart")} onResult={onResult} />
        ) : empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-card">
              <ShoppingBag className="size-5" aria-hidden />
            </div>
            <p className="text-muted">Tu carrito está vacío.</p>
            <Button asChild>
              <Link href="/productos" onClick={() => onOpenChange(false)}>
                Ver productos
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {quote?.pack ? <PackProgress pack={quote.pack} /> : null}
            <div className="flex-1 overflow-y-auto px-5" aria-busy={loading}>
              {notice ? (
                <Alert tone="warning" className="mt-4">
                  {notice}
                </Alert>
              ) : null}
              {error ? (
                <div className="mt-4 space-y-2">
                  <Alert tone="danger">{error}</Alert>
                  <Button size="sm" variant="secondary" onClick={reload}>
                    Reintentar
                  </Button>
                </div>
              ) : null}
              {quote ? (
                <ul aria-label="Productos del carrito">
                  {quote.lines.filter((line) => cart.cart.lines.some((l) => l.variantId === line.variantId)).map((line) => (
                    <CartLineRow
                      key={line.variantId}
                      line={{ ...line, quantity: cart.cart.lines.find((l) => l.variantId === line.variantId)?.quantity ?? line.quantity }}
                      onQuantity={(q) => {
                        if (q < line.quantity && line.item) {
                          trackEvent({ name: "remove_from_cart", items: [{ itemId: line.item.sku, itemName: line.item.productTitle, itemVariant: line.item.colorLabel, priceMinor: line.item.unitPriceMinor, quantity: line.quantity - q }] });
                        }
                        cart.setLineQuantity(line.variantId, q);
                      }}
                      onRemove={() => {
                        if (line.item) {
                          trackEvent({ name: "remove_from_cart", items: [{ itemId: line.item.sku, itemName: line.item.productTitle, itemVariant: line.item.colorLabel, priceMinor: line.item.unitPriceMinor, quantity: line.quantity }] });
                        }
                        cart.remove(line.variantId);
                      }}
                      onNavigate={() => onOpenChange(false)}
                    />
                  ))}
                </ul>
              ) : !error ? (
                <div className="space-y-4 py-4" aria-label="Cargando carrito">
                  {cart.cart.lines.map((l) => (
                    <div key={l.variantId} className="grid grid-cols-[72px_1fr] gap-3">
                      <Skeleton className="aspect-[4/5] rounded-[10px]" />
                      <div className="space-y-2 pt-1">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-2.5 border-t border-line px-5 pb-5 pt-4">
              {priceChanges.length > 0 && fresh ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-warning/25 bg-warning/5 px-3.5 py-2.5 text-[12px] font-semibold text-warning">
                  <span>Algunos precios cambiaron. Revísalos antes de continuar.</span>
                  <Button size="sm" variant="secondary" onClick={acceptPrices}>
                    Aceptar precios actuales
                  </Button>
                </div>
              ) : null}
              <div className="flex justify-between text-[13px]">
                <span>Subtotal productos</span>
                <span className="tabular-nums">{quote ? formatPEN(quote.subtotalMinor) : "—"}</span>
              </div>
              {quote && quote.promotionMinor > 0 ? (
                <div className="flex justify-between text-[13px] text-sale">
                  <span>Descuento {quote.promotionLabel ?? "pack"}</span>
                  <span className="tabular-nums">− {formatPEN(quote.promotionMinor)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-[13px]">
                <span>Envío</span>
                <span>Por acordar</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold">Total provisional</span>
                <strong className="text-[18px] font-black tabular-nums" aria-live="polite">
                  {quote ? formatPEN(quote.totalMinor) : "—"}
                </strong>
              </div>
              {!cart.ordering.enabled ? <Alert tone="info">{cart.ordering.reason}</Alert> : null}
              <Button
                block
                size="lg"
                disabled={!canContinue}
                onClick={() => {
                  setCreationKey(cart.ensureRequestKey());
                  setStep("checkout");
                }}
              >
                {loading && cart.cart.lines.length > 0 ? "Actualizando…" : "Consultar pedido por WhatsApp"}
              </Button>
              <p className="text-center text-[11px] text-muted">
                Registramos tu solicitud y la coordinas por WhatsApp. No se cobra nada en la web y nada queda reservado hasta que BLESH confirme.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Dialog>
  );
}

/** Progreso del pack (prototipo `.drawer__ship`): cuántas prendas faltan para el siguiente precio. */
function PackProgress({ pack }: { pack: NonNullable<CartQuote["pack"]> }) {
  const policy = { tierTotalsMinor: pack.tierTotalsMinor } as PackPolicy;
  const toNext = pack.units % 3 === 0 ? 0 : 3 - (pack.units % 3);
  const tiers = `2 x S/${pack.tierTotalsMinor[1] / 100} · 3 x S/${pack.tierTotalsMinor[2] / 100}`;
  return (
    <div className="mx-5 mt-3.5 rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[11.5px]">
      {pack.units === 0 ? (
        <p>
          <b>{pack.label}:</b> {tiers}
        </p>
      ) : toNext ? (
        <p>
          Agrega <b>{toNext} más</b> y paga {formatPEN(packTotalMinor(policy, pack.units + toNext))} por {pack.units + toNext}.
        </p>
      ) : (
        <p>
          <b>¡Pack completo!</b> El descuento se aplica en tu solicitud.
        </p>
      )}
      {pack.units > 0 ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <i className="block h-full bg-ink transition-[width] duration-400" style={{ width: `${toNext ? ((pack.units % 3) / 3) * 100 : 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Dirige la pestaña abierta en el clic a WhatsApp. Si el navegador la bloqueó, la pantalla de solicitud ofrece el botón. */
function openWhatsApp(tab: Window | null, url: string): boolean {
  if (!tab || tab.closed) return false;
  try {
    tab.opener = null;
    tab.location.href = url;
    return true;
  } catch {
    tab.close();
    return false;
  }
}
