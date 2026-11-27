"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import { listAdminCategories, listStorefrontProductOptions } from "@/modules/catalog/server";
import { CONTENT_CACHE_TAG, type ReelsSection } from "@/modules/content/contracts";
import { generalSettingsSchema, saveHomeSectionWithin, SectionFailure } from "@/modules/content/server";
import { actorCan, requireAdminActor } from "@/modules/identity/server";
import { listReelAssets, uploadReelAsset } from "@/modules/media/server";
import { savePackSettingsWithin, PackSettingsFailure } from "@/modules/sales/server";
import { CATALOG_CACHE_TAG } from "@/shared/cache/tags";
import { errorState, type FormState } from "@/shared/forms/form-state";
import { parsePENInput } from "@/shared/domain/money";
import { saveHomeVisuals } from "./storefront-visuals";

const refSchema = z.object({ expectedVersion: z.coerce.number().int().min(0), operationKey: z.uuid() });

function finish() {
  updateTag(CONTENT_CACHE_TAG);
  updateTag(CATALOG_CACHE_TAG);
  refresh();
  return { status: "success" as const, message: "Cambios publicados en la tienda." };
}
function failure(error: unknown): FormState {
  if (error instanceof SectionFailure || error instanceof PackSettingsFailure) return { status: "error", code: error.code, message: error.message };
  console.error(JSON.stringify({ event: "storefront_configuration_failed" }));
  return errorState("No pudimos guardar los cambios. Reintenta; si otra persona editó la sección, recarga primero.");
}

export async function saveStoreGeneralAction(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return errorState("Solo el propietario puede modificar la tienda.");
  const ref = refSchema.safeParse(Object.fromEntries(form));
  if (!ref.success) return errorState("Formulario inválido. Recarga la página.");
  try {
    const json = String(form.get("data") ?? "");
    if (json.length > 8000) return errorState("Los datos son demasiado extensos.");
    const parsed = generalSettingsSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return errorState(parsed.error.issues.map((issue) => issue.message).join(" "));
    await getDb().transaction((raw) => saveHomeSectionWithin(raw as unknown as AnyDatabase, actor, "general", { ...ref.data, data: parsed.data }));
    return finish();
  } catch (error) { return failure(error); }
}

export async function saveStorePackAction(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return errorState("Solo el propietario puede modificar la tienda.");
  const ref = refSchema.safeParse(Object.fromEntries(form));
  const policyVersion = z.coerce.number().int().min(0).safeParse(form.get("policyVersion"));
  if (!ref.success || !policyVersion.success) return errorState("Formulario inválido. Recarga la página.");
  const tiers = ["one", "two", "three"].map((field) => parsePENInput(String(form.get(field) ?? "")));
  if (tiers.some((v) => v === null)) return errorState("Escribe los precios en soles con un máximo de dos decimales.");
  const productSlugs = form.getAll("productSlugs").map(String);
  const promotionEnabled = form.get("promotionEnabled") === "on";
  if (form.get("enabled") === "on" && !promotionEnabled) return errorState("Para mostrar el constructor, activa la promoción. Si quieres desactivarla, oculta también la sección.");
  try {
    const products = await listStorefrontProductOptions();
    if (promotionEnabled && productSlugs.some((slug) => !products.some((p) => p.slug === slug && p.status === "published"))) return errorState("El pack solo puede incluir productos publicados. Revisa la selección.");
    await getDb().transaction(async (raw) => {
      const tx = raw as unknown as AnyDatabase;
      await saveHomeSectionWithin(tx, actor, "pack", { ...ref.data, data: { enabled: form.get("enabled") === "on", title: String(form.get("title") ?? ""), eyebrow: String(form.get("eyebrow") ?? "") } });
      await savePackSettingsWithin(tx, actor, { enabled: promotionEnabled, label: String(form.get("label") ?? ""), productSlugs, tierTotalsMinor: tiers as [number, number, number], expectedVersion: policyVersion.data, operationKey: ref.data.operationKey });
    });
    return finish();
  } catch (error) { return failure(error); }
}

export async function saveStoreReelsAction(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return errorState("Solo el propietario puede modificar la tienda.");
  const ref = refSchema.safeParse(Object.fromEntries(form));
  if (!ref.success) return errorState("Formulario inválido. Recarga la página.");
  try {
    const serialized = String(form.get("items") ?? "[]");
    if (serialized.length > 20_000) return errorState("La lista de videos es demasiado grande.");
    const items: ReelsSection["items"] = JSON.parse(serialized);
    if (!Array.isArray(items) || items.length > 8) return errorState("Puedes mostrar hasta 8 videos.");
    const [assets, products] = await Promise.all([listReelAssets(actor), listStorefrontProductOptions()]);
    if (items.some((i) => !assets.some((a) => a.key === i.videoKey && a.kind === "video") || !assets.some((a) => a.key === i.posterKey && a.kind === "image"))) return errorState("Selecciona un video y una portada existentes de la biblioteca.");
    if (form.get("enabled") === "on" && items.some((i) => !products.some((p) => p.slug === i.productSlug && p.status === "published"))) return errorState("Cada video visible debe enlazar un producto publicado.");
    await getDb().transaction((raw) => saveHomeSectionWithin(raw as unknown as AnyDatabase, actor, "reels", { ...ref.data, data: {
      enabled: form.get("enabled") === "on", title: String(form.get("title") ?? ""), eyebrow: String(form.get("eyebrow") ?? ""), handle: String(form.get("handle") ?? ""), moreUrl: String(form.get("moreUrl") ?? ""), items,
    } }));
    return finish();
  } catch (error) { return failure(error); }
}

export async function uploadStoreAssetAction(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return errorState("Solo el propietario puede subir archivos de la tienda.");
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || (kind !== "video" && kind !== "image")) return errorState("Selecciona un archivo y su tipo.");
  try {
    const result = await uploadReelAsset(actor, file, kind);
    if (!result.ok) return errorState(result.message);
    refresh();
    return { status: "success", message: `Archivo disponible en biblioteca: ${result.key.split("/").at(-1)}. Selecciónalo y guarda la sección que corresponda.` };
  } catch { return errorState("No se pudo subir el archivo. Comprueba el almacenamiento y vuelve a intentarlo."); }
}

/** Portada y colecciones comparten validación de archivos y destinos existentes. */
export async function saveStoreVisualsAction(_previous: FormState, form: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return errorState("Solo el propietario puede modificar la tienda.");
  const ref = refSchema.safeParse(Object.fromEntries(form));
  const key = form.get("section");
  if (!ref.success || (key !== "hero" && key !== "collections")) return errorState("Formulario inválido. Recarga la página.");
  try {
    const serialized = String(form.get("data") ?? "");
    if (serialized.length > 20_000) return errorState("La sección es demasiado grande.");
    const data: unknown = JSON.parse(serialized);
    const [assets, products, categories] = await Promise.all([listReelAssets(actor), listStorefrontProductOptions(), listAdminCategories(actor)]);
    await saveHomeVisuals({ db: getDb(), assets, products, categories: categories.filter((c) => c.active) }, actor, key, { ...ref.data, data });
    return finish();
  } catch (error) { return failure(error); }
}
