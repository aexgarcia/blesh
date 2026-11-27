/**
 * Archivos subidos que nada referencia (imágenes de catálogo y biblioteca de la tienda).
 *
 *   npm run storage:orphans              → solo lista (no borra nada)
 *   npm run storage:orphans -- --delete  → borra lo listado
 *
 * Reglas de seguridad:
 * - Solo archivos con más de 24 h (no toca subidas en curso).
 * - Catálogo: `media_assets` sin fila en `product_images`; el borrado vuelve a comprobarlo en la
 *   misma sentencia. Requiere `MIGRATION_DATABASE_URL` (el rol runtime no puede borrar media).
 * - Biblioteca (`content`): archivos cuya clave no aparece en ninguna sección guardada de la tienda
 *   ni en los valores por defecto del código.
 * Ejecutar primero sin `--delete` y revisar la lista.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { parseAuthEnv, parseServerEnv } from "../src/infrastructure/config/env";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/admin-client";

const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const CONTENT_FOLDERS = ["hero", "collections", "banner", "reels"];
const DEFAULTS_FILE = "src/modules/content/infrastructure/storefront-content.ts";

async function main() {
  loadEnvConfig(process.cwd());
  const remove = process.argv.includes("--delete");
  const server = parseServerEnv(process.env);
  const auth = parseAuthEnv(process.env);
  if (!auth) throw new Error("Falta configuración de Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY).");
  const dbUrl = process.env.MIGRATION_DATABASE_URL || server.DATABASE_URL;
  if (remove && !process.env.MIGRATION_DATABASE_URL) throw new Error("Para borrar define MIGRATION_DATABASE_URL (el rol runtime no puede borrar media_assets).");

  const sql = postgres(dbUrl, { max: 1, prepare: server.DATABASE_PREPARE });
  const storage = createSupabaseAdminClient(auth).storage;
  const cutoff = new Date(Date.now() - MIN_AGE_MS);
  try {
    // --- Catálogo -----------------------------------------------------------------------
    const media = await sql<{ id: string; object_key: string; bytes: number }[]>`
      select m.id, m.object_key, m.bytes from app.media_assets m
      where m.created_at < ${cutoff}
        and not exists (select 1 from app.product_images pi where pi.media_id = m.id)
      order by m.created_at`;
    console.log(`Catálogo: ${media.length} imagen(es) sin producto.`);
    for (const m of media) console.log(`  catalog/${m.object_key} (${Math.round(m.bytes / 1024)} KB)`);

    // --- Biblioteca de la tienda --------------------------------------------------------
    const sections = await sql<{ data: unknown }[]>`select data from app.storefront_sections`;
    let haystack = sections.map((s) => JSON.stringify(s.data)).join("\n");
    try {
      haystack += readFileSync(path.join(process.cwd(), DEFAULTS_FILE), "utf8");
    } catch {
      throw new Error(`No se pudo leer ${DEFAULTS_FILE}: sin él no se puede saber qué archivos usan los valores por defecto.`);
    }
    const contentOrphans: string[] = [];
    for (const folder of CONTENT_FOLDERS) {
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await storage.from("content").list(folder, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
        if (error) throw new Error(`No se pudo listar content/${folder}: ${error.message}`);
        for (const file of data ?? []) {
          if (!file.id) continue; // subcarpeta
          const key = `${folder}/${file.name}`;
          const created = file.created_at ? new Date(file.created_at) : null;
          if (!created || created >= cutoff) continue;
          if (!haystack.includes(key)) contentOrphans.push(key);
        }
        if ((data?.length ?? 0) < 100) break;
      }
    }
    console.log(`Biblioteca: ${contentOrphans.length} archivo(s) sin uso.`);
    for (const key of contentOrphans) console.log(`  content/${key}`);

    if (!remove) {
      console.log("\nModo lista: no se borró nada. Revisa y ejecuta con --delete para borrar.");
      return;
    }

    let deleted = 0;
    for (const m of media) {
      // Vuelve a comprobar la referencia en la misma sentencia (un producto pudo usarla mientras tanto).
      const rows = await sql`
        delete from app.media_assets m where m.id = ${m.id}
          and not exists (select 1 from app.product_images pi where pi.media_id = m.id)
        returning m.id`;
      if (rows.length === 0) continue;
      const { error } = await storage.from("catalog").remove([m.object_key]);
      if (error) console.error(`  ! catalog/${m.object_key}: fila borrada, archivo no (${error.message})`);
      deleted++;
    }
    if (contentOrphans.length) {
      const { error } = await storage.from("content").remove(contentOrphans);
      if (error) throw new Error(`No se pudieron borrar archivos de content: ${error.message}`);
    }
    console.log(`✓ Borradas ${deleted} imagen(es) de catálogo y ${contentOrphans.length} archivo(s) de la biblioteca.`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
