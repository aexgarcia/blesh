"use client";

import { CART_STORAGE_KEY, EMPTY_CART, parseStoredCart, serializeCart, type CartState } from "../../domain/cart";
import { parseRequestHistory, REQUEST_HISTORY_KEY, type StoredRequest } from "../../domain/request-history";

/**
 * Almacenes del navegador (localStorage) para `useSyncExternalStore`. Si el almacenamiento
 * no está disponible (modo privado, cuota), se usa memoria: la compra sigue funcionando.
 * Se sincronizan entre pestañas con el evento `storage`.
 */

type Listener = () => void;

function createStore<T>(key: string, parse: (raw: string | null) => T, serialize: (value: T) => string, fallback: T) {
  const listeners = new Set<Listener>();
  let memory: string | null = null;
  let cache: { raw: string | null; value: T } | null = null;

  const readRaw = (): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory;
    }
  };

  const get = (): T => {
    const raw = readRaw();
    if (!cache || cache.raw !== raw) cache = { raw, value: parse(raw) };
    return cache.value;
  };

  const set = (value: T) => {
    const raw = serialize(value);
    memory = raw;
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      // Sin almacenamiento: queda en memoria de esta pestaña.
    }
    cache = { raw, value };
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  return { get, set, subscribe, getServerSnapshot: () => fallback };
}

export const cartStore = createStore<CartState>(CART_STORAGE_KEY, parseStoredCart, serializeCart, EMPTY_CART);

const NO_REQUESTS: StoredRequest[] = [];
export const requestHistoryStore = createStore<StoredRequest[]>(
  REQUEST_HISTORY_KEY,
  (raw) => {
    const parsed = parseRequestHistory(raw, new Date());
    return parsed.length ? parsed : NO_REQUESTS;
  },
  (value) => JSON.stringify(value),
  NO_REQUESTS,
);
