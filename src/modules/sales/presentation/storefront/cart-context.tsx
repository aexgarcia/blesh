"use client";

import { createContext, use, useCallback, useMemo, useState, useSyncExternalStore } from "react";

import type { OrderingStatus } from "../../contracts";
import { acceptPrices, addToCart, cartUnits, removeLine, setQuantity, type AddResult, type CartLine, type CartState } from "../../domain/cart";
import { cartStore } from "./browser-store";

type CartContextValue = {
  /** false hasta leer el almacenamiento del navegador (evita parpadeos de "vacío"). */
  hydrated: boolean;
  cart: CartState;
  units: number;
  ordering: OrderingStatus;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (line: CartLine) => AddResult;
  setLineQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  acceptQuotedPrices: (prices: ReadonlyMap<string, number>) => void;
  /** Clave de idempotencia de la solicitud en curso (se crea y guarda si no existe). */
  ensureRequestKey: () => string;
  /** Nueva intención (p. ej. tras conflicto de clave). */
  rotateRequestKey: () => string;
  /** Solicitud registrada: vacía el carrito y olvida la clave. */
  clearAfterRequest: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const subscribeHydration = () => () => undefined;

export function CartProvider({ ordering, children }: { ordering: OrderingStatus; children: React.ReactNode }) {
  const cart = useSyncExternalStore(cartStore.subscribe, cartStore.get, cartStore.getServerSnapshot);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [open, setOpen] = useState(false);

  const add = useCallback((line: CartLine) => {
    const result = addToCart(cartStore.get(), line);
    if (result.added > 0) cartStore.set(result.state);
    return result;
  }, []);
  const setLineQuantity = useCallback((variantId: string, quantity: number) => cartStore.set(setQuantity(cartStore.get(), variantId, quantity)), []);
  const remove = useCallback((variantId: string) => cartStore.set(removeLine(cartStore.get(), variantId)), []);
  const acceptQuotedPrices = useCallback((prices: ReadonlyMap<string, number>) => cartStore.set(acceptPrices(cartStore.get(), prices)), []);
  const rotateRequestKey = useCallback(() => {
    const requestKey = crypto.randomUUID();
    cartStore.set({ ...cartStore.get(), requestKey });
    return requestKey;
  }, []);
  const ensureRequestKey = useCallback(() => cartStore.get().requestKey ?? rotateRequestKey(), [rotateRequestKey]);
  const clearAfterRequest = useCallback(() => cartStore.set({ lines: [] }), []);

  const value = useMemo(
    () => ({
      hydrated,
      cart,
      units: cartUnits(cart),
      ordering,
      open,
      setOpen,
      add,
      setLineQuantity,
      remove,
      acceptQuotedPrices,
      ensureRequestKey,
      rotateRequestKey,
      clearAfterRequest,
    }),
    [hydrated, cart, ordering, open, add, setLineQuantity, remove, acceptQuotedPrices, ensureRequestKey, rotateRequestKey, clearAfterRequest],
  );
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart requiere <CartProvider>.");
  return value;
}
