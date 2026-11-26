import "server-only";

import { listAdminCategories, listStorefrontProductOptions } from "@/modules/catalog/server";
import { readGeneralSettings, readHomeSections, SectionFailure } from "@/modules/content/server";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";
import { listReelAssets } from "@/modules/media/server";
import { getAdminPackSettings } from "@/modules/sales/server";
import { getStorageBaseUrl } from "@/infrastructure/config/server";

/** Lecturas por sección: cada editor carga los datos que utiliza. */
function authorize(actor: AdminActor) {
  if (!actorCan(actor, "content.manage")) throw new SectionFailure("FORBIDDEN", "Solo el propietario puede configurar la tienda.");
}

export async function getStorefrontGeneralEditor(actor: AdminActor) {
  authorize(actor);
  const [section, assets] = await Promise.all([readGeneralSettings(), listReelAssets(actor)]);
  return { section, images: assets.filter((a) => a.kind === "image").map((a) => a.key), assetBase: `${getStorageBaseUrl()}/storage/v1/object/public/content/` };
}

export async function getStorefrontVisualEditor(actor: AdminActor) {
  authorize(actor);
  const [sections, products, assets, categories] = await Promise.all([readHomeSections(), listStorefrontProductOptions(), listReelAssets(actor), listAdminCategories(actor)]);
  return { sections, options: { products, assets, categories: categories.filter((c) => c.active), assetBase: `${getStorageBaseUrl()}/storage/v1/object/public/content/` } };
}

export async function getStorefrontPackEditor(actor: AdminActor) {
  authorize(actor);
  const [sections, pack, products] = await Promise.all([readHomeSections(), getAdminPackSettings(actor), listStorefrontProductOptions()]);
  return { section: sections.pack, pack, products };
}

export async function getStorefrontReelsEditor(actor: AdminActor) {
  authorize(actor);
  const [sections, products, assets] = await Promise.all([readHomeSections(), listStorefrontProductOptions(), listReelAssets(actor)]);
  return { section: sections.reels, products, assets, assetBase: `${getStorageBaseUrl()}/storage/v1/object/public/content/` };
}

export async function getStorefrontLibrary(actor: AdminActor) {
  authorize(actor);
  return { assets: await listReelAssets(actor), assetBase: `${getStorageBaseUrl()}/storage/v1/object/public/content/` };
}
