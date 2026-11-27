"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { requireAdminActor } from "@/modules/identity/server";
import { CATALOG_CACHE_TAG } from "@/shared/cache/tags";
import { errorState, fieldErrorsFrom, type FormState } from "@/shared/forms/form-state";

import { adjustStock, registerInitialStock, type InventoryResult } from "../application/stock-adjustments";
import { ADJUSTMENT_REASONS } from "../contracts";
import { getInventoryDeps } from "../server";


const operationKey = z.uuid({ message: "Solicitud inválida." });

function finish(result: InventoryResult<unknown>, success: string): FormState {
  if (!result.ok) return errorState(result.message, result.field ? { [result.field]: result.message } : undefined);
  updateTag(CATALOG_CACHE_TAG);
  refresh();
  return { status: "success", message: success };
}

export async function registerInitialStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = z
    .object({
      variantId: z.uuid(),
      operationKey,
      quantity: z.coerce.number({ message: "Indica la cantidad." }).int("Usa un número entero.").min(0, "No puede ser negativo.").max(100_000),
      note: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  return finish(
    await registerInitialStock(getInventoryDeps(), actor, { ...parsed.data, note: parsed.data.note || null }),
    "Stock inicial registrado.",
  );
}

export async function adjustStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = z
    .object({
      variantId: z.uuid(),
      operationKey,
      direction: z.enum(["in", "out"]),
      quantity: z.coerce.number({ message: "Indica la cantidad." }).int("Usa un número entero.").positive("Debe ser mayor que 0.").max(100_000),
      reason: z.enum(ADJUSTMENT_REASONS, { message: "Elige un motivo." }),
      note: z.string().trim().max(300, "Máximo 300 caracteres.").optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return errorState("Revisa los datos.", fieldErrorsFrom(parsed.error.issues));
  const { direction, quantity, ...rest } = parsed.data;
  const result = await adjustStock(getInventoryDeps(), actor, { ...rest, delta: direction === "in" ? quantity : -quantity, note: rest.note || null });
  if (!result.ok && result.field === "delta") return errorState(result.message, { quantity: result.message });
  return finish(result, "Stock ajustado.");
}
