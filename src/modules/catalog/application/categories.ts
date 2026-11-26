import { z } from "zod";

import type { AdminCategory } from "../contracts";
import { CatalogFailure, catalogResult } from "./errors";
import type { Authorize, CatalogActor } from "./ports";

export const categoryInputSchema = z.object({
  id: z.uuid().optional(), expectedVersion: z.number().int().positive().optional(), operationKey: z.uuid(),
  name: z.string().trim().min(1, "Ingresa un nombre.").max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa letras minúsculas, números y guiones."),
  description: z.string().trim().max(1000), position: z.number().int().min(0).max(9999), active: z.boolean(),
}).refine((v) => !v.id || v.expectedVersion !== undefined, { message: "Recarga la categoría antes de guardar.", path: ["expectedVersion"] });
export type SaveCategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryStore = { save: (input: SaveCategoryInput & { actorId: string }) => Promise<AdminCategory> };

export function saveCategory(deps: { authorize: Authorize; store: CategoryStore }, actor: CatalogActor, input: SaveCategoryInput) {
  return catalogResult(async () => {
    if (!deps.authorize(actor, "catalog.manage")) throw new CatalogFailure("FORBIDDEN", "No tienes permiso para gestionar categorías.");
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) throw new CatalogFailure("VALIDATION_ERROR", parsed.error.issues[0].message, String(parsed.error.issues[0].path[0]));
    return deps.store.save({ ...parsed.data, actorId: actor.membershipId });
  });
}
