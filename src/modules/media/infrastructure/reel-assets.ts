import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { checkImage } from "../domain/image-policy";
import { videoProblem } from "../domain/video-policy";
import { createSupabaseObjectStorage, sharpImageProcessor } from "./adapters";

export async function listReelAssetsWithin(client: SupabaseClient) {
  const folders = await Promise.all(["hero", "collections", "banner", "reels"].map(async (folder) => {
    const assets: { key: string; kind: "video" | "image" }[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.storage.from("content").list(folder, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error("No se pudo leer la biblioteca de la tienda.");
      for (const a of data ?? []) if (a.id && /\.(mp4|webp)$/.test(a.name)) assets.push({ key: `${folder}/${a.name}`, kind: a.name.endsWith(".mp4") ? "video" : "image" });
      if ((data?.length ?? 0) < 100) break;
    }
    return assets;
  }));
  return folders.flat();
}

export async function uploadReelAssetWithin(client: SupabaseClient, origin: string, file: File, kind: "video" | "image") {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return { ok: false as const, message: "Selecciona un archivo de hasta 5 MB." };
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  if (kind === "video") {
    const problem = videoProblem(bytes);
    if (problem) return { ok: false as const, message: problem };
  } else {
    try {
      const inspected = await sharpImageProcessor.inspect(bytes);
      const problem = checkImage(inspected);
      if (problem) return { ok: false as const, message: problem.message };
      bytes = (await sharpImageProcessor.normalize(bytes)).bytes;
    } catch { return { ok: false as const, message: "La portada no es una imagen válida." }; }
  }
  const key = `reels/${randomUUID()}.${kind === "video" ? "mp4" : "webp"}`;
  await createSupabaseObjectStorage(client, origin, "content").put(key, bytes, kind === "video" ? "video/mp4" : "image/webp");
  return { ok: true as const, key };
}
