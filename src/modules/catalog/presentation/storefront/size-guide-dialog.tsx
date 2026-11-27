"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Field, Select } from "@/shared/ui/form";

import { SIZE_SELECTION_EVENT, type ProductSizeGuide, type SizeGuideData, type SizeSelection } from "../../contracts";
import { SizeCalculator } from "./size-calculator";

/** «¿Qué talla me va?»: guía de tallas en un diálogo accesible. */
export function SizeGuideDialog({ whatsappHref = null, guide, products, productSlug = "", productTitle, availableSizes, label = "¿Qué talla me va?", className = "-mt-2 self-start text-[11px] font-extrabold uppercase tracking-[0.03em] underline underline-offset-[3px]" }: {
  guide?: SizeGuideData | null;
  whatsappHref?: string | null;
  products?: ProductSizeGuide[];
  productSlug?: string;
  productTitle?: string;
  availableSizes?: string[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const options: ProductSizeGuide[] = products?.length ? products : guide ? [{ productSlug, productTitle: productTitle ?? guide.name, guide, availableSizes: availableSizes ?? guide.rows.map((r) => r.sizeCode) }] : [];
  const [selected, setSelected] = useState(options[0]?.productSlug ?? "");
  const current = options.find((p) => p.productSlug === selected) ?? options[0];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={className}>{label}</DialogTrigger>
      <DialogContent title="Encuentra tu talla" description="Compara una prenda que ya te queda bien. Medidas en centímetros." className="max-w-lg">
        {options.length > 1 ? <div className="mb-5"><Field label="¿Para qué producto?">{(a) => <Select {...a} value={current.productSlug} onChange={(e) => setSelected(e.target.value)}>{options.map((p) => <option key={p.productSlug} value={p.productSlug}>{p.productTitle}</option>)}</Select>}</Field></div> : null}
        {current?.guide ? <SizeCalculator key={`${current.productSlug}:${JSON.stringify(current.guide)}`} product={{ ...current, guide: current.guide }} whatsappHref={whatsappHref} onUse={(sizeCode) => {
          window.dispatchEvent(new CustomEvent<SizeSelection>(SIZE_SELECTION_EVENT, { detail: { productSlug: current.productSlug, sizeCode } }));
          setOpen(false);
        }} /> : <div className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed"><p className="font-bold">Guía de {current?.productTitle ?? "este producto"} en preparación</p><p className="mt-2 text-muted">Aún no hay medidas asignadas a esta prenda. Por ahora no podemos calcular una talla orientativa; confirma sus medidas al coordinar la solicitud.</p></div>}
      </DialogContent>
    </Dialog>
  );
}
