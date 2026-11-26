import "server-only";

import {
  appEnvSchema,
  parseAuthEnv,
  parseServerEnv,
  parseStorageBaseUrl,
  parseStorefrontEnv,
  type AppEnv,
  type AuthEnv,
  type ServerEnv,
} from "./env";

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

export type StorefrontConfig = {
  appEnv: AppEnv;
  /** Número de WhatsApp de solicitudes; null = solicitudes deshabilitadas. */
  whatsappNumber: string | null;
  /** Fuera de producción todo número es de prueba: se muestra un aviso visible. */
  testMode: boolean;
};

/** Configuración de la tienda (solo servidor). Lanza si el número tiene formato inválido. */
export function getStorefrontConfig(): StorefrontConfig {
  const appEnv = appEnvSchema.catch("development").parse(process.env.APP_ENV);
  const env = parseStorefrontEnv(process.env);
  return { appEnv, whatsappNumber: env.WHATSAPP_NUMBER ?? null, testMode: appEnv !== "production" };
}

/** Origen público de las imágenes de catálogo, o null si no hay almacenamiento configurado. */
export function getStorageBaseUrl(): string | null {
  return parseStorageBaseUrl(process.env);
}
