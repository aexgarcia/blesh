import { createHash } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import type { CategoryStore } from "../application/categories";
import { CatalogFailure } from "../application/errors";
import type { AdminCategory } from "../contracts";
import { categories, products } from "./schema";

export async function listCategories(db: AnyDatabase): Promise<AdminCategory[]> {
  const [rows, assigned] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.position), asc(categories.slug), asc(categories.id)),
    db.select({ categoryId: products.categoryId, status: products.status }).from(products),
  ]);
  return rows.map(({ id, slug, name, description, position, active, version }) => ({ id, slug, name, description, position, active, version, productCount: assigned.filter((p) => p.categoryId === id).length, publishedCount: assigned.filter((p) => p.categoryId === id && p.status === "published").length }));
}
export async function readCategory(db: AnyDatabase, id: string) {
  return (await listCategories(db)).find((c) => c.id === id) ?? null;
}

export function categoryStore(db: AnyDatabase): CategoryStore {
  return { save: (input) => db.transaction(async (raw) => {
    const tx = raw as unknown as AnyDatabase;
    // Serializar todas las operaciones evita carreras entre slug y clave de creación.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('catalog-categories',0))`);
    const data = { name: input.name, slug: input.slug, description: input.description, position: input.position, active: input.active };
    const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    if (!input.id) {
      const [created] = await tx.select().from(categories).where(eq(categories.creationKey, input.operationKey));
      if (created) {
        if (created.creationFingerprint !== fingerprint) throw new CatalogFailure("VERSION_CONFLICT", "Este formulario ya creó una categoría con otros datos. Recarga.");
        return (await readCategory(tx, created.id))!;
      }
    }
    const [replay] = await tx.select().from(categories).where(eq(categories.lastOperationKey, input.operationKey));
    if (replay) {
      if (replay.id !== input.id || replay.lastFingerprint !== fingerprint) throw new CatalogFailure("VERSION_CONFLICT", "Este guardado ya se utilizó. Recarga la categoría.");
      return (await readCategory(tx, replay.id))!;
    }
    const [duplicate] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.slug));
    if (duplicate && duplicate.id !== input.id) throw new CatalogFailure("DUPLICATE_SLUG", "Ya existe una categoría con esta URL.", "slug");
    let id = input.id;
    if (id) {
      const [previous] = await tx.select().from(categories).where(eq(categories.id, id)).for("update");
      if (!previous) throw new CatalogFailure("NOT_FOUND", "La categoría ya no existe.");
      if (previous.version !== input.expectedVersion) throw new CatalogFailure("VERSION_CONFLICT", "Otra persona modificó esta categoría. Recarga antes de guardar.");
      if (previous.slug !== input.slug) throw new CatalogFailure("SLUG_LOCKED", "La URL de la categoría es fija para conservar sus enlaces.", "slug");
      await tx.update(categories).set({ ...data, version: previous.version + 1, lastOperationKey: input.operationKey, lastFingerprint: fingerprint }).where(eq(categories.id, id));
      await tx.update(products).set({ version: sql`${products.version}+1`, updatedAt: sql`now()`, updatedBy: input.actorId }).where(eq(products.categoryId, id));
    } else {
      const [created] = await tx.insert(categories).values({ ...data, version: 1, creationKey: input.operationKey, creationFingerprint: fingerprint, lastOperationKey: input.operationKey, lastFingerprint: fingerprint }).returning({ id: categories.id });
      id = created.id;
    }
    await tx.insert(auditEvents).values({ actorType: "admin", actorId: input.actorId, action: input.id ? "catalog.category.updated" : "catalog.category.created", resourceType: "category", resourceId: id, changes: data });
    return (await readCategory(tx, id!))!;
  }) };
}
