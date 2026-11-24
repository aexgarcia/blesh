"use client";

import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { MEDIA_LIMITS } from "@/modules/media/contracts";
import { Button } from "@/shared/ui/button";
import { Field, Input, Select } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { Badge, Card, CardHeader } from "@/shared/ui/surface";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { AdminImage, AdminProduct } from "../../contracts";
import { updateImageAction, uploadImageAction } from "../actions";

export function ImagesPanel({ product }: { product: AdminProduct }) {
  const groups = [
    ...product.colors.map((c) => ({ key: c.id, colorId: c.id as string | null, title: c.label, hint: c.active ? "Fotos de este color" : "Color inactivo" })),
    { key: "common", colorId: null, title: "Fotos comunes", hint: "Se muestran en todos los colores (p. ej. detalle de etiqueta)." },
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <Card key={g.key}>
            <CardHeader title={g.title} description={g.hint} />
            <ImageGrid productId={product.id} images={product.images.filter((i) => i.colorId === g.colorId).sort((a, b) => a.position - b.position)} />
          </Card>
        ))}
      </div>
      <UploadCard product={product} />
    </div>
  );
}

function ImageGrid({ productId, images }: { productId: string; images: AdminImage[] }) {
  if (images.length === 0) return <p className="px-6 py-5 text-[13px] text-muted">Sin fotos. La primera que subas será la portada.</p>;
  return (
    <ul className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 xl:grid-cols-4">
      {images.map((image, index) => (
        <li key={image.id}>
          <ImageTile productId={productId} image={image} first={index === 0} last={index === images.length - 1} />
        </li>
      ))}
    </ul>
  );
}

function ImageTile({ productId, image, first, last }: { productId: string; image: AdminImage; first: boolean; last: boolean }) {
  const { state, onSubmit, pending } = useActionForm(updateImageAction);
  const hidden = (
    <>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="imageId" value={image.id} />
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] bg-card">
        {image.url ? (
          <Image src={image.url} alt={image.alt} fill sizes="(min-width: 1280px) 180px, 45vw" className="object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-[12px] text-muted">Sin vista previa</span>
        )}
        {image.isCover ? <Badge tone="ink" className="absolute left-2 top-2">Portada</Badge> : null}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-1.5" aria-busy={pending}>
        {hidden}
        <div className="flex items-center justify-between gap-1">
          <div className="flex">
            <IconSubmit intent="up" label="Mover antes" disabled={first}>
              <ArrowUp aria-hidden />
            </IconSubmit>
            <IconSubmit intent="down" label="Mover después" disabled={last}>
              <ArrowDown aria-hidden />
            </IconSubmit>
            {!image.isCover ? (
              <IconSubmit intent="cover" label="Usar como portada">
                <Star aria-hidden />
              </IconSubmit>
            ) : null}
          </div>
          <IconSubmit intent="remove" label="Quitar imagen" danger>
            <Trash2 aria-hidden />
          </IconSubmit>
        </div>
        <div className="flex gap-1">
          <label className="sr-only" htmlFor={`alt-${image.id}`}>
            Texto alternativo
          </label>
          <Input id={`alt-${image.id}`} name="alt" defaultValue={image.alt} maxLength={200} title={image.alt} className="h-9 min-w-0 flex-1 rounded-[10px] px-2.5 text-[12px]" />
          <Button type="submit" name="intent" value="alt" variant="secondary" size="sm" className="h-9">
            OK
          </Button>
        </div>
        {state.status === "error" ? <FormMessage state={state} /> : null}
      </form>
    </div>
  );
}

function IconSubmit({ intent, label, disabled, danger, children }: { intent: string; label: string; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" name="intent" value={intent} variant="ghost" size="icon" aria-label={label} title={label} disabled={disabled} className={danger ? "text-sale hover:bg-sale/10" : undefined}>
      {children}
    </Button>
  );
}

function UploadCard({ product }: { product: AdminProduct }) {
  const [preview, setPreview] = useState<string | null>(null);
  const { state, onSubmit, pending } = useActionForm(uploadImageAction, {
    onSuccess: (_state, form) => {
      form?.reset();
      setPreview(null);
    },
  });
  const errors = state.fieldErrors ?? {};
  return (
    <Card className="h-fit lg:sticky lg:top-6">
      <CardHeader title="Subir imagen" description="JPEG, PNG o WebP · máx. 5 MB · mín. 400 px. Se convierte a WebP y se eliminan metadatos." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6" noValidate>
        <input type="hidden" name="productId" value={product.id} />
        {state.status === "error" && !errors.file ? <FormMessage state={state} /> : null}
        <label className="group relative grid aspect-[4/5] cursor-pointer place-items-center overflow-hidden rounded-[12px] border border-dashed border-line bg-bg text-center transition-colors hover:border-ink">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 px-6 text-[12px] text-muted">
              <ImagePlus className="size-6 text-ink" aria-hidden />
              Elegir archivo
            </span>
          )}
          <input
            type="file"
            name="file"
            accept={MEDIA_LIMITS.acceptedTypes.join(",")}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Archivo de imagen"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
        {errors.file ? <p className="text-[12px] font-semibold text-sale">{errors.file}</p> : null}
        <Field label="Color" error={errors.colorId}>
          {(c) => (
            <Select name="colorId" defaultValue={product.colors.find((col) => col.isPrimary)?.id ?? ""} {...c}>
              {product.colors.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
              <option value="">Foto común (todos los colores)</option>
            </Select>
          )}
        </Field>
        <Field label="Texto alternativo" hint="Describe la foto: «Polo boxy negro, vista frontal»." error={errors.alt}>
          {(c) => <Input name="alt" maxLength={200} required {...c} />}
        </Field>
        <SubmitButton size="lg" block pending={pending} pendingLabel="Procesando…">
          Subir imagen
        </SubmitButton>
      </form>
    </Card>
  );
}
