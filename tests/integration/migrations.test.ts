/**
 * Aplica las migraciones versionadas sobre PostgreSQL embebido (PGlite) y verifica
 * constraints y permisos del rol runtime. No sustituye las pruebas de concurrencia
 * con PostgreSQL real de fases posteriores.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsFolder = path.resolve(__dirname, "../../db/migrations");

describe("migraciones", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });
  });

  afterAll(async () => {
    await client.close();
  });

  it("crea las tablas en el esquema privado app", async () => {
    const { rows } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'app' order by table_name",
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "admin_memberships",
      "audit_events",
      "categories",
      "customers",
      "idempotency_records",
      "inventory_balances",
      "media_assets",
      "product_colors",
      "product_images",
      "product_variants",
      "products",
      "size_guide_rows",
      "size_guides",
      "stock_movements",
    ]);
  });

  it("son idempotentes al volver a ejecutarse", async () => {
    await migrate(drizzle(client), { migrationsFolder, migrationsSchema: "drizzle" });
    const { rows } = await client.query<{ count: number }>(
      "select count(*)::int as count from drizzle.__drizzle_migrations",
    );
    const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")) as { entries: unknown[] };
    expect(rows[0].count).toBe(journal.entries.length);
  });

  it("aplica constraints de auditoría e idempotencia", async () => {
    await expect(
      client.query("insert into app.audit_events (actor_type, action, resource_type) values ('customer', 'x', 'y')"),
    ).rejects.toThrow(/audit_events_actor_type_check/);

    await expect(
      client.query(
        "insert into app.idempotency_records (scope, key, request_hash, status, expires_at) values ('s', 'k-short', 'h', 'in_progress', now())",
      ),
    ).rejects.toThrow(/idempotency_records_key_length_check/);

    await expect(
      client.query(
        "insert into app.idempotency_records (scope, key, request_hash, status, expires_at) values ('s', 'key-12345', 'h', 'completed', now())",
      ),
    ).rejects.toThrow(/idempotency_records_completion_check/);
  });

  it("el rol runtime inserta auditoría pero no puede reescribirla", async () => {
    await client.exec("set role blesh_runtime");
    try {
      await client.query(
        "insert into app.audit_events (actor_type, action, resource_type) values ('system', 'test', 'migration')",
      );
      await expect(client.query("update app.audit_events set action = 'changed'")).rejects.toThrow(
        /permission denied/,
      );
      await expect(client.query("delete from app.audit_events")).rejects.toThrow(/permission denied/);
      await expect(client.query("create table app.intruder (id int)")).rejects.toThrow(/permission denied/);
    } finally {
      await client.exec("reset role");
    }
  });
});
