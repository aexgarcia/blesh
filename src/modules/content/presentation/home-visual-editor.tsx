"use client";

import Image from "next/image";
import { useState } from "react";

import { saveStoreVisualsAction } from "@/composition/storefront-actions";
import { Button } from "@/shared/ui/button";
import { Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { Card } from "@/shared/ui/surface";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { CollectionEntry, SectionSnapshot } from "../contracts";

export type VisualEditorOptions = {
  assets: { key: string; kind: "video" | "image" }[]; assetBase: string;
  categories: { slug: string; name: string }[]; products: { slug: string; title: string; status: string }[];
};
function Target({ value, onChange, options, anchors = false }: { value: string; onChange: (value: string) => void; options: VisualEditorOptions; anchors?: boolean }) {
  const targets = [{ href: "/productos", label: "Todas las prendas" },
    ...(anchors ? [{ href: "#drop", label: "Nuevos ingresos" }, { href: "#productos", label: "Todas las prendas (inicio)" }, { href: "#pack", label: "Arma tu pack" }, { href: "#movimiento", label: "En movimiento" }] : []),
    ...options.categories.map((c) => ({ href: `/categorias/${c.slug}`, label: `Categoría: ${c.name}` })),
    ...options.products.filter((p) => p.status === "published").map((p) => ({ href: `/productos/${p.slug}`, label: `Producto: ${p.title}` })),
  ];
  return <Field label="Destino del enlace">{(a) => <Select {...a} value={value} onChange={(e) => onChange(e.target.value)}>
    {targets.map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}
    {!targets.some((t) => t.href === value) ? <option value={value}>{value || "Selecciona un destino"} (no disponible)</option> : null}
  </Select>}</Field>;
}
function Picture({ value, alt, onChange, onAlt, options, optional = false }: { value: string; alt: string; onChange: (value: string) => void; onAlt: (value: string) => void; options: VisualEditorOptions; optional?: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-card">{value ? <Image src={`${options.assetBase}${value}`} alt={alt || "Vista previa"} fill sizes="160px" className="object-cover" /> : <span className="p-3 text-xs text-muted">Sin imagen</span>}</div>
    <div className="min-w-0 space-y-4"><Field label="Imagen de biblioteca">{(a) => <Select {...a} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{optional ? "Sin imagen (fondo de marca)" : "Selecciona una imagen"}</option>
      {options.assets.filter((asset) => asset.kind === "image").map((asset) => <option key={asset.key} value={asset.key}>{asset.key}</option>)}
      {value && !options.assets.some((asset) => asset.key === value) ? <option value={value}>{value} (no disponible)</option> : null}
    </Select>}</Field>
    <Field label="Descripción de la imagen" hint="Describe la prenda o escena para quienes no pueden ver la imagen.">{(a) => <Input {...a} value={alt} onChange={(e) => onAlt(e.target.value)} maxLength={200} />}</Field></div>
  </div>;
}

export function HeroEditor({ section, operationKey: initialKey, options }: { section: SectionSnapshot<"hero">; operationKey: string; options: VisualEditorOptions }) {
  const [data, setData] = useState(section.data);
  const [operationKey] = useState(initialKey);
  const { state, onSubmit, pending } = useActionForm(saveStoreVisualsAction);
  return <Card className="p-5 md:p-7"><h2 className="text-xl font-black">Portada</h2>
    <p className="mt-2 text-sm text-muted">Imagen principal y mensaje de bienvenida. Si el destino del botón deja de estar disponible, llevará a Todas las prendas.</p>
    <form aria-label="Portada" onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
      <input type="hidden" name="section" value="hero" /><input type="hidden" name="data" value={JSON.stringify(data)} />
      <input type="hidden" name="operationKey" value={operationKey} /><input type="hidden" name="expectedVersion" value={section.version} />
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={data.enabled} onChange={(e) => setData({ ...data, enabled: e.target.checked })} /> Mostrar portada</label>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Título de portada">{(a) => <Input {...a} value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} maxLength={100} />}</Field>
      <Field label="Texto superior">{(a) => <Input {...a} value={data.eyebrow} onChange={(e) => setData({ ...data, eyebrow: e.target.value })} maxLength={150} />}</Field></div>
      <Picture options={options} value={data.imageKey} alt={data.imageAlt} optional onChange={(imageKey) => setData({ ...data, imageKey })} onAlt={(imageAlt) => setData({ ...data, imageAlt })} />
      <div className="grid gap-4 md:grid-cols-2"><Field label="Texto del botón">{(a) => <Input {...a} value={data.ctaLabel} onChange={(e) => setData({ ...data, ctaLabel: e.target.value })} maxLength={60} />}</Field>
      <Target value={data.ctaHref} onChange={(ctaHref) => setData({ ...data, ctaHref })} options={options} anchors /></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Detalles inferiores" hint="Hasta 4 textos, uno por línea. Publica solo características confirmadas.">{(a) => <Textarea {...a} defaultValue={data.meta.join("\n")} onChange={(e) => setData({ ...data, meta: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} rows={4} />}</Field>
      <Field label="Texto inferior derecho">{(a) => <Input {...a} value={data.metaRight} onChange={(e) => setData({ ...data, metaRight: e.target.value })} maxLength={150} />}</Field></div>
      <FormMessage state={state} /><Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar portada y publicar"}</Button>
    </form></Card>;
}

export function CollectionsEditor({ section, operationKey: initialKey, options }: { section: SectionSnapshot<"collections">; operationKey: string; options: VisualEditorOptions }) {
  const [data, setData] = useState(section.data);
  const [operationKey] = useState(initialKey);
  const { state, onSubmit, pending } = useActionForm(saveStoreVisualsAction);
  const patch = (id: string, update: Partial<CollectionEntry>) => setData((previous) => ({ ...previous, items: previous.items.map((item) => item.id === id ? { ...item, ...update } : item) }));
  function move(index: number, direction: number) {
    setData((previous) => { const items = [...previous.items]; [items[index], items[index + direction]] = [items[index + direction], items[index]]; return { ...previous, items }; });
  }
  return <Card className="p-5 md:p-7"><h2 className="text-xl font-black">Colecciones</h2>
    <p className="mt-2 text-sm text-muted">Hasta 8 tarjetas debajo de Todas las prendas. Si desactivas una categoría o archivas el producto enlazado, su tarjeta se oculta hasta corregir el destino.</p>
    <form aria-label="Colecciones" onSubmit={onSubmit} className="mt-5 space-y-5" noValidate>
      <input type="hidden" name="section" value="collections" /><input type="hidden" name="data" value={JSON.stringify(data)} />
      <input type="hidden" name="operationKey" value={operationKey} /><input type="hidden" name="expectedVersion" value={section.version} />
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={data.enabled} onChange={(e) => setData({ ...data, enabled: e.target.checked })} /> Mostrar colecciones</label>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Título de la sección">{(a) => <Input {...a} value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} maxLength={100} />}</Field>
      <Field label="Texto superior">{(a) => <Input {...a} value={data.eyebrow} onChange={(e) => setData({ ...data, eyebrow: e.target.value })} maxLength={150} />}</Field></div>
      {data.items.map((item, index) => <fieldset key={item.id} className="min-w-0 space-y-4 rounded-xl border border-line p-4">
        <legend className="px-2 text-sm font-black">Colección {index + 1}</legend>
        <Field label="Título de la colección">{(a) => <Input {...a} value={item.title} onChange={(e) => patch(item.id, { title: e.target.value })} maxLength={100} />}</Field>
        <Field label="Descripción de la colección">{(a) => <Textarea {...a} value={item.text} onChange={(e) => patch(item.id, { text: e.target.value })} maxLength={300} rows={2} />}</Field>
        <Target options={options} value={item.href} onChange={(href) => patch(item.id, { href })} />
        <Picture options={options} value={item.imageKey} alt={item.imageAlt} onChange={(imageKey) => patch(item.id, { imageKey })} onAlt={(imageAlt) => patch(item.id, { imageAlt })} />
        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir colección ${index + 1}`}>↑ Subir</Button>
        <Button type="button" size="sm" variant="secondary" disabled={index === data.items.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar colección ${index + 1}`}>↓ Bajar</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setData({ ...data, items: data.items.filter((row) => row.id !== item.id) })} aria-label={`Quitar colección ${index + 1}`}>Quitar</Button></div>
      </fieldset>)}
      <Button type="button" variant="secondary" disabled={data.items.length >= 8} onClick={() => setData({ ...data, items: [...data.items, { id: crypto.randomUUID(), title: "", text: "", href: "/productos", imageKey: "", imageAlt: "" }] })}>Añadir colección</Button>
      <FormMessage state={state} /><div><Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar colecciones y publicar"}</Button></div>
    </form></Card>;
}
