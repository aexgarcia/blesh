import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Con NODE_ENV=test, @next/env no carga `.env.local`. Las pruebas de integración leen
 * `.env.test.local` si existe y, si no, `.env.local` (valores locales de desarrollo).
 * Las variables ya definidas en el entorno tienen prioridad.
 */
export function loadTestEnv() {
  for (const name of [".env.test.local", ".env.local"]) {
    const file = path.resolve(process.cwd(), name);
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
