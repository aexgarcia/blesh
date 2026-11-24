import "server-only";

import { parseAuthEnv, parseServerEnv, type AuthEnv, type ServerEnv } from "./env";

let cached: ServerEnv | undefined;

/**
 * Configuración del servidor validada en el primer uso (no al importar),
 * para que el build no exija credenciales que solo se usan en runtime.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Configuración de Auth o `null` si no está completa (bloquea el acceso administrativo). */
export function getAuthEnv(): AuthEnv | null {
  return parseAuthEnv(process.env);
}
