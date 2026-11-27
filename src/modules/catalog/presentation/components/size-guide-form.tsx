"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { Field, Input, Select } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

import { SIZE_CODES, SIZE_LABELS, type AdminSizeGuide, type SizeGuideOption } from "../../contracts";
import { saveSizeGuideAction, type GuideFormState } from "../size-guide-actions";

export function SizeGuideForm({ guide, operationKey: initialKey, onCreated }: { guide?: AdminSizeGuide; operationKey: string; onCreated?: (guide: SizeGuideOption) => void }) {
  const router = useRouter();
  const [operationKey] = useState(initialKey);
  const [rows, setRows] = useState(guide?.rows ?? ["S", "M", "L"].map((sizeCode) => ({ sizeCode, lengthCm: "", widthCm: "" })));
  const { state, onSubmit, pending } = useActionForm<GuideFormState>(saveSizeGuideAction, { onSuccess: (result) => {
    if (!result.guide || guide) return;
    if (onCreated) onCreated(result.guide);
    else router.push(`/admin/guias-de-tallas/${result.guide.id}`);
  } });
  function patch(index: number, field: "sizeCode" | "lengthCm" | "widthCm", value: string) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }
  return <form onSubmit={(event) => { event.stopPropagation(); onSubmit(event); }} className="space-y-5" noValidate>
    <input type="hidden" name="operationKey" value={operationKey} />
    <input type="hidden" name="rows" value={JSON.stringify(rows)} />
    {guide ? <><input type="hidden" name="id" value={guide.id} /><input type="hidden" name="expectedVersion" value={guide.version} /></> : null}
    <Field label="Nombre de la guía" error={state.fieldErrors?.name} hint="Por ejemplo, un nombre que identifique la prenda y su calce.">{(a) => <Input {...a} name="name" maxLength={100} required defaultValue={guide?.name ?? ""} />}</Field>
    <p className="rounded-xl border border-line bg-bg p-3 text-xs leading-relaxed text-muted">Mide la prenda extendida y sin estirar. Largo desde el punto alto del hombro hasta el borde inferior; ancho de axila a axila. Son centímetros, con un máximo de un decimal. Ingresa medidas reales de fabricación.</p>
    {guide?.products.length ? <p role="note" className="rounded-xl border border-line p-3 text-sm">Esta guía la usan <strong>{guide.products.length} productos</strong>. Los cambios se reflejarán en sus fichas y en la calculadora al guardar. Si la nueva prenda tiene otras medidas, crea otra guía.</p> : null}
    <fieldset className="space-y-3">
      <legend className="mb-3 text-xs font-black uppercase">Medidas por talla</legend>
      {rows.map((row, index) => <div key={index} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-line p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Field label={`Talla ${index + 1}`}>{(a) => <Select {...a} value={row.sizeCode} onChange={(e) => patch(index, "sizeCode", e.target.value)}>{SIZE_CODES.map((sizeCode) => <option key={sizeCode} value={sizeCode} disabled={rows.some((r, i) => i !== index && r.sizeCode === sizeCode)}>{SIZE_LABELS[sizeCode]}</option>)}</Select>}</Field>
        <Field label={`Largo ${index + 1} (cm)`}>{(a) => <Input {...a} inputMode="decimal" value={row.lengthCm} onChange={(e) => patch(index, "lengthCm", e.target.value)} required maxLength={16} placeholder="cm" />}</Field>
        <Field label={`Ancho ${index + 1} (cm)`}>{(a) => <Input {...a} inputMode="decimal" value={row.widthCm} onChange={(e) => patch(index, "widthCm", e.target.value)} required maxLength={16} placeholder="cm" />}</Field>
        <Button type="button" variant="secondary" size="sm" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label={`Quitar talla ${row.sizeCode}`}>Quitar</Button>
      </div>)}
      <Button type="button" variant="secondary" size="sm" disabled={rows.length >= SIZE_CODES.length || rows.some((r) => r.sizeCode === "UNICA")} onClick={() => {
        const sizeCode = SIZE_CODES.find((code) => !rows.some((row) => row.sizeCode === code));
        if (sizeCode) setRows((current) => [...current, { sizeCode, lengthCm: "", widthCm: "" }]);
      }}>Añadir talla</Button>
    </fieldset>
    <FormMessage state={state} />
    <div className="flex justify-end"><SubmitButton pending={pending} pendingLabel="Guardando…">{guide ? "Guardar guía" : "Crear guía"}</SubmitButton></div>
  </form>;
}
