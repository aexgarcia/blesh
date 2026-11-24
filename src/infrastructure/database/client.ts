import "server-only";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/infrastructure/config/server";

import { createDrizzle } from "./drizzle";
import type * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** Transacción de Drizzle; uso interno de fachadas de servidor. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type DatabaseHandle = { db: Database; sql: postgres.Sql };

// En desarrollo, el recargado de módulos crearía un pool por edición: reutilizarlo.
const globalForDb = globalThis as unknown as { __bleshDb?: DatabaseHandle };

function createHandle(): DatabaseHandle {
  const env = getServerEnv();
  const sql = postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX,
    // El pooler de Supabase en modo transacción no admite sentencias preparadas.
    prepare: env.DATABASE_PREPARE,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: "blesh-web" },
  });
  return { sql, db: createDrizzle(sql) };
}

/** Cliente runtime (rol con permisos mínimos). Se crea de forma perezosa. */
export function getDb(): Database {
  globalForDb.__bleshDb ??= createHandle();
  return globalForDb.__bleshDb.db;
}
