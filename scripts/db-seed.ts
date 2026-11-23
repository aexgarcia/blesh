/**
 * Carga datos ficticios de desarrollo. Solo se ejecuta contra una base local
 * (localhost/127.0.0.1) con APP_ENV=development|test; nunca en preview/producción.
 *
 * Cada módulo añadirá aquí su seeder idempotente cuando existan sus tablas
 * (p. ej. categorías iniciales en la fase de Productos). No fabricar stock real.
 */
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { appEnvSchema } from "../src/infrastructure/config/env";

type Seeder = { name: string; run: (tx: postgres.TransactionSql) => Promise<void> };

const seeders: Seeder[] = [];

function assertLocalTarget(databaseUrl: string, appEnv: string) {
  const env = appEnvSchema.parse(appEnv);
  if (env !== "development" && env !== "test") {
    throw new Error(`Seed bloqueado: APP_ENV=${env}. Solo development o test.`);
  }
  const host = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Seed bloqueado: la base no es local (${host}).`);
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("Falta MIGRATION_DATABASE_URL (ver .env.example).");
  assertLocalTarget(url, process.env.APP_ENV ?? "development");

  const sql = postgres(url, { max: 1 });
  try {
    if (seeders.length === 0) {
      await sql`select 1`;
      console.log("Conexión correcta. Aún no hay seeders: los módulos los añaden al crear sus tablas.");
      return;
    }
    for (const seeder of seeders) {
      await sql.begin(async (tx) => seeder.run(tx));
      console.log(`✓ ${seeder.name}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
