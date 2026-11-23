"use client";

import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { formatPEN } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/form";

import { MAX_UNITS_PER_LINE } from "../../contracts";
import { searchVariantsAction, type VariantOption } from "../actions";

export type PickedLine = { variantId: string; label: string; sku: string; priceMinor: number; quantity: number };

/**
 * Líneas del pedido: buscar por título, color o SKU y fijar cantidades.
 * Los precios mostrados son orientativos: el servidor vuelve a cotizar al guardar.
 */
export function LinePicker({ name = "lines", initial = [], error }: { name?: string; initial?: PickedLine[]; error?: string }) {
  const [lines, setLines] = useState<PickedLine[]>(initial);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<VariantOption[] | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    if (!term.trim()) return;
    startTransition(async () => setOptions(await searchVariantsAction(term)));
  }

  function add(option: VariantOption) {
    setLines((current) =>
      current.some((l) => l.variantId === option.variantId)
        ? current.map((l) => (l.variantId === option.variantId ? { ...l, quantity: Math.min(MAX_UNITS_PER_LINE, l.quantity + 1) } : l))
        : [...current, { variantId: option.variantId, label: option.label, sku: option.sku, priceMinor: option.priceMinor, quantity: 1 }],
    );
  }

  const setQuantity = (variantId: string, quantity: number) =>
    setLines((current) => current.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(MAX_UNITS_PER_LINE, quantity)) } : l)));
  const subtotal = lines.reduce((s, l) => s + l.priceMinor * l.quantity, 0);

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })))} />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            aria-label="Buscar producto, color o SKU"
            placeholder="Buscar producto, color o SKU"
            className="pl-10"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={search} disabled={pending}>
          {pending ? "Buscando…" : "Buscar"}
        </Button>
      </div>

      {options ? (
        <ul className="max-h-56 overflow-y-auto rounded-[12px] border border-line bg-surface" aria-label="Resultados">
          {options.length === 0 ? <li className="px-4 py-3 text-[13px] text-muted">Sin resultados publicados.</li> : null}
          {options.map((o) => (
            <li key={o.variantId} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
              <span>
                <span className="font-bold">{o.label}</span>
                <span className="block text-[12px] text-muted">
                  {o.sku} · {formatPEN(o.priceMinor)} · {o.available === null ? "sin stock registrado" : `${o.available} disponible(s)`}
                </span>
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={() => add(o)} aria-label={`Agregar ${o.label}`}>
                <Plus aria-hidden /> Agregar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {lines.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-muted">Aún no hay productos en el pedido.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[12px] border border-line">
          {lines.map((l) => (
            <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px]">
              <span className="min-w-40 flex-1">
                <span className="font-bold">{l.label}</span>
                <span className="block text-[12px] text-muted">
                  {l.sku} · {formatPEN(l.priceMinor)} c/u
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Quitar una" onClick={() => setQuantity(l.variantId, l.quantity - 1)}>
                  <Minus aria-hidden />
                </Button>
                <span className="w-6 text-center font-extrabold tabular-nums" aria-label="Cantidad">
                  {l.quantity}
                </span>
                <Button type="button" size="icon" variant="ghost" aria-label="Agregar una" onClick={() => setQuantity(l.variantId, l.quantity + 1)}>
                  <Plus aria-hidden />
                </Button>
              </span>
              <span className="w-24 text-right font-extrabold tabular-nums">{formatPEN(l.priceMinor * l.quantity)}</span>
              <Button type="button" size="icon" variant="ghost" aria-label={`Quitar ${l.label}`} onClick={() => setLines((c) => c.filter((x) => x.variantId !== l.variantId))}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
          <li className="flex justify-between px-4 py-3 text-[13px]">
            <span className="text-muted">Subtotal orientativo</span>
            <span className="font-extrabold tabular-nums">{formatPEN(subtotal)}</span>
          </li>
        </ul>
      )}
      {error ? <p className="text-[12px] font-semibold text-sale">{error}</p> : null}
    </div>
  );
}
