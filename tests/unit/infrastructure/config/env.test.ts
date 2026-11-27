import { describe, expect, it } from "vitest";

import { parseMigrationEnv, parseServerEnv, parseStorageBaseUrl, parseStorefrontEnv } from "@/infrastructure/config/env";

const valid = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://user:secret-value@localhost:5432/blesh",
};

describe("configuración del servidor", () => {
  it("aplica valores por defecto y convierte tipos", () => {
    const env = parseServerEnv(valid);
    expect(env.DATABASE_PREPARE).toBe(true);
    expect(env.DATABASE_POOL_MAX).toBe(5);
    expect(parseServerEnv({ ...valid, DATABASE_PREPARE: "false" }).DATABASE_PREPARE).toBe(false);
  });

  it("falla sin DATABASE_URL y no filtra secretos en el mensaje", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    try {
      parseServerEnv({ ...valid, DATABASE_URL: "mysql://user:secret-value@host/db" });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("secret-value");
    }
  });

  it("exige https en producción", () => {
    expect(() => parseServerEnv({ ...valid, APP_ENV: "production" })).toThrow(/https/);
  });

  it("separa la credencial de migración", () => {
    expect(() => parseMigrationEnv({})).toThrow(/MIGRATION_DATABASE_URL/);
  });
});

describe("configuración de la tienda", () => {
  it("sin WHATSAPP_NUMBER no hay número por defecto (solicitudes deshabilitadas)", () => {
    expect(parseStorefrontEnv({}).WHATSAPP_NUMBER).toBeUndefined();
    expect(parseStorefrontEnv({ WHATSAPP_NUMBER: "" }).WHATSAPP_NUMBER).toBeUndefined();
  });

  it("acepta solo dígitos con código de país y rechaza formatos ambiguos", () => {
    expect(parseStorefrontEnv({ WHATSAPP_NUMBER: "51900000000" }).WHATSAPP_NUMBER).toBe("51900000000");
    expect(() => parseStorefrontEnv({ WHATSAPP_NUMBER: "+51 900 000 000" })).toThrow(/WHATSAPP_NUMBER/);
    expect(() => parseStorefrontEnv({ WHATSAPP_NUMBER: "1234" })).toThrow(/WHATSAPP_NUMBER/);
  });

  it("URL pública de imágenes sin barra final; null si falta", () => {
    expect(parseStorageBaseUrl({ SUPABASE_URL: "http://127.0.0.1:54321/" })).toBe("http://127.0.0.1:54321");
    expect(parseStorageBaseUrl({})).toBeNull();
  });
});
