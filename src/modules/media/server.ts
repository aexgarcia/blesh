import "server-only";

import { randomUUID } from "node:crypto";

import { getAuthEnv, getStorageBaseUrl } from "@/infrastructure/config/server";
import { getDb } from "@/infrastructure/database/client";
import type { AnyDatabase } from "@/infrastructure/database/types";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import type { AdminActor } from "@/modules/identity/contracts";
import { actorCan } from "@/modules/identity/server";

import { ingestImage, resolveImages, type IngestResult, type MediaDeps } from "./application/ingest-image";
import type { MediaImage } from "./contracts";
import { createMediaRepository, createSupabaseObjectStorage, publicUrlOnlyStorage, sharpImageProcessor } from "./infrastructure/adapters";
import { listReelAssetsWithin, uploadReelAssetWithin } from "./infrastructure/reel-assets";

function reelClient(actor: AdminActor) {
  if (!actorCan(actor, "content.manage")) throw new Error("FORBIDDEN");
  const env = getAuthEnv();
  if (!env) throw new Error("Almacenamiento no configurado.");
  return { client: createSupabaseAdminClient(env), origin: env.SUPABASE_URL };
}

export function listReelAssets(actor: AdminActor) {
  return listReelAssetsWithin(reelClient(actor).client);
}

export async function uploadReelAsset(actor: AdminActor, file: File, kind: "video" | "image") {
  const { client, origin } = reelClient(actor);
  return uploadReelAssetWithin(client, origin, file, kind);
}

function deps(): MediaDeps {
  const env = getAuthEnv();
  if (!env) throw new Error("Almacenamiento no configurado (SUPABASE_URL / SUPABASE_SECRET_KEY).");
  return {
    processor: sharpImageProcessor,
    storage: createSupabaseObjectStorage(createSupabaseAdminClient(env), env.SUPABASE_URL),
    repository: createMediaRepository(getDb()),
    newId: randomUUID,
  };
}

/** Valida, normaliza y guarda una imagen subida. El llamador debe haber autorizado al actor. */
export async function ingestUploadedImage(file: File, actorId: string): Promise<IngestResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ingestImage(deps(), { bytes, actorId });
}

export async function getImagesByIds(ids: readonly string[]): Promise<Map<string, MediaImage>> {
  return resolveImages(deps(), ids);
}

/**
 * URLs públicas para la tienda: solo necesita la URL del almacenamiento (sin clave secreta).
 * Sin almacenamiento configurado devuelve un mapa vacío y la tienda muestra un marcador.
 */
export async function getPublicImagesByIds(ids: readonly string[], db: AnyDatabase = getDb()): Promise<Map<string, MediaImage>> {
  const base = getStorageBaseUrl();
  if (!base || ids.length === 0) return new Map();
  return resolveImages({ repository: createMediaRepository(db), storage: publicUrlOnlyStorage(base) }, ids);
}
