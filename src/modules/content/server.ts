import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getStorageBaseUrl, getStorefrontConfig } from "@/infrastructure/config/server";
import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";
import { CATALOG_CACHE_TAG, listCategoryOptions, listPublicCategories, listStorefrontProductOptions } from "@/modules/catalog/server";

import { CONTENT_BUCKET, CONTENT_CACHE_TAG, type ContentImage, type ContentLink, type StorefrontContent, type HomeSections, type HomeSectionSnapshots } from "./contracts";
import { CONFIRMATIONS, CONTENT_VERSION, RAW_CONTENT, type Copy } from "./infrastructure/storefront-content";
import { saveSection, packSectionSchema, reelsSectionSchema, heroSectionSchema, collectionsSectionSchema } from "./application/section-settings";
import { homeTargetAvailable } from "./domain/home-links";
import { readSections, sectionStoreWithin } from "./infrastructure/section-store";
import { generalSettingsSchema } from "./application/general-settings";

export { SectionFailure } from "./application/section-settings";
export { heroSectionSchema, collectionsSectionSchema } from "./application/section-settings";
export { homeTargetAvailable } from "./domain/home-links";
export { generalSettingsSchema } from "./application/general-settings";
import { DEFAULT_WELCOME_OFFER } from "./application/general-settings";

/** Código de bienvenida vigente (solo si está activo), para validar el cupón de una solicitud. */
export async function getActiveWelcomeCode(db: AnyDatabase = getDb()): Promise<string | null> {
  const { data } = await readGeneralSettings(db);
  return data.welcomeOffer.enabled && data.welcomeOffer.code ? data.welcomeOffer.code : null;
}

function defaultGeneralSettings(): HomeSections["general"] {
  return { welcomeOffer: DEFAULT_WELCOME_OFFER, businessName: "BLESH", legalName: "", taxId: "", location: RAW_CONTENT.footer.location, address: "", openingHours: "", orderWhatsapp: getStorefrontConfig().whatsappNumber ?? "", contactWhatsapp: "", email: "", instagramUrl: RAW_CONTENT.socials.instagram.href, tiktokUrl: RAW_CONTENT.socials.tiktok.href, floatingWhatsapp: true };
}

export async function readGeneralSettings(db: AnyDatabase = getDb()): Promise<HomeSectionSnapshots["general"]> {
  const rows = await readSections(db);
  const row = rows.find((r) => r.key === "general");
  return { data: row ? generalSettingsSchema.parse(row.data) : defaultGeneralSettings(), version: row?.version ?? 0 };
}

export async function getCachedGeneralSettings() {
  "use cache";
  cacheTag(CONTENT_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return (await readGeneralSettings()).data;
}

export function defaultHomeSections(): HomeSections {
  return {
    general: defaultGeneralSettings(),
    hero: { enabled: true, eyebrow: RAW_CONTENT.hero.eyebrow, title: RAW_CONTENT.hero.title, imageKey: RAW_CONTENT.hero.image.key, imageAlt: RAW_CONTENT.hero.image.alt, ctaLabel: RAW_CONTENT.hero.cta.label, ctaHref: RAW_CONTENT.hero.cta.href, meta: RAW_CONTENT.hero.meta, metaRight: copy(RAW_CONTENT.hero.metaRight) ?? "" },
    collections: { enabled: true, eyebrow: RAW_CONTENT.collections.eyebrow, title: RAW_CONTENT.collections.title, items: RAW_CONTENT.collections.items.map((item, i) => ({ id: `00000000-0000-4000-8001-${String(i+1).padStart(12,"0")}`, title: item.title, text: item.text, href: item.href, imageKey: item.image.key, imageAlt: item.image.alt })) },
    pack: { enabled: true, title: RAW_CONTENT.pack.title, eyebrow: RAW_CONTENT.pack.eyebrow },
    reels: { enabled: true, title: RAW_CONTENT.reels.title, eyebrow: RAW_CONTENT.reels.eyebrow, handle: RAW_CONTENT.reels.handle, moreUrl: RAW_CONTENT.socials.tiktok.href,
      items: RAW_CONTENT.reels.items.map((r, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, title: r.title, productSlug: r.productSlug, videoKey: r.video, posterKey: r.poster })) },
  };
}

export async function readHomeSections(db: AnyDatabase = getDb()): Promise<HomeSectionSnapshots> {
  const defaults = defaultHomeSections();
  const rows = await readSections(db);
  const pack = rows.find((r) => r.key === "pack");
  const reels = rows.find((r) => r.key === "reels");
  const hero = rows.find((r) => r.key === "hero");
  const collections = rows.find((r) => r.key === "collections");
  const general = rows.find((r) => r.key === "general");
  return { general: { data: general ? generalSettingsSchema.parse(general.data) : defaults.general, version: general?.version ?? 0 }, hero: { data: hero ? heroSectionSchema.parse(hero.data) : defaults.hero, version: hero?.version ?? 0 }, collections: { data: collections ? collectionsSectionSchema.parse(collections.data) : defaults.collections, version: collections?.version ?? 0 }, pack: { data: pack ? packSectionSchema.parse(pack.data) : defaults.pack, version: pack?.version ?? 0 }, reels: { data: reels ? reelsSectionSchema.parse(reels.data) : defaults.reels, version: reels?.version ?? 0 } };
}

export async function getPublicHomeSections() {
  "use cache";
  cacheTag(CONTENT_CACHE_TAG);
  cacheTag(CATALOG_CACHE_TAG);
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  const [sections, categories, products, publicCategories] = await Promise.all([readHomeSections(), listCategoryOptions(), listStorefrontProductOptions(), listPublicCategories()]);
  const hero = sections.hero.data;
  const validHero = homeTargetAvailable(hero.ctaHref, categories, products) && !(hero.ctaHref === "#pack" && !sections.pack.data.enabled) && !(hero.ctaHref === "#movimiento" && !sections.reels.data.enabled);
  return { categories: publicCategories, hero: { ...hero, ctaHref: validHero ? hero.ctaHref : "/productos" }, collections: { ...sections.collections.data, items: sections.collections.data.items.filter((i) => homeTargetAvailable(i.href, categories, products)) }, pack: sections.pack.data, reels: sections.reels.data };
}

export function saveHomeSectionWithin<K extends keyof HomeSections>(db: AnyDatabase, actor: AdminActor, key: K, input: { data: HomeSections[K]; expectedVersion: number; operationKey: string }) {
  return saveSection({ store: sectionStoreWithin(db), authorize: (a) => actorCan(a as AdminActor, "content.manage") }, actor, key, input);
}

/** Texto final: el confirmado o su alternativa (null = no mostrar). */
function copy(value: Copy): string | null {
  if (typeof value === "string") return value;
  return CONFIRMATIONS[value.requires] ? value.text : value.fallback;
}

const text = (value: Copy) => copy(value) ?? "";

/**
 * Contenido de la tienda listo para renderizar: URLs públicas del bucket `content` y textos
 * sujetos a confirmación ya resueltos. Sin almacenamiento configurado, las imágenes son null
 * y la tienda muestra fondos de marca.
 */
export async function getStorefrontContent(): Promise<StorefrontContent> {
  const [managed, general] = await Promise.all([getPublicHomeSections(), getCachedGeneralSettings()]);
  const base = getStorageBaseUrl();
  const asset = (key: string) => (base ? `${base}/storage/v1/object/public/${CONTENT_BUCKET}/${key}` : null);
  const image = (ref: { key: string; alt: string }): ContentImage | null => {
    const url = asset(ref.key);
    return url ? { url, alt: ref.alt } : null;
  };
  const raw = RAW_CONTENT;
  const whatsapp: ContentLink | null = general.contactWhatsapp ? { label: `WhatsApp · +${general.contactWhatsapp}`, href: `https://wa.me/${general.contactWhatsapp}`, external: true } : null;
  const email: ContentLink | null = general.email ? { label: general.email, href: `mailto:${general.email}` } : null;
  const instagram: ContentLink | null = general.instagramUrl ? { label: "Instagram", href: general.instagramUrl, external: true } : null;
  const tiktok: ContentLink | null = general.tiktokUrl ? { label: "TikTok", href: general.tiktokUrl, external: true } : null;
  const contactLinks: ContentLink[] = [
    ...[whatsapp, email, instagram, tiktok].filter((link): link is ContentLink => link !== null),
  ];

  return {
    version: CONTENT_VERSION,
    business: { name: general.businessName, legalName: general.legalName, taxId: general.taxId, address: general.address, openingHours: general.openingHours },
    floatingWhatsapp: general.floatingWhatsapp ? whatsapp : null,
    welcomeOffer: general.welcomeOffer.enabled && general.welcomeOffer.code
      ? (({ enabled: _e, imageKey, ...offer }) => { void _e; return { ...offer, imageUrl: imageKey ? asset(imageKey) : null }; })(general.welcomeOffer)
      : null,
    announcements: raw.announcements.map(copy).filter((t): t is string => t !== null && (managed.pack.enabled || !t.startsWith("ARMA TU PACK"))),
    hero: { enabled: managed.hero.enabled, eyebrow: managed.hero.eyebrow, title: managed.hero.title, image: managed.hero.imageKey ? image({ key: managed.hero.imageKey, alt: managed.hero.imageAlt }) : null, cta: { label: managed.hero.ctaLabel, href: managed.hero.ctaHref }, meta: managed.hero.meta, metaRight: managed.hero.metaRight || null },
    drop: raw.drop,
    collections: { ...managed.collections, items: managed.collections.items.map((i) => ({ id: i.id, title: i.title, text: i.text, href: i.href, image: image({ key: i.imageKey, alt: i.imageAlt }) })) },
    pack: { ...raw.pack, ...managed.pack },
    banner: { ...raw.banner, image: image(raw.banner.image) },
    catalog: raw.catalog,
    reels: {
      enabled: managed.reels.enabled,
      eyebrow: managed.reels.eyebrow,
      title: managed.reels.title,
      handle: managed.reels.handle,
      more: managed.reels.moreUrl ? { label: "Ver más →", href: managed.reels.moreUrl, external: true } : null,
      items: managed.reels.items.map((r) => ({ title: r.title, productSlug: r.productSlug, videoUrl: asset(r.videoKey), posterUrl: asset(r.posterKey) })),
    },
    trust: raw.trust.map((t) => ({ icon: t.icon, title: text(t.title), text: text(t.text) })),
    products: raw.products,
    shippingNote: { title: text(raw.shippingNote.title), text: text(raw.shippingNote.text) },
    productChips: raw.productChips.map(copy).filter((t): t is string => t !== null),
    policiesText: { shipping: text(raw.policiesText.shipping), changes: text(raw.policiesText.changes) },
    footer: {
      community: { ...raw.footer.community, enabled: CONFIRMATIONS.newsletter },
      shopLinks: managed.categories.map((c) => ({ label: c.name, href: `/categorias/${c.slug}` })),
      contactLinks,
      policyLinks: CONFIRMATIONS.policies ? raw.footer.policyLinks : [],
      policiesPending: !CONFIRMATIONS.policies,
      copyright: `${general.businessName}. Todos los derechos reservados.`,
      location: general.location,
    },
    socials: {
      instagram, tiktok, whatsapp, email,
    },
    nav: raw.nav.filter((link) => (managed.pack.enabled || !link.href.endsWith("#pack")) && (managed.reels.enabled || !link.href.endsWith("#movimiento"))),
  };
}

export { PROTOTYPE_CONTENT_ASSETS } from "./infrastructure/storefront-content";
