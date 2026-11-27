import { z } from "zod";

import type { HomeSections } from "../contracts";
import { isHomeTarget } from "../domain/home-links";
import { generalSettingsSchema } from "./general-settings";

const title = z.string().trim().min(1).max(100);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const assetKey = z.string().max(200).regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+$/).refine((s) => !s.includes(".."));
const imageKey = assetKey.regex(/\.webp$/);
const target = z.string().refine(isHomeTarget, "Selecciona un destino interno de la tienda.");
export const heroSectionSchema = z.object({
  enabled: z.boolean(), eyebrow: z.string().trim().max(150), title,
  imageKey: z.union([z.literal(""), imageKey]), imageAlt: z.string().trim().max(200),
  ctaLabel: z.string().trim().min(1).max(60), ctaHref: target,
  meta: z.array(z.string().trim().min(1).max(80)).max(4), metaRight: z.string().trim().max(150),
}).refine((v) => !v.imageKey || Boolean(v.imageAlt), { path: ["imageAlt"], message: "Describe la imagen de portada." });
export const collectionsSectionSchema = z.object({
  enabled: z.boolean(), eyebrow: z.string().trim().max(150), title,
  items: z.array(z.object({ id: z.uuid(), title, text: z.string().trim().max(300), href: target.refine((value) => value.startsWith("/"), "Selecciona una categoría, producto o catálogo."), imageKey, imageAlt: z.string().trim().min(1).max(200) })).max(8),
}).superRefine((v, ctx) => {
  if (v.enabled && !v.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Añade al menos una colección o desactiva la sección." });
  if (new Set(v.items.map((i) => i.id)).size !== v.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Hay colecciones repetidas." });
});
export const packSectionSchema = z.object({ enabled: z.boolean(), eyebrow: z.string().trim().max(150), title });
export const reelsSectionSchema = z.object({
  enabled: z.boolean(), eyebrow: z.string().trim().max(150), title,
  handle: z.string().trim().max(60),
  moreUrl: z.union([z.literal(""), z.url().refine((url) => {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && ["www.tiktok.com", "tiktok.com", "www.instagram.com", "instagram.com"].includes(u.hostname);
  }, "Usa un enlace HTTPS de Instagram o TikTok.")]),
  items: z.array(z.object({ id: z.uuid(), title, productSlug: slug, videoKey: assetKey.regex(/\.mp4$/), posterKey: assetKey.regex(/\.webp$/) })).max(8),
}).superRefine((data, ctx) => {
  if (data.enabled && !data.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Añade al menos un video para mostrar la sección." });
  if (new Set(data.items.map((i) => i.id)).size !== data.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Los videos tienen identificadores repetidos." });
});

export class SectionFailure extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

export type SectionActor = { membershipId: string; role: "owner" | "operator" };
export type SectionStore = {
  save(input: { key: keyof HomeSections; data: Record<string, unknown>; expectedVersion: number; operationKey: string; actorId: string }): Promise<void>;
};

export async function saveSection<K extends keyof HomeSections>(deps: { store: SectionStore; authorize: (actor: SectionActor) => boolean }, actor: SectionActor, key: K, input: { data: HomeSections[K]; expectedVersion: number; operationKey: string }) {
  if (!deps.authorize(actor)) throw new SectionFailure("FORBIDDEN", "Solo el propietario puede modificar la tienda.");
  const parsed = ({ general: generalSettingsSchema, hero: heroSectionSchema, collections: collectionsSectionSchema, pack: packSectionSchema, reels: reelsSectionSchema }[key]).safeParse(input.data);
  if (!parsed.success) throw new SectionFailure("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(" "));
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !z.uuid().safeParse(input.operationKey).success) throw new SectionFailure("VALIDATION_ERROR", "Formulario inválido. Recarga la página.");
  await deps.store.save({ ...input, key, data: parsed.data, actorId: actor.membershipId });
}
