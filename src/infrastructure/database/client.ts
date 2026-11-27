import "server-only";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/infrastructure/config/server";

import { createDrizzle } from "./drizzle";
import type * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** Transacción de Drizzle; uso interno de fachadas de servidor. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type DatabaseHandle = { sql: postgres.Sql };

// Solo el pool sobrevive al recargado de módulos, no la caché de columnas de Drizzle.
const globalForDb = globalThis as unknown as { __bleshDb?: DatabaseHandle };

function createHandle(): DatabaseHandle {
  const env = getServerEnv();
  const sql = postgres(env.DATABASE_URL, {
    // En el build cada worker abre su propio pool: una conexión por worker evita agotar
    // el límite del pooler de Supabase (EMAXCONNSESSION) al prerenderizar en paralelo.
    max: process.env.NEXT_PHASE === "phase-production-build" ? 1 : env.DATABASE_POOL_MAX,
    // El pooler de Supabase en modo transacción no admite sentencias preparadas.
    prepare: env.DATABASE_PREPARE,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: "blesh-web" },
  });
  return { sql };
}

/** Cliente runtime (rol con permisos mínimos). Se crea de forma perezosa. */
export function getDb(): Database {
  globalForDb.__bleshDb ??= createHandle();
  // Un esquema actualizado puede añadir columnas a una tabla ya cacheada por Drizzle.
  // Una instancia ligera nueva evita reutilizar ese mapa; las conexiones siguen siendo las mismas.
  return createDrizzle(globalForDb.__bleshDb.sql);
}
