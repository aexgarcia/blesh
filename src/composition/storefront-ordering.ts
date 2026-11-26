import "server-only";

import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import { getCachedGeneralSettings, readGeneralSettings } from "@/modules/content/server";
import { getOrderingStatus, submitStorefrontRequest } from "@/modules/sales/server";

export async function getStoreOrderingStatus() {
  const general = await getCachedGeneralSettings();
  return getOrderingStatus(general.orderWhatsapp || null);
}

/** El destino se lee de nuevo al enviar; no procede del navegador ni de su caché. */
export async function submitConfiguredStorefrontRequest(input: Parameters<typeof submitStorefrontRequest>[0], guards: Parameters<typeof submitStorefrontRequest>[1], db: AnyDatabase = getDb()) {
  const { data } = await readGeneralSettings(db);
  // Solo viaja el cupón vigente; uno caducado o inventado se descarta sin bloquear la solicitud.
  const offer = data.welcomeOffer;
  const couponCode = input.couponCode && offer.enabled && offer.code && input.couponCode === offer.code ? offer.code : null;
  return submitStorefrontRequest({ ...input, couponCode }, guards, db, data.orderWhatsapp || null);
}
