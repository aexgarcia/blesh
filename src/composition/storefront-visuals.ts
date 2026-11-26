import "server-only";

import type { AnyDatabase } from "@/infrastructure/database/types";
import { collectionsSectionSchema, heroSectionSchema, homeTargetAvailable, saveHomeSectionWithin, SectionFailure } from "@/modules/content/server";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";

type Dependencies = { db: AnyDatabase; assets: { key: string; kind: string }[]; products: { slug: string; status: string }[]; categories: { slug: string }[] };

export async function saveHomeVisuals(deps: Dependencies, actor: AdminActor, key: "hero" | "collections", input: { data: unknown; expectedVersion: number; operationKey: string }) {
  if (!actorCan(actor, "content.manage")) throw new SectionFailure("FORBIDDEN", "Solo el propietario puede modificar la tienda.");
  const parsed = (key === "hero" ? heroSectionSchema : collectionsSectionSchema).safeParse(input.data);
  if (!parsed.success) throw new SectionFailure("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(" "));
  const data = parsed.data;
  const entries = "ctaHref" in data ? [{ href: data.ctaHref, imageKey: data.imageKey }] : data.items;
  if (entries.some((i) => i.imageKey && !deps.assets.some((a) => a.key === i.imageKey && a.kind === "image"))) throw new SectionFailure("VALIDATION_ERROR", "Selecciona imágenes existentes de la biblioteca de la tienda.");
  if (data.enabled && entries.some((i) => !homeTargetAvailable(i.href, deps.categories, deps.products))) throw new SectionFailure("VALIDATION_ERROR", "Selecciona destinos activos: categorías o productos publicados.");
  await deps.db.transaction((tx) => key === "hero"
    ? saveHomeSectionWithin(tx as unknown as AnyDatabase, actor, key, { ...input, data: heroSectionSchema.parse(data) })
    : saveHomeSectionWithin(tx as unknown as AnyDatabase, actor, key, { ...input, data: collectionsSectionSchema.parse(data) }));
}
