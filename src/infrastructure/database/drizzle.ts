import { drizzle } from "drizzle-orm/postgres-js";
import type postgres from "postgres";

import * as schema from "./schema";

/**
 * Única fábrica de instancias Drizzle (app, scripts y pruebas). Fija `casing: snake_case`:
 * los esquemas usan claves camelCase y las columnas reales son snake_case.
 */
export function createDrizzle(sql: postgres.Sql) {
  return drizzle(sql, { schema, casing: "snake_case" });
}
