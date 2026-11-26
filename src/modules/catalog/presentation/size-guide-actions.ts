"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { requireAdminActor } from "@/modules/identity/server";
import { errorState, fieldErrorsFrom, type FormState } from "@/shared/forms/form-state";

import { SIZE_CODES, type AdminSizeGuide } from "../contracts";
import { CATALOG_CACHE_TAG, saveSizeGuide } from "../server";

const schema = z.object({
  id: z.uuid().optional(), expectedVersion: z.coerce.number().int().positive().optional(), operationKey: z.uuid(),
  name: z.string().trim().min(1, "Ingresa un nombre.").max(100),
  rows: z.array(z.object({ sizeCode: z.enum(SIZE_CODES), lengthCm: z.string().max(16), widthCm: z.string().max(16) })).min(1).max(7),
});
export type GuideFormState = FormState & { guide?: AdminSizeGuide };

export async function saveSizeGuideAction(_previous: GuideFormState, form: FormData): Promise<GuideFormState> {
  const actor = await requireAdminActor();
  let rows: unknown;
  try {
    const value = String(form.get("rows") ?? "[]");
    if (value.length > 8000) return errorState("La guía es demasiado grande.");
    rows = JSON.parse(value);
  } catch { return errorState("La tabla no tiene un formato válido."); }
  const parsed = schema.safeParse({ ...Object.fromEntries(form), id: form.get("id") || undefined, expectedVersion: form.get("expectedVersion") ?? undefined, rows });
  if (!parsed.success) return errorState("Revisa el nombre y las medidas de cada talla.", fieldErrorsFrom(parsed.error.issues));
  try {
    const result = await saveSizeGuide(actor, parsed.data);
    if (!result.ok) return { status: "error", code: result.code, message: result.message, fieldErrors: result.field ? { [result.field]: result.message } : undefined };
    updateTag(CATALOG_CACHE_TAG);
    refresh();
    return { status: "success", message: "Guía de tallas guardada.", guide: result.value };
  } catch {
    console.error(JSON.stringify({ event: "catalog_size_guide_save_failed" }));
    return errorState("No pudimos guardar la guía. Reintenta o recarga si otra persona la modificó.");
  }
}
