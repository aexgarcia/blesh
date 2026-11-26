"use server";

import { refresh, updateTag } from "next/cache";

import { requireAdminActor } from "@/modules/identity/server";
import { errorState, type FormState } from "@/shared/forms/form-state";

import { categoryInputSchema } from "../application/categories";
import type { AdminCategory } from "../contracts";
import { CATALOG_CACHE_TAG, saveCategory } from "../server";

export type CategoryFormState = FormState & { category?: AdminCategory };
export async function saveCategoryAction(_previous: CategoryFormState, form: FormData): Promise<CategoryFormState> {
  const actor = await requireAdminActor();
  const parsed = categoryInputSchema.safeParse({ ...Object.fromEntries(form), id: form.get("id") || undefined, expectedVersion: form.has("expectedVersion") ? Number(form.get("expectedVersion")) : undefined, position: Number(form.get("position")), active: form.get("active") === "on" });
  if (!parsed.success) return errorState(parsed.error.issues[0].message);
  try {
    const result = await saveCategory(actor, parsed.data);
    if (!result.ok) return { status: "error", code: result.code, message: result.message, fieldErrors: result.field ? { [result.field]: result.message } : undefined };
    updateTag(CATALOG_CACHE_TAG);
    refresh();
    return { status: "success", message: "Categoría guardada.", category: result.value };
  } catch {
    console.error(JSON.stringify({ event: "catalog_category_save_failed" }));
    return errorState("No pudimos guardar la categoría. Reintenta o recarga si otra persona la modificó.");
  }
}
