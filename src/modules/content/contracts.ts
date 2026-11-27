/**
 * Contenido de la tienda: base versionada y portada/colecciones/pack/reels administrables.
 * Los recursos viven en el bucket público `content` del almacenamiento.
 */

export const CONTENT_BUCKET = "content";
export const CONTENT_CACHE_TAG = "storefront-content";

export type PackSection = { enabled: boolean; eyebrow: string; title: string };
export type ReelEntry = { id: string; title: string; productSlug: string; videoKey: string; posterKey: string };
export type ReelsSection = { enabled: boolean; eyebrow: string; title: string; handle: string; moreUrl: string; items: ReelEntry[] };
export type HeroSection = { enabled: boolean; eyebrow: string; title: string; imageKey: string; imageAlt: string; ctaLabel: string; ctaHref: string; meta: string[]; metaRight: string };
export type CollectionEntry = { id: string; title: string; text: string; href: string; imageKey: string; imageAlt: string };
export type CollectionsSection = { enabled: boolean; eyebrow: string; title: string; items: CollectionEntry[] };
/** Modal de bienvenida con cupón (por ahora el descuento se aplica al coordinar por WhatsApp). */
export type WelcomeOffer = { enabled: boolean; eyebrow: string; title: string; text: string; buttonLabel: string; code: string; terms: string; imageKey: string };
export type GeneralSettings = { welcomeOffer: WelcomeOffer; businessName: string; legalName: string; taxId: string; location: string; address: string; openingHours: string; orderWhatsapp: string; contactWhatsapp: string; email: string; instagramUrl: string; tiktokUrl: string; floatingWhatsapp: boolean };
export type HomeSections = { general: GeneralSettings; hero: HeroSection; collections: CollectionsSection; pack: PackSection; reels: ReelsSection };
export type HomeSectionSnapshots = { [K in keyof HomeSections]: SectionSnapshot<K> };
export type SectionSnapshot<K extends keyof HomeSections> = { data: HomeSections[K]; version: number };

export type ContentImage = { url: string; alt: string };
export type ContentLink = { label: string; href: string; external?: boolean };
export type TrustIcon = "truck" | "ruler" | "card" | "star";

export type StorefrontContent = {
  version: string;
  business: { name: string; legalName: string; taxId: string; address: string; openingHours: string };
  floatingWhatsapp: ContentLink | null;
  /** null si está desactivado o sin código. */
  welcomeOffer: (Omit<WelcomeOffer, "enabled" | "imageKey"> & { imageUrl: string | null }) | null;
  announcements: string[];
  hero: { enabled: boolean; image: ContentImage | null; eyebrow: string; title: string; cta: ContentLink; meta: string[]; metaRight: string | null };
  drop: { eyebrow: string; title: string; productSlugs: string[] };
  collections: { enabled: boolean; eyebrow: string; title: string; items: { id: string; title: string; text: string; href: string; image: ContentImage | null }[] };
  pack: { enabled: boolean; eyebrow: string; title: string; productSlug: string; categorySlug: string };
  banner: { image: ContentImage | null; eyebrow: string; title: string; cta: ContentLink };
  catalog: { eyebrow: string; title: string };
  reels: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    handle: string;
    more: ContentLink | null;
    items: { title: string; productSlug: string; videoUrl: string | null; posterUrl: string | null }[];
  };
  trust: { icon: TrustIcon; title: string; text: string }[];
  /** Extras de ficha por slug de producto (no administrables en V1). */
  products: Record<string, { badge?: string; subtitle?: string; details?: string[]; launchPrice?: boolean }>;
  /** Textos de entrega/cambios de la ficha (dependen de que el negocio confirme la política). */
  shippingNote: { title: string; text: string };
  productChips: string[];
  policiesText: { shipping: string; changes: string };
  footer: {
    community: { title: string; text: string; enabled: boolean };
    shopLinks: ContentLink[];
    contactLinks: ContentLink[];
    policyLinks: ContentLink[];
    policiesPending: boolean;
    copyright: string;
    location: string;
  };
  socials: { instagram: ContentLink | null; tiktok: ContentLink | null; whatsapp: ContentLink | null; email: ContentLink | null };
  /** Navegación principal (anclas del inicio, como el prototipo). */
  nav: ContentLink[];
};
