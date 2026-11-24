/**
 * Crea o actualiza el bucket público `catalog` (idempotente). Ejecutar una vez por entorno:
 *   npm run storage:setup
 * Solo imágenes WebP ya normalizadas por el servidor; máximo 5 MB.
 */
import { loadEnvConfig } from "@next/env";

import { parseAuthEnv } from "../src/infrastructure/config/env";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/admin-client";

const BUCKET = "catalog";
const OPTIONS = { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["image/webp"] };

async function main() {
  loadEnvConfig(process.cwd());
  const env = parseAuthEnv(process.env);
  if (!env) throw new Error("Falta configuración de Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY).");
  const client = createSupabaseAdminClient(env);

  const { data: existing } = await client.storage.getBucket(BUCKET);
  const { error } = existing ? await client.storage.updateBucket(BUCKET, OPTIONS) : await client.storage.createBucket(BUCKET, OPTIONS);
  if (error) throw new Error(error.message);
  console.log(`✓ Bucket «${BUCKET}» ${existing ? "actualizado" : "creado"} (público, WebP, 5 MB).`);
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
