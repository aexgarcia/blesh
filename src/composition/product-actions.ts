"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { CATALOG_CACHE_TAG, getAdminProduct, publishProduct } from "@/modules/catalog/server";
import { requireAdminActor } from "@/modules/identity/server";
import { getBalances } from "@/modules/inventory/server";
import { errorState, type FormState } from "@/shared/forms/form-state";

/** Publicar exige stock inicial registrado: se consulta inventory y se pasa al caso de uso del catálogo. */
export async function publishProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = z.object({ productId: z.uuid(), expectedVersion: z.coerce.number().int().positive() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");

  const product = await getAdminProduct(parsed.data.productId);
  if (!product) return errorState("El producto no existe.");
  const balances = await getBalances(product.variants.map((v) => v.id));
  const result = await publishProduct(actor, { ...parsed.data, variantsWithStockRecord: new Set(balances.keys()) });
  if (!result.ok) {
    const details = result.issues?.map((i) => i.message).join(" ");
    return errorState(details ? `${result.message} ${details}` : result.message);
  }
  updateTag(CATALOG_CACHE_TAG);
  refresh();
  return { status: "success", message: "Producto publicado." };
}
