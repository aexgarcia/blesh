import { loadTestEnv } from "./load-env";
import { createDrizzle } from "../../src/infrastructure/database/drizzle";
import postgres from "postgres";

loadTestEnv();

/** Conexión runtime (permisos mínimos) a la base de pruebas, como la aplicación real. */
export function openTestDb() {
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 10, onnotice: () => undefined });
  return { sql, db: createDrizzle(sql) };
}

/** Limpia tablas con la credencial de migración (el runtime no puede borrar auditoría). */
export async function resetTables(tables: string[]) {
  const sql = postgres(process.env.TEST_MIGRATION_DATABASE_URL!, { max: 1, onnotice: () => undefined });
  try {
    await sql.unsafe(`truncate ${tables.map((t) => `app.${t}`).join(", ")} cascade`);
  } finally {
    await sql.end();
  }
}
