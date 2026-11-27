/**
 * Crea o actualiza los buckets públicos `catalog` y `content` (idempotente). Ejecutar una vez por entorno:
 *   npm run storage:setup
 * Solo imágenes WebP ya normalizadas por el servidor; máximo 5 MB.
 */
import { loadEnvConfig } from "@next/env";

import { parseAuthEnv } from "../src/infrastructure/config/env";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/admin-client";

const BUCKETS = [
  { name: "catalog", options: { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/webp"] }, label: "WebP, 5 MB" },
  // Portada (hero, banners, reels): imágenes WebP y videos MP4 cargados por operación.
  { name: "content", options: { public: true, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: ["image/webp", "video/mp4"] }, label: "WebP/MP4, 20 MB" },
];

async function main() {
  loadEnvConfig(process.cwd());
  const env = parseAuthEnv(process.env);
  if (!env) throw new Error("Falta configuración de Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY).");
  const client = createSupabaseAdminClient(env);

  for (const bucket of BUCKETS) {
    const { data: existing } = await client.storage.getBucket(bucket.name);
    const { error } = existing ? await client.storage.updateBucket(bucket.name, bucket.options) : await client.storage.createBucket(bucket.name, bucket.options);
    if (error) throw new Error(error.message);
    console.log(`✓ Bucket «${bucket.name}» ${existing ? "actualizado" : "creado"} (público, ${bucket.label}).`);
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
