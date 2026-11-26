"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { CartQuote } from "../../contracts";
import type { CartLine } from "../../domain/cart";
import { quoteCartAction } from "../storefront-actions";

type QuoteState = { key: string; quote: CartQuote | null; error: string | null };

const keyOf = (lines: readonly CartLine[]) => JSON.stringify(lines.map((l) => [l.variantId, l.quantity, l.seenPriceMinor ?? null]));

/**
 * Cotiza el carrito en el servidor cada vez que cambian sus líneas (con una pequeña espera).
 * `fresh`: la cotización corresponde exactamente a las líneas actuales; solo entonces se
 * puede enviar la solicitud con esos precios.
 */
export function useCartQuote(lines: readonly CartLine[], enabled: boolean) {
  const key = keyOf(lines);
  const [state, setState] = useState<QuoteState | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const payload = (JSON.parse(key) as [string, number, number | null][]).map(([variantId, quantity, seenPriceMinor]) => ({ variantId, quantity, seenPriceMinor }));
    if (!enabled || payload.length === 0) return;
    const id = ++seq.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await quoteCartAction(payload);
          if (id !== seq.current) return;
          setState(result.ok ? { key, quote: result.quote, error: null } : { key, quote: null, error: result.message });
        } catch {
          if (id === seq.current) setState({ key, quote: null, error: "No pudimos actualizar tu carrito. Revisa tu conexión e inténtalo de nuevo." });
        }
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [key, enabled, retry]);

  /** Usa la cotización que devolvió el servidor al rechazar un envío (QUOTE_CHANGED). */
  const replaceQuote = useCallback((quote: CartQuote, forLines: readonly CartLine[]) => setState({ key: keyOf(forLines), quote, error: null }), []);
  const reload = useCallback(() => setRetry((n) => n + 1), []);

  const fresh = state?.key === key;
  return { quote: state?.quote ?? null, error: fresh ? (state?.error ?? null) : null, fresh: fresh && !pending, loading: pending || !fresh, replaceQuote, reload };
}
