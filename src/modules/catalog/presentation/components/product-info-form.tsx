"use client";

import { useState } from "react";

import { slugify } from "@/shared/domain/slug";
import { Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { AdminProduct, CategoryOption, SizeGuideOption } from "../../contracts";
import { createProductAction, updateProductInfoAction } from "../actions";

type Props = {
  categories: CategoryOption[];
  sizeGuides: SizeGuideOption[];
  /** Sin producto: alta de borrador. Con producto: edición con versión esperada. */
  product?: AdminProduct;
};

export function ProductInfoForm({ categories, sizeGuides, product }: Props) {
  const { state, onSubmit, pending } = useActionForm(product ? updateProductInfoAction : createProductAction);
  const [title, setTitle] = useState(product?.title ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [short, setShort] = useState(product?.shortDescription ?? "");
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {product ? (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="expectedVersion" value={product.version} />
        </>
      ) : null}
      {state.status === "error" ? <FormMessage state={state} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Título" error={errors.title} className="md:col-span-2">
          {(c) => (
            <Input
              name="title"
              value={title}
              maxLength={160}
              required
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              {...c}
            />
          )}
        </Field>
        <Field
          label="URL del producto"
          hint={product?.slugLocked ? "Fija: el producto ya se publicó." : `/productos/${slug || "…"}`}
          error={errors.slug}
          className="md:col-span-2"
        >
          {(c) => (
            <Input
              name="slug"
              value={slug}
              readOnly={product?.slugLocked}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              {...c}
            />
          )}
        </Field>
        <Field label="Categoría" hint="Obligatoria para publicar." error={errors.categoryId}>
          {(c) => (
            <Select name="categoryId" defaultValue={product?.categoryId ?? ""} {...c}>
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Guía de tallas" error={errors.sizeGuideId}>
          {(c) => (
            <Select name="sizeGuideId" defaultValue={product?.sizeGuideId ?? ""} {...c}>
              <option value="">Sin guía</option>
              {sizeGuides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.rows.map((r) => r.sizeCode).join(", ")})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Descripción corta" hint={`${short.length}/300 · Se muestra junto al título.`} error={errors.shortDescription} className="md:col-span-2">
          {(c) => <Textarea name="shortDescription" value={short} onChange={(e) => setShort(e.target.value)} maxLength={300} rows={2} {...c} />}
        </Field>
        <Field label="Descripción" hint="Texto plano: materiales, calce y cuidados." error={errors.description} className="md:col-span-2">
          {(c) => <Textarea name="description" defaultValue={product?.description ?? ""} maxLength={5000} rows={6} {...c} />}
        </Field>
      </div>

      <details className="rounded-card border border-line bg-bg/60 px-5 py-4" open={Boolean(product?.seoTitle || product?.seoDescription)}>
        <summary className="cursor-pointer text-[11px] font-extrabold uppercase tracking-[0.05em]">SEO (opcional)</summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Field label="Título SEO" hint="Hasta 70 caracteres. Si se omite, se usa el título." error={errors.seoTitle}>
            {(c) => <Input name="seoTitle" defaultValue={product?.seoTitle ?? ""} maxLength={70} {...c} />}
          </Field>
          <Field label="Descripción SEO" hint="Hasta 160 caracteres." error={errors.seoDescription}>
            {(c) => <Input name="seoDescription" defaultValue={product?.seoDescription ?? ""} maxLength={160} {...c} />}
          </Field>
        </div>
      </details>

      <div className="flex justify-end">
        <SubmitButton size="lg" pending={pending} pendingLabel="Guardando…">
          {product ? "Guardar información" : "Crear borrador"}
        </SubmitButton>
      </div>
    </form>
  );
}
