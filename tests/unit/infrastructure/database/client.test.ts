import { afterAll, describe, expect, it, vi } from "vitest";
import { pgSchema, text, uuid } from "drizzle-orm/pg-core";
import type postgres from "postgres";

vi.mock("@/infrastructure/config/server", () => ({
  getServerEnv: () => ({ DATABASE_URL: "postgres://qa:qa@127.0.0.1:1/qa", DATABASE_POOL_MAX: 1, DATABASE_PREPARE: true }),
}));

import { getDb } from "@/infrastructure/database/client";
import { sizeGuides } from "@/modules/catalog/infrastructure/schema";

afterAll(async () => {
  const state = globalThis as unknown as { __bleshDb?: { sql: postgres.Sql } };
  await state.__bleshDb?.sql.end();
  delete state.__bleshDb;
});

describe("cliente de base de datos durante recarga de esquema", () => {
  it("reutiliza el pool sin conservar el mapa de columnas de una tabla anterior", () => {
    const previous = pgSchema("app").table("size_guides", { id: uuid(), name: text() });
    getDb().select().from(previous).toSQL();
    // Simula añadir columnas al mismo esquema mientras el proceso sigue activo.
    const query = getDb().select().from(sizeGuides).toSQL();
    expect(query.sql).toContain('"creation_key"');
    expect(query.sql).toContain('"last_operation_key"');
    expect(query.sql).not.toContain("undefined");
  });
});
