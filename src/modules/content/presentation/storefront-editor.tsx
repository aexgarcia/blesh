"use client";

import Image from "next/image";
import { useState } from "react";

import { saveStorePackAction, saveStoreReelsAction, uploadStoreAssetAction } from "@/composition/storefront-actions";
import type { PackSettings } from "@/modules/sales/contracts";
import { minorToInput } from "@/shared/domain/money";
import type { FormState } from "@/shared/forms/form-state";
import { Button } from "@/shared/ui/button";
import { Field, Input, Select } from "@/shared/ui/form";
import { Card } from "@/shared/ui/surface";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { ReelEntry, SectionSnapshot } from "../contracts";

type Product = { slug: string; title: string; status: string };
type Asset = { key: string; kind: "video" | "image" };
function Result({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  return <p role={state.status === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${state.status === "error" ? "border-sale text-sale" : "border-line text-ink"}`}>{state.message}</p>;
}

export function PackEditor({ section, pack, products, operationKey: initialKey }: { section: SectionSnapshot<"pack">; pack: PackSettings; products: Product[]; operationKey: string }) {
  const [operationKey] = useState(initialKey);
  const { state, onSubmit, pending } = useActionForm(saveStorePackAction);
  const selected = pack.policy.productSlugs ?? ["boxy-essential"];
  const options = [...products, ...selected.filter((slug) => !products.some((p) => p.slug === slug)).map((slug) => ({ slug, title: slug, status: "missing" }))];
  return <Card className="p-5 md:p-7">
    <h2 className="text-xl font-black">Arma tu pack</h2>
    <p className="mt-2 text-sm text-muted">Ocultar el bloque solo cambia la portada. Desactivar la promoción elimina el descuento de nuevas cotizaciones; los pedidos existentes conservan sus importes.</p>
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <input type="hidden" name="expectedVersion" value={section.version} />
      <input type="hidden" name="policyVersion" value={pack.version} />
      <input type="hidden" name="operationKey" value={operationKey} />
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="enabled" defaultChecked={section.data.enabled} /> Mostrar sección en la portada</label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="promotionEnabled" defaultChecked={pack.enabled} /> Promoción activa</label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título de la sección">{(a) => <Input {...a} name="title" defaultValue={section.data.title} required maxLength={100} />}</Field>
        <Field label="Texto superior">{(a) => <Input {...a} name="eyebrow" defaultValue={section.data.eyebrow} maxLength={150} />}</Field>
      </div>
      <Field label="Nombre de la promoción" hint="Se muestra en el carrito y en las solicitudes.">{(a) => <Input {...a} name="label" defaultValue={pack.policy.label} required maxLength={80} />}</Field>
      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-2 text-xs font-black uppercase">Productos incluidos (máximo 12)</legend>
        <p className="mb-3 text-sm text-muted">Todas las tallas y colores activos de los productos seleccionados. Sus prendas se pueden combinar.</p>
        <div className="grid max-h-64 gap-3 overflow-y-auto md:grid-cols-2">
          {options.map((p) => <label key={p.slug} className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" name="productSlugs" value={p.slug} defaultChecked={selected.includes(p.slug)} /> <span>{p.title}{p.status !== "published" ? " (no publicado)" : ""}</span></label>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        {(["one", "two", "three"] as const).map((name, i) => <Field key={name} label={`Total por ${i + 1} ${i === 0 ? "prenda" : "prendas"} (S/)`}>{(a) => <Input {...a} name={name} inputMode="decimal" defaultValue={minorToInput(pack.policy.tierTotalsMinor[i])} required />}</Field>)}
      </div>
      <p className="text-sm text-muted">Son precios totales, no precios por unidad. Más de 3 prendas: grupos de 3 más el resto. Si el precio normal ya es menor, se conserva el menor. Cada prenda mantiene su stock.</p>
      <Result state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar pack y publicar"}</Button>
    </form>
  </Card>;
}

export function UploadAsset() {
  const [kind, setKind] = useState<"video" | "image">("video");
  const [fileError, setFileError] = useState<string | null>(null);
  const { state, onSubmit, pending } = useActionForm(uploadStoreAssetAction, { onSuccess: (_s, form) => form?.reset() });
  return <Card className="p-5 md:p-7">
    <h2 className="text-xl font-black">Biblioteca de la tienda</h2>
    <p className="mt-2 text-sm text-muted">Sube imágenes para portada, colecciones o videos; JPG/PNG/WebP o MP4 de hasta 5 MB. Las imágenes se convierten a WebP. Subir un archivo no lo publica: selecciónalo en su sección y guarda.</p>
    <form onSubmit={(event) => {
      const file = new FormData(event.currentTarget).get("file");
      if (file instanceof File && file.size > 5 * 1024 * 1024) {
        event.preventDefault();
        setFileError("El archivo supera 5 MB. Comprímelo antes de subirlo.");
        return;
      }
      setFileError(null);
      onSubmit(event);
    }} className="mt-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo de archivo">{(a) => <Select {...a} name="kind" value={kind} onChange={(e) => setKind(e.target.value as "video" | "image")}><option value="video">Video MP4</option><option value="image">Imagen</option></Select>}</Field>
        <Field label="Archivo">{(a) => <Input {...a} key={kind} type="file" name="file" accept={kind === "video" ? "video/mp4" : "image/jpeg,image/png,image/webp"} required />}</Field>
      </div>
      <Result state={state} />
      {fileError ? <p role="alert" className="text-sm text-sale">{fileError}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Subiendo…" : "Subir a biblioteca"}</Button>
    </form>
  </Card>;
}

export function ReelsEditor({ section, products, assets, assetBase, operationKey: initialKey }: { section: SectionSnapshot<"reels">; products: Product[]; assets: Asset[]; assetBase: string; operationKey: string }) {
  const [operationKey] = useState(initialKey);
  const [items, setItems] = useState(section.data.items);
  const { state, onSubmit, pending } = useActionForm(saveStoreReelsAction);
  const patch = (id: string, change: Partial<ReelEntry>) => setItems((rows) => rows.map((r) => r.id === id ? { ...r, ...change } : r));
  function move(index: number, direction: number) {
    setItems((rows) => { const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  return <Card className="p-5 md:p-7">
    <h2 className="text-xl font-black">En movimiento</h2>
    <form onSubmit={onSubmit} className="mt-5 space-y-5">
      <input type="hidden" name="expectedVersion" value={section.version} />
      <input type="hidden" name="operationKey" value={operationKey} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="enabled" defaultChecked={section.data.enabled} /> Mostrar sección en la portada</label>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título">{(a) => <Input {...a} name="title" defaultValue={section.data.title} maxLength={100} required />}</Field>
        <Field label="Texto superior">{(a) => <Input {...a} name="eyebrow" defaultValue={section.data.eyebrow} maxLength={150} />}</Field>
        <Field label="Cuenta que se muestra">{(a) => <Input {...a} name="handle" defaultValue={section.data.handle} maxLength={60} />}</Field>
        <Field label="Enlace Ver más" hint="Opcional; Instagram o TikTok con HTTPS.">{(a) => <Input {...a} name="moreUrl" type="url" defaultValue={section.data.moreUrl} />}</Field>
      </div>
      <p className="text-sm text-muted">Hasta 8 videos, en el orden mostrado. La vista previa reproduce solo si pulsas sus controles.</p>
      {items.map((item, index) => <fieldset key={item.id} className="rounded-xl border border-line p-4">
        <legend className="px-2 text-sm font-black">Video {index + 1}</legend>
        <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
          <div className="aspect-[9/16] overflow-hidden rounded-xl bg-card">
            {item.videoKey ? <video className="h-full w-full object-cover" controls playsInline preload="none" src={`${assetBase}${item.videoKey}`} poster={item.posterKey ? `${assetBase}${item.posterKey}` : undefined} aria-label={`Vista previa: ${item.title || `Video ${index + 1}`}`} /> : item.posterKey ? <Image width={180} height={320} className="h-full w-full object-cover" src={`${assetBase}${item.posterKey}`} alt="Portada del video" /> : null}
          </div>
          <div className="space-y-4">
            <Field label="Título del video">{(a) => <Input {...a} value={item.title} onChange={(e) => patch(item.id, { title: e.target.value })} maxLength={100} required />}</Field>
            <Field label="Producto enlazado">{(a) => <Select {...a} value={item.productSlug} onChange={(e) => patch(item.id, { productSlug: e.target.value })} required>
              <option value="">Selecciona un producto</option>
              {products.map((p) => <option key={p.slug} value={p.slug}>{p.title}{p.status !== "published" ? " (no publicado)" : ""}</option>)}
              {item.productSlug && !products.some((p) => p.slug === item.productSlug) ? <option value={item.productSlug}>{item.productSlug} (no disponible)</option> : null}
            </Select>}</Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Archivo de video">{(a) => <Select {...a} value={item.videoKey} onChange={(e) => patch(item.id, { videoKey: e.target.value })} required><option value="">Selecciona un MP4</option>{assets.filter((a) => a.kind === "video").map((a) => <option key={a.key} value={a.key}>{a.key.split("/").at(-1)}</option>)}</Select>}</Field>
              <Field label="Portada">{(a) => <Select {...a} value={item.posterKey} onChange={(e) => patch(item.id, { posterKey: e.target.value })} required><option value="">Selecciona una portada</option>{assets.filter((a) => a.kind === "image").map((a) => <option key={a.key} value={a.key}>{a.key.split("/").at(-1)}</option>)}</Select>}</Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir video ${index + 1}`}>↑ Subir</Button>
              <Button type="button" size="sm" variant="secondary" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar video ${index + 1}`}>↓ Bajar</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setItems((rows) => rows.filter((r) => r.id !== item.id))} aria-label={`Quitar video ${index + 1}`}>Quitar</Button>
            </div>
          </div>
        </div>
      </fieldset>)}
      <Button type="button" variant="secondary" disabled={items.length >= 8} onClick={() => setItems((rows) => [...rows, { id: crypto.randomUUID(), title: "", productSlug: "", videoKey: "", posterKey: "" }])}>Añadir video</Button>
      <Result state={state} />
      <div><Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar videos y publicar"}</Button></div>
    </form>
  </Card>;
}
