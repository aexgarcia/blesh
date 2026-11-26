import type { MediaErrorCode, MediaImage } from "../contracts";
import { checkByteSize, checkImage, type InspectedImage } from "../domain/image-policy";

export interface ImageProcessor {
  /** Lee formato/dimensiones del contenido real; lanza si no es una imagen decodificable. */
  inspect(bytes: Uint8Array): Promise<InspectedImage>;
  /** Corrige orientación, elimina metadatos (EXIF/GPS) y convierte a WebP. */
  normalize(bytes: Uint8Array): Promise<{ bytes: Uint8Array; width: number; height: number }>;
}

export interface ObjectStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export type MediaRecord = { id: string; objectKey: string; width: number; height: number };

export interface MediaRepository {
  insertReady(input: { objectKey: string; mime: string; bytes: number; width: number; height: number; createdBy: string }): Promise<MediaRecord>;
  findByIds(ids: readonly string[]): Promise<MediaRecord[]>;
}

export type MediaDeps = {
  processor: ImageProcessor;
  storage: ObjectStorage;
  repository: MediaRepository;
  newId: () => string;
};

export type IngestResult = { ok: true; image: MediaImage } | { ok: false; code: MediaErrorCode; message: string };

/**
 * Ingesta de una imagen subida por administración. Solo se almacena el resultado normalizado
 * (WebP sin metadatos) con clave generada por el servidor; el original nunca se publica.
 */
export async function ingestImage(deps: MediaDeps, input: { bytes: Uint8Array; actorId: string }): Promise<IngestResult> {
  const sizeViolation = checkByteSize(input.bytes.byteLength);
  if (sizeViolation) return { ok: false, ...sizeViolation };

  let inspected: InspectedImage;
  try {
    inspected = await deps.processor.inspect(input.bytes);
  } catch {
    return { ok: false, code: "INVALID_IMAGE", message: "El archivo no es una imagen válida." };
  }
  const violation = checkImage(inspected);
  if (violation) return { ok: false, ...violation };

  const normalized = await deps.processor.normalize(input.bytes);
  const objectKey = `products/${deps.newId()}.webp`;
  try {
    await deps.storage.put(objectKey, normalized.bytes, "image/webp");
  } catch {
    return { ok: false, code: "STORAGE_ERROR", message: "No se pudo guardar la imagen. Inténtalo de nuevo." };
  }

  try {
    const record = await deps.repository.insertReady({
      objectKey,
      mime: "image/webp",
      bytes: normalized.bytes.byteLength,
      width: normalized.width,
      height: normalized.height,
      createdBy: input.actorId,
    });
    return { ok: true, image: { id: record.id, url: deps.storage.publicUrl(objectKey), width: record.width, height: record.height } };
  } catch (error) {
    await deps.storage.delete(objectKey).catch(() => undefined);
    throw error;
  }
}

export async function resolveImages(deps: { repository: MediaRepository; storage: Pick<ObjectStorage, "publicUrl"> }, ids: readonly string[]): Promise<Map<string, MediaImage>> {
  if (ids.length === 0) return new Map();
  const records = await deps.repository.findByIds([...new Set(ids)]);
  return new Map(records.map((r) => [r.id, { id: r.id, url: deps.storage.publicUrl(r.objectKey), width: r.width, height: r.height }]));
}
