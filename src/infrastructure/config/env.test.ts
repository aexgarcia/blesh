import { describe, expect, it } from "vitest";

import { parseMigrationEnv, parseServerEnv } from "./env";

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
