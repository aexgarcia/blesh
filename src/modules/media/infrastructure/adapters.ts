import type { SupabaseClient } from "@supabase/supabase-js";
import { inArray } from "drizzle-orm";
import sharp from "sharp";

import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { ImageProcessor, MediaRepository, ObjectStorage } from "../application/ingest-image";
import { mediaAssets } from "./schema";

/** Límite de píxeles decodificados (evita "bombas" de descompresión). */
const MAX_INPUT_PIXELS = 40_000_000;

export const sharpImageProcessor: ImageProcessor = {
  async inspect(bytes) {
    const meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
    if (!meta.format || !meta.width || !meta.height) throw new Error("Imagen no decodificable");
    // Con orientación EXIF 5–8 el ancho/alto visibles están intercambiados.
    const rotated = (meta.orientation ?? 1) >= 5;
    return {
      format: meta.format,
      width: rotated ? meta.height : meta.width,
      height: rotated ? meta.width : meta.height,
      pages: meta.pages,
    };
  },
  async normalize(bytes) {
    // `rotate()` aplica la orientación EXIF; la salida no conserva metadatos (sin withMetadata()).
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    return { bytes: new Uint8Array(data), width: info.width, height: info.height };
  },
};

export function createSupabaseObjectStorage(client: SupabaseClient, publicBaseUrl: string, bucket = "catalog"): ObjectStorage {
  return {
    async put(key, bytes, contentType) {
      const { error } = await client.storage.from(bucket).upload(key, bytes, { contentType, upsert: false, cacheControl: "31536000" });
      if (error) throw new Error(`Storage upload: ${error.message}`);
    },
    async delete(key) {
      const { error } = await client.storage.from(bucket).remove([key]);
      if (error) throw new Error(`Storage delete: ${error.message}`);
    },
    publicUrl(key) {
      return `${publicBaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${key}`;
    },
  };
}

export function createMediaRepository(db: AnyDatabase): MediaRepository {
  return {
    async insertReady(input) {
      const [row] = await db.insert(mediaAssets).values({ ...input, status: "ready" }).returning();
      return { id: row.id, objectKey: row.objectKey, width: row.width, height: row.height };
    },
    async findByIds(ids) {
      const rows = await db
        .select({ id: mediaAssets.id, objectKey: mediaAssets.objectKey, width: mediaAssets.width, height: mediaAssets.height })
        .from(mediaAssets)
        .where(inArray(mediaAssets.id, [...ids]));
      return rows;
    },
  };
}

/** Solo resuelve URLs públicas del bucket (lectura de la tienda, sin credenciales). */
export function publicUrlOnlyStorage(publicBaseUrl: string, bucket = "catalog"): Pick<ObjectStorage, "publicUrl"> {
  return { publicUrl: (key) => `${publicBaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${key}` };
}
