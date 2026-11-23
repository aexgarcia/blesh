"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminActor } from "@/modules/identity/server";
import { ingestUploadedImage } from "@/modules/media/server";
import { errorState, fieldErrorsFrom, type FormState } from "@/shared/forms/form-state";

import type { CatalogResult } from "../application/errors";
import * as editing from "../application/product-editing";
import { CATALOG_CACHE_TAG, getCatalogDeps } from "../server";
import { colorSchema, imageMetaSchema, newVariantSchema, productInfoSchema, variantSchema } from "./schemas";

const ids = z.object({ productId: z.uuid() });
const versioned = ids.extend({ expectedVersion: z.coerce.number().int().positive() });

function fields(formData: FormData) {
  return Object.fromEntries(formData) as Record<string, string>;
}

/** Convierte un resultado de caso de uso en estado de formulario e invalida la caché pública. */
function finish(result: CatalogResult<unknown>, success: string): FormState {
  if (!result.ok) {
    const details = result.issues?.map((i) => i.message).join(" ");
    return errorState(details ? `${result.message} ${details}` : result.message, result.field ? { [result.field]: result.message } : undefined);
  }
  updateTag(CATALOG_CACHE_TAG);
  refresh();
  return { status: "success", message: success };
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = productInfoSchema.safeParse(fields(formData));
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  const result = await editing.createProductDraft(getCatalogDeps(), actor, parsed.data);
  if (!result.ok) return finish(result, "");
  redirect(`/admin/productos/${result.value.id}?tab=colores&creado=1`);
}

export async function updateProductInfoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = versioned.safeParse(fields(formData));
  const parsed = productInfoSchema.safeParse(fields(formData));
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  return finish(await editing.updateProductInfo(getCatalogDeps(), actor, { ...parsed.data, ...ref.data }), "Información guardada.");
}

export async function addColorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = ids.safeParse(fields(formData));
  const parsed = colorSchema.safeParse(fields(formData));
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  return finish(await editing.addColor(getCatalogDeps(), actor, { ...parsed.data, productId: ref.data.productId }), "Color agregado.");
}

export async function updateColorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = ids.extend({ colorId: z.uuid() }).safeParse(fields(formData));
  const parsed = colorSchema.safeParse(fields(formData));
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  return finish(await editing.updateColor(getCatalogDeps(), actor, { ...parsed.data, ...ref.data }), "Color actualizado.");
}

export async function setPrimaryColorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = ids.extend({ colorId: z.uuid() }).safeParse(fields(formData));
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  return finish(await editing.setPrimaryColor(getCatalogDeps(), actor, ref.data), "Color principal actualizado.");
}

export async function addVariantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = ids.safeParse(fields(formData));
  const parsed = newVariantSchema.safeParse(fields(formData));
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  const { price, compareAt, ...rest } = parsed.data;
  return finish(
    await editing.addVariant(getCatalogDeps(), actor, { ...rest, priceMinor: price, compareAtMinor: compareAt, productId: ref.data.productId }),
    "Talla agregada. Registra su stock inicial en la pestaña Stock.",
  );
}

export async function updateVariantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = versioned.extend({ variantId: z.uuid() }).safeParse(fields(formData));
  const parsed = variantSchema.safeParse(fields(formData));
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  const { price, compareAt, ...rest } = parsed.data;
  return finish(
    await editing.updateVariant(getCatalogDeps(), actor, { ...rest, priceMinor: price, compareAtMinor: compareAt, ...ref.data }),
    "Talla actualizada.",
  );
}

/** Subida de imagen: media valida/normaliza; catálogo la asocia al producto/color. */
export async function uploadImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const ref = ids.safeParse(fields(formData));
  const meta = imageMetaSchema.safeParse({ alt: formData.get("alt"), colorId: formData.get("colorId") ?? "" });
  const file = formData.get("file");
  if (!ref.success) return errorState("Solicitud inválida. Recarga la página.");
  if (!meta.success) return errorState("Revisa los datos.", fieldErrorsFrom(meta.error.issues));
  if (!(file instanceof File) || file.size === 0) return errorState("Elige una imagen.", { file: "Elige una imagen." });

  const deps = getCatalogDeps();
  // Autorizar antes de procesar/almacenar el archivo.
  if (!deps.authorize(actor, "catalog.manage")) return errorState("No tienes permiso para editar el catálogo.");
  const ingested = await ingestUploadedImage(file, actor.membershipId);
  if (!ingested.ok) return errorState(ingested.message, { file: ingested.message });
  return finish(await editing.attachImage(deps, actor, { productId: ref.data.productId, mediaId: ingested.image.id, ...meta.data }), "Imagen agregada.");
}

export async function updateImageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ids
    .extend({
      imageId: z.uuid(),
      intent: z.enum(["alt", "cover", "up", "down", "remove"]),
      alt: z.string().optional(),
    })
    .safeParse(fields(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");
  const { productId, imageId, intent, alt } = parsed.data;
  const deps = getCatalogDeps();
  if (intent === "remove") return finish(await editing.detachImage(deps, actor, { productId, imageId }), "Imagen quitada.");
  return finish(
    await editing.updateImage(deps, actor, {
      productId,
      imageId,
      alt: intent === "alt" ? (alt ?? "") : undefined,
      makeCover: intent === "cover",
      move: intent === "up" || intent === "down" ? intent : undefined,
    }),
    intent === "alt" ? "Texto alternativo guardado." : "Imagen actualizada.",
  );
}

export async function changeStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = versioned.extend({ to: z.enum(["draft", "archived"]) }).safeParse(fields(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");
  return finish(
    await editing.changeProductStatus(getCatalogDeps(), actor, parsed.data),
    parsed.data.to === "archived" ? "Producto archivado." : "Producto pasado a borrador (ya no es visible en la tienda).",
  );
}
