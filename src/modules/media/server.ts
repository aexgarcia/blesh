import "server-only";

import { randomUUID } from "node:crypto";

import { getAuthEnv } from "@/infrastructure/config/server";
import { getDb } from "@/infrastructure/database/client";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";

import { ingestImage, resolveImages, type IngestResult, type MediaDeps } from "./application/ingest-image";
import type { MediaImage } from "./contracts";
import { createMediaRepository, createSupabaseObjectStorage, sharpImageProcessor } from "./infrastructure/adapters";

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
