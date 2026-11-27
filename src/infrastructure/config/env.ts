import { z } from "zod";

/**
 * Esquemas de configuración. Este archivo no tiene efectos ni importa `server-only`
 * para poder reutilizarse desde scripts (migraciones, seed) y pruebas.
 * La aplicación accede a la configuración mediante `./server`.
 */

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const postgresUrl = z
  .url()
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "Debe ser una URL postgres:// o postgresql://",
  );

export const appEnvSchema = z.enum(["development", "test", "preview", "production"]);
export type AppEnv = z.infer<typeof appEnvSchema>;

export const serverEnvSchema = z.object({
  APP_ENV: appEnvSchema.default("development"),
  APP_URL: z.url(),
  DATABASE_URL: postgresUrl,
  DATABASE_PREPARE: booleanFromString.default(true),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
});
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Configuración del proveedor de autenticación administrativa. Solo servidor. */
export const authEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
});
export type AuthEnv = z.infer<typeof authEnvSchema>;

/** Devuelve `null` si falta configuración: el acceso administrativo queda bloqueado. */
export function parseAuthEnv(source: Record<string, string | undefined>): AuthEnv | null {
  const result = authEnvSchema.safeParse(source);
  return result.success ? result.data : null;
}

/**
 * Tienda pública. `WHATSAPP_NUMBER`: número que recibe las solicitudes, solo dígitos con
 * código de país (p. ej. 51 + 9 dígitos), sin `+`. No hay valor por defecto: sin él, las
 * solicitudes quedan deshabilitadas. Fuera de producción se trata siempre como número de prueba.
 */
export const storefrontEnvSchema = z.object({
  WHATSAPP_NUMBER: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, "Solo dígitos con código de país, sin + ni espacios (p. ej. 51987654321)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type StorefrontEnv = z.infer<typeof storefrontEnvSchema>;

/** Error si el número tiene formato inválido: mejor fallar que abrir un chat equivocado. */
export function parseStorefrontEnv(source: Record<string, string | undefined>): StorefrontEnv {
  const result = storefrontEnvSchema.safeParse(source);
  if (!result.success) throw new Error(describeConfigError(result.error));
  return result.data;
}

/** URL base pública del almacenamiento de imágenes (solo la URL; sin claves). */
export function parseStorageBaseUrl(source: Record<string, string | undefined>): string | null {
  const result = z.url().safeParse(source.SUPABASE_URL);
  return result.success ? result.data.replace(/\/$/, "") : null;
}

export const migrationEnvSchema = z.object({
  MIGRATION_DATABASE_URL: postgresUrl,
});

/** Mensaje de error sin valores: nunca imprimir secretos al fallar la validación. */
export function describeConfigError(error: z.ZodError): string {
  const fields = error.issues.map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`);
  return `Configuración inválida o incompleta:\n- ${fields.join("\n- ")}`;
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(describeConfigError(result.error));
  }
  const env = result.data;
  if (env.APP_ENV === "production" && !env.APP_URL.startsWith("https://")) {
    throw new Error("Configuración inválida: APP_URL debe usar https en producción");
  }
  return env;
}

export function parseMigrationEnv(source: Record<string, string | undefined>) {
  const result = migrationEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(describeConfigError(result.error));
  }
  return result.data;
}
