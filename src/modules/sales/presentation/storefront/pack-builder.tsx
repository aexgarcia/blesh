"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { trackEvent } from "@/shared/analytics/track";
import { SIZE_SELECTION_EVENT, type SizeSelection } from "@/modules/catalog/contracts";
import { formatPEN } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";

import { packTotalMinor, type PackPolicy } from "../../domain/promotions";
import { useCart } from "./cart-context";
import { PackOptions } from "./pack-options";

type PackSize = { variantId: string; sku: string; sizeCode: string; sizeLabel: string; priceMinor: number; soldOut: boolean };
export type PackColor = { code: string; productSlug: string; productTitle: string; colorLabel: string; label: string; swatchHex: string | null; image: { url: string; alt: string } | null; sizes: PackSize[] };

type Row = { color: string | null; variantId: string | null };

const tierLabel = (tiers: readonly [number, number, number]) => tiers.map((t, i) => `${i + 1} x S/${t / 100}`).join(" · ");

/**
 * «Arma tu pack» (prototipo): hasta 3 prendas eligiendo color y talla. El precio mostrado es
 * la misma política que aplica el servidor al cotizar; el carrito agrega cada prenda por su
 * variante y el descuento se calcula de nuevo en el servidor.
 */
export function PackBuilder({ label, tierTotalsMinor, colors }: { label: string; tierTotalsMinor: readonly [number, number, number]; colors: PackColor[] }) {
  const cart = useCart();
  const multipleProducts = new Set(colors.map((c) => c.productSlug)).size > 1;
  const [rows, setRows] = useState<Row[]>([{ color: colors[0]?.code ?? null, variantId: null }, { color: null, variantId: null }, { color: null, variantId: null }]);
  const [sizeNotice, setSizeNotice] = useState<string | null>(null);
  useEffect(() => {
    const onSize = (event: Event) => {
      const detail = (event as CustomEvent<SizeSelection>).detail;
      if (!detail || typeof detail.productSlug !== "string" || typeof detail.sizeCode !== "string") return;
      let applied = 0;
      let unavailable = 0;
      const next = rows.map((row) => {
        const color = colors.find((c) => c.code === row.color);
        if (!color || color.productSlug !== detail.productSlug) return row;
        const size = color.sizes.find((s) => s.sizeCode === detail.sizeCode && !s.soldOut);
        if (!size) { unavailable++; return row; }
        applied++;
        return { ...row, variantId: size.variantId };
      });
      setRows(next);
      setSizeNotice(applied ? `Talla ${detail.sizeCode} aplicada a ${applied} ${applied === 1 ? "prenda" : "prendas"}.${unavailable ? " Revisa las otras prendas: esa talla no está disponible en su color." : ""}` : unavailable ? "La talla sugerida no está disponible para el color seleccionado. Elige otra talla o color." : "Selecciona primero una prenda de ese producto para aplicarle la talla.");
    };
    window.addEventListener(SIZE_SELECTION_EVENT, onSize);
    return () => window.removeEventListener(SIZE_SELECTION_EVENT, onSize);
  }, [colors, rows]);
  const policy = { tierTotalsMinor } as PackPolicy;
  const chosen = rows.filter((r) => r.color);
  const n = chosen.length;
  const full = chosen.reduce((sum, row) => {
    const sizes = colors.find((c) => c.code === row.color)?.sizes ?? [];
    return sum + (sizes.find((s) => s.variantId === row.variantId)?.priceMinor ?? Math.min(...sizes.map((s) => s.priceMinor)));
  }, 0);
  const price = n ? Math.min(full, packTotalMinor(policy, n)) : 0;
  const ready = n > 0 && chosen.every((r) => r.variantId);
  const colorOf = (code: string | null) => colors.find((c) => c.code === code) ?? null;

  function update(index: number, patch: Partial<Row>) {
    setSizeNotice(null);
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addPack() {
    for (const row of chosen) {
      const size = colorOf(row.color)?.sizes.find((s) => s.variantId === row.variantId);
      if (!size) continue;
      const result = cart.add({ variantId: size.variantId, quantity: 1, seenPriceMinor: size.priceMinor });
      if (result.added > 0) trackEvent({ name: "add_to_cart", items: [{ itemId: size.sku, itemName: label, itemVariant: colorOf(row.color)?.label, priceMinor: size.priceMinor, quantity: result.added }] });
    }
    cart.setOpen(true);
  }

  const visual = (n ? chosen : rows.slice(0, 1)).map((r) => colorOf(r.color)).filter((c): c is PackColor => c !== null);

  return (
    <div className={cn("grid gap-3 lg:grid-cols-[1.05fr_1fr]", multipleProducts ? "items-start" : "items-stretch")}>
      <div className={cn("relative grid min-w-0 overflow-hidden rounded-card bg-card", multipleProducts ? "h-[320px] sm:h-[400px] lg:sticky lg:top-[calc(var(--chrome-h,96px)+12px)] lg:h-[480px]" : "min-h-[280px] lg:min-h-[420px]")} style={{ gridTemplateColumns: `repeat(${Math.max(1, visual.length)}, 1fr)` }}>
        <span className="tag tag-light absolute left-3.5 top-3.5 z-[1]">{tierLabel(tierTotalsMinor)}</span>
        {visual.map((c, i) => (
          <div key={`${c.code}-${i}`} className="relative min-h-full">
            {c.image ? <Image src={c.image.url} alt={c.image.alt} fill sizes="(max-width: 1024px) 100vw, 30vw" className={multipleProducts ? "object-contain" : "object-cover"} /> : null}
          </div>
        ))}
        {!visual.length ? <div className="col-span-full grid h-full min-h-[280px] place-items-center px-6 text-center text-sm text-muted">Selecciona tus prendas para ver el pack.</div> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-[18px] rounded-card border border-line bg-surface p-5 sm:p-7">
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          {tierTotalsMinor.map((t, i) => (
            <div key={t} className={cn("rounded-[10px] border border-line p-3 text-center transition-colors", n === i + 1 && "border-ink bg-ink text-white")}>
              <b className="block text-[18px] font-black tracking-[-0.02em]">S/{t / 100}</b>
              <span className={cn("text-[10px] font-bold uppercase tracking-[0.04em]", n === i + 1 ? "text-white/70" : "text-muted")}>
                {i + 1} {i === 0 ? "prenda" : "prendas"}
              </span>
            </div>
          ))}
        </div>

        <div>
          {rows.map((row, i) => {
            const color = colorOf(row.color);
            return (
              <fieldset key={i} className="grid min-w-0 items-center gap-2 border-t border-line py-3 sm:grid-cols-[74px_minmax(0,1fr)_auto] sm:gap-3">
                <legend className="sr-only">Prenda {i + 1}</legend>
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start">
                  <span aria-hidden className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-muted">Prenda {i + 1}</span>
                  <button type="button" aria-label={`Quitar prenda ${i + 1}`} disabled={!row.color} onClick={() => update(i, { color: null, variantId: null })} className="min-h-8 text-[11px] text-muted underline underline-offset-2 hover:text-ink disabled:opacity-35">Quitar</button>
                </div>
                <PackOptions carousel={multipleProducts} label={`${multipleProducts ? "Producto y color" : "Color"} de la prenda ${i + 1}`}>
                  {colors.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      role="radio"
                      aria-checked={row.color === c.code}
                      aria-label={multipleProducts ? `${c.productTitle} · ${c.colorLabel}` : c.label}
                      title={`${c.productTitle} · ${c.colorLabel}`}
                      onClick={() => update(i, { color: row.color === c.code ? null : c.code, variantId: null })}
                      style={multipleProducts ? undefined : { background: c.swatchHex ?? "#ddd" }}
                      className={cn(
                        "relative shrink-0 border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink",
                        multipleProducts ? "flex w-24 flex-col items-center gap-2 rounded-xl bg-surface p-1.5 text-center transition-colors hover:border-ink" : "size-[30px] rounded-full border-line",
                        multipleProducts ? row.color === c.code ? "border-ink ring-1 ring-ink" : "border-line" : row.color === c.code && "after:absolute after:-inset-1 after:rounded-full after:border-[1.5px] after:border-ink",
                      )}
                    >
                      {multipleProducts ? <>
                        <span className="relative block h-16 w-full overflow-hidden rounded-lg bg-card">
                          {c.image ? <Image src={c.image.url} alt="" fill sizes="82px" className="object-contain" /> : <span aria-hidden className="grid h-full place-items-center text-xs text-muted">Sin foto</span>}
                        </span>
                        <span className="w-full text-[10px] leading-tight">
                          <span className="line-clamp-2 font-bold">{c.productTitle}</span>
                          <span className="mt-1 block text-muted">{c.colorLabel}</span>
                        </span>
                      </> : null}
                    </button>
                  ))}
                </PackOptions>
                <div className={cn("flex flex-wrap items-center gap-1.5", multipleProducts && "sm:max-w-32")} role="radiogroup" aria-label={`Talla de la prenda ${i + 1}`}>
                  {(color?.sizes ?? colors[0]?.sizes ?? []).map((s) => {
                    const active = row.variantId === s.variantId;
                    return (
                      <button
                        key={`${i}-${s.sizeLabel}`}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!color || s.soldOut}
                        onClick={() => update(i, { variantId: s.variantId })}
                        className={cn(
                          "grid h-8 min-w-9 place-items-center rounded-full border border-line bg-surface px-2.5 text-[11px] font-extrabold transition-colors hover:border-ink",
                          active && "border-ink bg-ink text-white",
                          "disabled:pointer-events-none disabled:bg-transparent disabled:text-[#b9b6b7] disabled:line-through",
                        )}
                      >
                        {s.sizeLabel}
                        {s.soldOut ? <span className="sr-only"> (agotada)</span> : null}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
        {sizeNotice ? <p role="status" className="rounded-xl border border-line p-3 text-xs text-muted">{sizeNotice}</p> : null}
        <button type="button" disabled={!n} onClick={() => { setRows(rows.map(() => ({ color: null, variantId: null }))); setSizeNotice(null); }} className="self-end text-[11px] font-bold text-muted underline underline-offset-2 hover:text-ink disabled:opacity-35">Limpiar selección</button>

        <div className="flex items-baseline justify-between border-t border-line pt-3.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.03em] text-sale">{full > price ? `Ahorras ${formatPEN(full - price)}` : ""}</span>
          <div className="tabular-nums" aria-live="polite">
            {full > price ? <s className="mr-2 text-muted">{formatPEN(full)}</s> : null}
            <strong className="text-[26px] font-black tracking-[-0.03em]">{formatPEN(price)}</strong>
          </div>
        </div>
        <Button block size="lg" disabled={!ready} onClick={addPack}>
          {ready ? `Agregar pack al carrito · ${formatPEN(price)}` : multipleProducts ? "Elige prenda, color y talla" : "Elige color y talla"}
        </Button>
        <p className="-mt-2 text-center text-[11px] text-muted">El descuento se confirma en tu carrito con los precios vigentes.</p>
      </div>
    </div>
  );
}
