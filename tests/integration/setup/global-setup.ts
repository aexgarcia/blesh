import path from "node:path";

import { loadTestEnv } from "../../support/load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Aplica las migraciones a la base aislada de pruebas (nunca a la de desarrollo). */
export default async function setup() {
  loadTestEnv();
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!url || !process.env.TEST_DATABASE_URL) {
    throw new Error("Faltan TEST_DATABASE_URL y TEST_MIGRATION_DATABASE_URL (ver .env.example) y `npm run db:up`.");
  }
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("Las pruebas de integración solo se ejecutan contra una base *_test.");

  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.resolve(process.cwd(), "db/migrations"), migrationsSchema: "drizzle" });
  } finally {
    await sql.end();
  }
}
