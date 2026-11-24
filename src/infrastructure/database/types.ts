import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Tipo de base de datos aceptado por repositorios. Sin `server-only` para que los
 * scripts de operación y las pruebas de integración puedan inyectar su propia conexión.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDatabase = PostgresJsDatabase<any>;
