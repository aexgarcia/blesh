/**
 * Verifica la conexión runtime (DATABASE_URL) contra la base configurada:
 * conectividad, migraciones aplicadas y que el rol no tenga privilegios de más.
 * No escribe datos persistentes (todo dentro de una transacción revertida).
 */
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { parseServerEnv } from "../src/infrastructure/config/env";

class Rollback extends Error {}

async function main() {
  loadEnvConfig(process.cwd());
  const env = parseServerEnv(process.env);
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: env.DATABASE_PREPARE });
  const results: string[] = [];
  const failures: string[] = [];

  try {
    const [{ user, version }] = await sql<{ user: string; version: string }[]>`
      select current_user as user, current_setting('server_version') as version`;
    results.push(`conectado como ${user} (PostgreSQL ${version})`);

    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'app' order by 1`;
    if (tables.length === 0) failures.push("no hay tablas en el esquema app: ejecutar npm run db:migrate");
    else results.push(`tablas visibles: ${tables.map((t) => t.table_name).join(", ")}`);

    await sql
      .begin(async (tx) => {
        await tx`insert into app.audit_events (actor_type, action, resource_type) values ('system', 'db_check', 'database')`;
        results.push("inserción en auditoría permitida");
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });

    const denied = async (label: string, run: (tx: postgres.TransactionSql) => Promise<unknown>) => {
      try {
        await sql.begin(async (tx) => {
          await run(tx);
          throw new Rollback();
        });
      } catch (error) {
        if (error instanceof Rollback) return failures.push(`${label}: el rol runtime NO debería poder hacerlo`);
        if (String(error).includes("permission denied")) return results.push(`${label}: denegado (correcto)`);
        throw error;
      }
    };
    await denied("modificar auditoría", (tx) => tx`update app.audit_events set action = 'x'`);
    await denied("crear tablas", (tx) => tx`create table app.db_check_probe (id int)`);
  } finally {
    await sql.end();
  }

  for (const line of results) console.log(`✓ ${line}`);
  for (const line of failures) console.error(`✗ ${line}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
