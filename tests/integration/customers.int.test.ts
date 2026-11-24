/**
 * Clientes sobre PostgreSQL real (base blesh_test, rol runtime).
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import * as management from "@/modules/customers/application/customer-management";
import { createCustomerStore, customerTx, listCustomers } from "@/modules/customers/infrastructure/customer-store";
import { roleCan } from "@/modules/identity/domain/permissions";

import { openTestDb, resetTables } from "../support/test-db";

const { sql, db } = openTestDb();
const owner = { membershipId: randomUUID(), role: "owner" as const };
const operator = { membershipId: randomUUID(), role: "operator" as const };
const deps: management.CustomerDeps = { store: createCustomerStore(db), authorize: (actor, cap) => roleCan(actor.role, cap) };

beforeEach(async () => {
  await resetTables(["customers", "audit_events"]);
});

afterAll(async () => {
  await sql.end();
});

function unwrap<T>(result: management.CustomerResult<T>): T {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value;
}

const create = (name: string, phone: string, extra: Partial<management.CreateCustomerInput> = {}, actor = operator) =>
  management.createCustomer(deps, actor, { name, phone, email: null, creationKey: randomUUID(), confirmSharedPhone: false, ...extra });

describe("teléfono compartido", () => {
  it("no fusiona: pide confirmación y luego permite dos fichas con el mismo número", async () => {
    const ana = unwrap(await create("Ana Pérez", "987 654 321"));
    const second = await create("Luis Pérez", "+51987654321");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("PHONE_MATCH");
      expect(second.matches).toEqual([{ id: ana.id, name: "Ana Pérez", status: "active" }]);
    }
    const luis = unwrap(await create("Luis Pérez", "987654321", { confirmSharedPhone: true }));
    expect(luis.id).not.toBe(ana.id);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.customers where phone_normalized = '+51987654321'`;
    expect(n).toBe(2);
  });

  it("cambiar el teléfono a uno usado por otra ficha también exige confirmación", async () => {
    unwrap(await create("Ana", "987654321"));
    const luis = unwrap(await create("Luis", "912345678"));
    const attempt = await management.updateCustomer(deps, operator, { id: luis.id, expectedVersion: luis.version, name: "Luis", phone: "987654321", confirmSharedPhone: false });
    expect(attempt.ok ? null : attempt.code).toBe("PHONE_MATCH");
    const updated = unwrap(await management.updateCustomer(deps, operator, { id: luis.id, expectedVersion: luis.version, name: "Luis", phone: "987654321", confirmSharedPhone: true }));
    expect(updated.phone).toBe("+51987654321");
  });
});

describe("idempotencia y concurrencia", () => {
  it("10 envíos simultáneos del mismo formulario crean una sola ficha", async () => {
    const creationKey = randomUUID();
    const results = await Promise.all(Array.from({ length: 10 }, () => create("Rosa Díaz", "955111222", { creationKey })));
    const ids = new Set(results.map((r) => unwrap(r).id));
    expect(ids.size).toBe(1);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.customers`;
    expect(n).toBe(1);
  });

  it("la misma clave con otros datos es un conflicto", async () => {
    const creationKey = randomUUID();
    unwrap(await create("Rosa Díaz", "955111222", { creationKey }));
    const other = await create("Otra Persona", "955333444", { creationKey });
    expect(other.ok ? null : other.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("dos ediciones con la misma versión: una gana y la otra recibe conflicto", async () => {
    const c = unwrap(await create("Carla Ruiz", "966777888"));
    const results = await Promise.all([
      management.updateCustomer(deps, operator, { id: c.id, expectedVersion: c.version, name: "Carla Ruiz A", phone: "966777888", confirmSharedPhone: false }),
      management.updateCustomer(deps, owner, { id: c.id, expectedVersion: c.version, name: "Carla Ruiz B", phone: "966777888", confirmSharedPhone: false }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "VERSION_CONFLICT" });
    const [row] = await sql<{ version: number }[]>`select version from app.customers where id = ${c.id}`;
    expect(row.version).toBe(2);
  });
});

describe("permisos, archivado y auditoría", () => {
  it("operator crea y edita, pero no archiva ni reactiva", async () => {
    const c = unwrap(await create("Mario Soto", "977000111"));
    const archive = await management.archiveCustomer(deps, operator, { id: c.id, expectedVersion: c.version, reason: "Duplicada" });
    expect(archive.ok ? null : archive.code).toBe("FORBIDDEN");
  });

  it("owner archiva con motivo; la ficha archivada no se edita ni se puede vincular hasta reactivarla", async () => {
    const c = unwrap(await create("Mario Soto", "977000111"));
    expect((await management.archiveCustomer(deps, owner, { id: c.id, expectedVersion: c.version, reason: "" })).ok).toBe(false);
    const archived = unwrap(await management.archiveCustomer(deps, owner, { id: c.id, expectedVersion: c.version, reason: "Ficha duplicada" }));
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).not.toBeNull();

    const edit = await management.updateCustomer(deps, operator, { id: c.id, expectedVersion: archived.version, name: "Otro", phone: "977000111", confirmSharedPhone: false });
    expect(edit.ok ? null : edit.code).toBe("INVALID_STATE");

    const link = db.transaction((tx) => management.requireLinkableCustomerInTx(customerTx(tx as never), deps.authorize, operator, c.id));
    await expect(link).rejects.toMatchObject({ code: "INVALID_STATE" });

    const active = unwrap(await management.reactivateCustomer(deps, owner, { id: c.id, expectedVersion: archived.version }));
    const linked = await db.transaction((tx) => management.requireLinkableCustomerInTx(customerTx(tx as never), deps.authorize, operator, active.id));
    expect(linked).toEqual({ id: c.id, name: "Mario Soto", phone: "+51977000111", email: null });
  });

  it("el runtime no puede borrar fichas", async () => {
    const c = unwrap(await create("Mario Soto", "977000111"));
    await expect(sql`delete from app.customers where id = ${c.id}`).rejects.toThrow(/permission denied/);
  });

  it("la auditoría registra acciones y campos, sin teléfono ni correo", async () => {
    const c = unwrap(await create("Mario Soto", "977000111", { email: "mario@correo.pe" }));
    unwrap(await management.updateCustomer(deps, operator, { id: c.id, expectedVersion: c.version, name: "Mario Soto", phone: "977000222", email: "mario@correo.pe", confirmSharedPhone: false }));
    const events = await sql<{ action: string; changes: unknown; reason: string | null }[]>`
      select action, changes, reason from app.audit_events where resource_id = ${c.id} order by occurred_at`;
    expect(events.map((e) => e.action)).toEqual(["customer.created", "customer.updated"]);
    expect(events[1].changes).toEqual({ fields: ["phone"] });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("977000");
    expect(serialized).not.toContain("mario@");
  });
});

describe("directorio", () => {
  it("busca por nombre, parte del teléfono o correo, filtra estado y pagina", async () => {
    unwrap(await create("Ana Pérez", "987654321", { email: "ana@correo.pe" }));
    unwrap(await create("Luis Quispe", "912345678"));
    const archived = unwrap(await create("Zoe 100%_raro", "933444555"));
    unwrap(await management.archiveCustomer(deps, owner, { id: archived.id, expectedVersion: archived.version, reason: "Prueba" }));

    const page = (search: string, status?: "active" | "archived") => listCustomers(db, { search, status, page: 1, pageSize: 20 });
    expect((await page("pérez")).rows.map((r) => r.name)).toEqual(["Ana Pérez"]);
    expect((await page("654 321")).rows.map((r) => r.name)).toEqual(["Ana Pérez"]);
    expect((await page("ANA@correo")).rows.map((r) => r.name)).toEqual(["Ana Pérez"]);
    expect((await page("%")).total).toBe(1); // comodín escapado: solo coincide el nombre con «%»
    expect((await page("", "active")).total).toBe(2);
    expect((await page("", "archived")).rows.map((r) => r.name)).toEqual(["Zoe 100%_raro"]);

    const paged = await listCustomers(db, { search: "", page: 2, pageSize: 2 });
    expect(paged.total).toBe(3);
    expect(paged.rows).toHaveLength(1);
  });
});
