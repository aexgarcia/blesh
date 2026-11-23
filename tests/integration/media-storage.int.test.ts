/**
 * Ingesta de imágenes contra Supabase Storage local real (bucket `catalog`).
 */
import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";

import { parseAuthEnv } from "@/infrastructure/config/env";
import { createSupabaseAdminClient } from "@/infrastructure/supabase/admin-client";
import { ingestImage, resolveImages, type MediaDeps } from "@/modules/media/application/ingest-image";
import { createMediaRepository, createSupabaseObjectStorage, sharpImageProcessor } from "@/modules/media/infrastructure/adapters";

import { openTestDb } from "../support/test-db";

const env = parseAuthEnv(process.env);
if (!env) throw new Error("Falta configuración de Supabase (npm run auth:up).");

const { sql, db } = openTestDb();
const client = createSupabaseAdminClient(env);
const deps: MediaDeps = {
  processor: sharpImageProcessor,
  storage: createSupabaseObjectStorage(client, env.SUPABASE_URL),
  repository: createMediaRepository(db),
  newId: randomUUID,
};
const uploaded: string[] = [];

afterAll(async () => {
  if (uploaded.length) await client.storage.from("catalog").remove(uploaded);
  await sql.end();
});

describe("media + Supabase Storage", () => {
  it("guarda WebP normalizado accesible por URL pública y registra metadatos", async () => {
    const jpeg = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: "#2f3030" } }).jpeg().toBuffer();
    const result = await ingestImage(deps, { bytes: new Uint8Array(jpeg), actorId: randomUUID() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    uploaded.push(new URL(result.image.url).pathname.split("/catalog/")[1]);

    const response = await fetch(result.image.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");

    const resolved = await resolveImages(deps, [result.image.id]);
    expect(resolved.get(result.image.id)).toMatchObject({ width: 1200, height: 1500, url: result.image.url });
  });

  it("el bucket rechaza subidas directas que no sean WebP", async () => {
    const { error } = await client.storage.from("catalog").upload(`products/${randomUUID()}.svg`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
    expect(error).not.toBeNull();
  });
});
