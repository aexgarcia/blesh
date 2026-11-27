"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { slugify } from "@/shared/domain/slug";
import { Button } from "@/shared/ui/button";
import { Field, Input, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { AdminCategory } from "../../contracts";
import { saveCategoryAction, type CategoryFormState } from "../category-actions";

export function CategoryForm({ category, operationKey: initialKey }: { category?: AdminCategory; operationKey: string }) {
  const router = useRouter();
  const [operationKey] = useState(initialKey);
  const [name, setName] = useState(category?.name ?? "");
  const [manualSlug, setManualSlug] = useState<string | null>(category?.slug ?? null);
  const { state, onSubmit, pending } = useActionForm<CategoryFormState>(saveCategoryAction, { onSuccess: (result) => {
    if (!category && result.category) router.push(`/admin/categorias/${result.category.id}`);
  } });
  return <form onSubmit={onSubmit} className="space-y-5" noValidate>
    <input type="hidden" name="operationKey" value={operationKey} />
    {category ? <><input type="hidden" name="id" value={category.id} /><input type="hidden" name="expectedVersion" value={category.version} /></> : null}
    <Field label="Nombre" error={state.fieldErrors?.name}>{(a) => <Input {...a} name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />}</Field>
    <Field label="URL de la categoría" error={state.fieldErrors?.slug} hint={category ? "La URL se conserva aunque cambies el nombre." : `/categorias/${manualSlug ?? slugify(name)}`}>{(a) => <Input {...a} name="slug" value={manualSlug ?? slugify(name)} onChange={(e) => setManualSlug(e.target.value || null)} readOnly={Boolean(category)} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={80} />}</Field>
    {!category && manualSlug !== null ? <Button type="button" size="sm" variant="ghost" onClick={() => setManualSlug(null)}>Usar URL sugerida</Button> : null}
    <Field label="Descripción" hint="Se muestra en la página de la categoría.">{(a) => <Textarea {...a} name="description" defaultValue={category?.description ?? ""} maxLength={1000} rows={3} />}</Field>
    <Field label="Orden" hint="Los números menores aparecen primero. En un empate se ordenan por URL.">{(a) => <Input {...a} type="number" name="position" min={0} max={9999} step={1} defaultValue={category?.position ?? 0} required />}</Field>
    <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={category?.active ?? true} /> Categoría activa</label>
    <p className="rounded-xl border border-line p-3 text-sm text-muted">Una categoría activa aparece en la navegación cuando tiene prendas publicadas con colores y tallas activos. Desactivarla oculta su página y sus enlaces; sus productos siguen en Todas las prendas. Para retirar una prenda, archívala desde Productos.</p>
    {category ? <p className="text-sm text-muted">{category.productCount} productos asignados · {category.publishedCount} publicados · Versión {category.version}</p> : null}
    <FormMessage state={state} />
    <div className="flex justify-end"><SubmitButton pending={pending}>{category ? "Guardar categoría" : "Crear categoría"}</SubmitButton></div>
  </form>;
}
