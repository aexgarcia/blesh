import { createHash } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";

import { auditEvents } from "../../../infrastructure/database/schema/audit";
import type { AnyDatabase } from "../../../infrastructure/database/types";
import { CatalogFailure } from "../application/errors";
import type { GuideStore } from "../application/size-guides";
import type { AdminSizeGuide, SizeGuideListItem } from "../contracts";
import { products, sizeGuideRows, sizeGuides } from "./schema";

export async function readGuide(db: AnyDatabase, id: string): Promise<AdminSizeGuide | null> {
  const [guide] = await db.select().from(sizeGuides).where(eq(sizeGuides.id, id));
  if (!guide) return null;
  const [rows, assigned] = await Promise.all([
    db.select({ sizeCode: sizeGuideRows.sizeCode, lengthCm: sizeGuideRows.lengthCm, widthCm: sizeGuideRows.widthCm }).from(sizeGuideRows).where(eq(sizeGuideRows.guideId, id)).orderBy(asc(sizeGuideRows.position)),
    db.select({ id: products.id, title: products.title, status: products.status }).from(products).where(eq(products.sizeGuideId, id)).orderBy(asc(products.title)),
  ]);
  return { id: guide.id, code: guide.code, name: guide.name, version: guide.version, rows, products: assigned };
}

export async function listGuides(db: AnyDatabase): Promise<SizeGuideListItem[]> {
  const [guides, rows, assigned] = await Promise.all([db.select().from(sizeGuides).orderBy(asc(sizeGuides.name)), db.select().from(sizeGuideRows).orderBy(asc(sizeGuideRows.position)), db.select({ guideId: products.sizeGuideId }).from(products)]);
  return guides.map((g) => ({ id: g.id, name: g.name, version: g.version, productCount: assigned.filter((p) => p.guideId === g.id).length, rows: rows.filter((r) => r.guideId === g.id).map((r) => ({ sizeCode: r.sizeCode, lengthCm: r.lengthCm, widthCm: r.widthCm })) }));
}

export function guideStore(db: AnyDatabase): GuideStore {
  return { save: (input) => db.transaction(async (raw) => {
    const tx = raw as unknown as AnyDatabase;
    // Una misma clave de creación se serializa y reconoce antes de insertar.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`size-guide:${input.id ?? input.operationKey}`},0))`);
    const fingerprint = createHash("sha256").update(JSON.stringify({ name: input.name, rows: input.rows })).digest("hex");
    if (!input.id) {
      const [created] = await tx.select().from(sizeGuides).where(eq(sizeGuides.creationKey, input.operationKey));
      if (created) {
        if (created.creationFingerprint !== fingerprint) throw new CatalogFailure("VERSION_CONFLICT", "Este formulario ya creó una guía con otros datos. Recarga la página.");
        return (await readGuide(tx, created.id))!;
      }
    }
    const [replayed] = await tx.select().from(sizeGuides).where(eq(sizeGuides.lastOperationKey, input.operationKey));
    if (replayed) {
      if (replayed.lastFingerprint !== fingerprint || (input.id && replayed.id !== input.id)) throw new CatalogFailure("VERSION_CONFLICT", "Este guardado ya se utilizó con otros datos. Recarga la página.");
      return (await readGuide(tx, replayed.id))!;
    }
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`size-guide-name:${input.name.toLocaleLowerCase("es-PE")}`},0))`);
    const duplicate = await tx.select({ id: sizeGuides.id }).from(sizeGuides).where(sql`lower(${sizeGuides.name}) = lower(${input.name})`);
    if (duplicate.some((g) => g.id !== input.id)) throw new CatalogFailure("VALIDATION_ERROR", "Ya existe una guía con ese nombre. Usa la existente o elige otro nombre.", "name");
    let id = input.id;
    if (id) {
      const [previous] = await tx.select().from(sizeGuides).where(eq(sizeGuides.id, id)).for("update");
      if (!previous) throw new CatalogFailure("NOT_FOUND", "La guía ya no existe.");
      if (previous.version !== input.expectedVersion) throw new CatalogFailure("VERSION_CONFLICT", "Otra persona modificó esta guía. Recarga antes de guardar.");
      await tx.update(sizeGuides).set({ name: input.name, version: previous.version + 1, lastOperationKey: input.operationKey, lastFingerprint: fingerprint }).where(eq(sizeGuides.id, id));
      await tx.delete(sizeGuideRows).where(eq(sizeGuideRows.guideId, id));
      // Las fichas públicas cambian con la guía: actualiza versión/lastmod de productos asignados.
      await tx.update(products).set({ version: sql`${products.version} + 1`, updatedAt: sql`now()`, updatedBy: input.actorId }).where(eq(products.sizeGuideId, id));
    } else {
      const [created] = await tx.insert(sizeGuides).values({ name: input.name, code: `${input.code.slice(0, 60)}-${input.operationKey.slice(0, 8)}`, lastOperationKey: input.operationKey, lastFingerprint: fingerprint, creationKey: input.operationKey, creationFingerprint: fingerprint }).returning({ id: sizeGuides.id });
      id = created.id;
    }
    await tx.insert(sizeGuideRows).values(input.rows.map((row, position) => ({ ...row, guideId: id!, position })));
    await tx.insert(auditEvents).values({ actorType: "admin", actorId: input.actorId, action: input.id ? "catalog.size_guide.updated" : "catalog.size_guide.created", resourceType: "size_guide", resourceId: id, changes: { fields: ["name", "rows"], sizeCodes: input.rows.map((r) => r.sizeCode) } });
    return (await readGuide(tx, id!))!;
  }) };
}
