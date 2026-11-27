import { slugify } from "../../../shared/domain/slug";
import type { AdminSizeGuide } from "../contracts";
import { normalizeGuide, type GuideInput } from "../domain/size-guide";
import { CatalogFailure, catalogResult } from "./errors";
import type { Authorize, CatalogActor } from "./ports";

export type SaveGuideInput = GuideInput & { id?: string; expectedVersion?: number; operationKey: string };
export interface GuideStore {
  save(input: SaveGuideInput & { code: string; actorId: string }): Promise<AdminSizeGuide>;
}

export function saveSizeGuide(deps: { authorize: Authorize; store: GuideStore }, actor: CatalogActor, input: SaveGuideInput) {
  return catalogResult(async () => {
    if (!deps.authorize(actor, "catalog.manage")) throw new CatalogFailure("FORBIDDEN", "No tienes permiso para gestionar guías de tallas.");
    const clean = normalizeGuide(input);
    if ("message" in clean) throw new CatalogFailure("VALIDATION_ERROR", clean.message, clean.field);
    const code = slugify(clean.name);
    if (!code || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.operationKey)) throw new CatalogFailure("VALIDATION_ERROR", "Nombre o formulario inválido. Recarga la página.");
    if (input.id && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion! < 1)) throw new CatalogFailure("VALIDATION_ERROR", "Falta la versión de la guía. Recarga la página.");
    return deps.store.save({ ...input, ...clean, code, actorId: actor.membershipId });
  });
}
