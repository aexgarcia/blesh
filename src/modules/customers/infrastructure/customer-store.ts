import { and, asc, count, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { CustomerRow, CustomerStore, CustomerTx } from "../application/customer-management";
import type { CustomerMatch, CustomerPage, CustomerStatus } from "../contracts";
import { parseSearch } from "../domain/customer";
import { customers } from "./schema";

type Row = typeof customers.$inferSelect;

const toRow = (r: Row): CustomerRow => ({
  id: r.id,
  name: r.name,
  phoneNormalized: r.phoneNormalized,
  email: r.email,
  status: r.status as CustomerStatus,
  version: r.version,
  creationKey: r.creationKey,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  archivedAt: r.archivedAt,
});

const MATCH_LIMIT = 10;

async function phoneMatches(db: AnyDatabase, phoneNormalized: string, excludeId?: string): Promise<CustomerMatch[]> {
  const rows = await db
    .select({ id: customers.id, name: customers.name, status: customers.status })
    .from(customers)
    .where(and(eq(customers.phoneNormalized, phoneNormalized), excludeId ? ne(customers.id, excludeId) : undefined))
    .orderBy(asc(customers.createdAt))
    .limit(MATCH_LIMIT);
  return rows.map((r) => ({ ...r, status: r.status as CustomerStatus }));
}

/** Escapa comodines de LIKE en texto del usuario. */
const likeEscape = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export function customerTx(db: AnyDatabase): CustomerTx {
  return {
    async lock(id) {
      const [row] = await db.select().from(customers).where(eq(customers.id, id)).for("update");
      return row ? toRow(row) : null;
    },
    async lockCreationKey(creationKey) {
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`customer-create:${creationKey}`}, 0))`);
    },
    async findByCreationKey(creationKey) {
      const [row] = await db.select().from(customers).where(eq(customers.creationKey, creationKey));
      return row ? toRow(row) : null;
    },
    async insert(input) {
      const [row] = await db
        .insert(customers)
        .values({ name: input.name, phoneNormalized: input.phoneNormalized, email: input.email, creationKey: input.creationKey, createdBy: input.actorId, updatedBy: input.actorId })
        .returning();
      return toRow(row);
    },
    async update(id, patch, actorId, expectedVersion) {
      const [row] = await db
        .update(customers)
        .set({ ...patch, updatedBy: actorId, version: sql`${customers.version} + 1`, updatedAt: sql`now()` })
        .where(and(eq(customers.id, id), eq(customers.version, expectedVersion)))
        .returning();
      return row ? toRow(row) : null;
    },
    phoneMatches: (phone, excludeId) => phoneMatches(db, phone, excludeId),
    async audit(entry) {
      await db.insert(auditEvents).values({
        actorType: "admin",
        actorId: entry.actorId,
        action: entry.action,
        resourceType: "customer",
        resourceId: entry.customerId,
        changes: entry.changes ?? null,
        reason: entry.reason ?? null,
      });
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause ?? (error as { code?: string });
  return cause?.code === "23505";
}

export function createCustomerStore(db: AnyDatabase): CustomerStore {
  return {
    async transaction(fn) {
      try {
        return await db.transaction((tx) => fn(customerTx(tx as unknown as AnyDatabase)));
      } catch (error) {
        // Doble envío simultáneo con la misma clave de alta: la otra transacción ganó; el reintento la devuelve.
        if (isUniqueViolation(error)) return db.transaction((tx) => fn(customerTx(tx as unknown as AnyDatabase)));
        throw error;
      }
    },
  };
}

export type CustomerListFilter = { search: string; status?: CustomerStatus; page: number; pageSize: number };

/** Directorio paginado para personal autenticado. Sin caché compartida. */
export async function listCustomers(db: AnyDatabase, filter: CustomerListFilter): Promise<CustomerPage> {
  const search = parseSearch(filter.search);
  const conditions: (SQL | undefined)[] = [filter.status ? eq(customers.status, filter.status) : undefined];
  if (search.kind === "phone") {
    conditions.push(sql`${customers.phoneNormalized} like ${`%${search.digits}%`}`);
  } else if (search.kind === "text") {
    const pattern = `%${likeEscape(search.text)}%`;
    conditions.push(or(ilike(customers.name, pattern), ilike(customers.email, pattern)));
  }
  const where = and(...conditions);
  const offset = (filter.page - 1) * filter.pageSize;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.updatedAt), desc(customers.id))
      .limit(filter.pageSize)
      .offset(offset),
    db.select({ total: count() }).from(customers).where(where),
  ]);
  return {
    rows: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phoneNormalized, email: r.email, status: r.status as CustomerStatus, updatedAt: r.updatedAt.toISOString() })),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

export async function getCustomerRow(db: AnyDatabase, id: string): Promise<CustomerRow | null> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  return row ? toRow(row) : null;
}

export { phoneMatches as findPhoneMatches };
