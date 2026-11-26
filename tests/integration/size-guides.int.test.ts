import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import type { AdminActor } from "@/modules/identity/contracts";
import { getSizeGuideDeps } from "@/modules/catalog/server";
import { saveSizeGuide, type SaveGuideInput } from "@/modules/catalog/application/size-guides";
import { listGuides, readGuide } from "@/modules/catalog/infrastructure/size-guide-store";
import { openTestDb } from "../support/test-db";

const { db, sql } = openTestDb();
const actor: AdminActor = { membershipId: randomUUID(), authSubject: randomUUID(), role: "operator", displayName: "QA", email: "qa@blesh.test" };
const deps = getSizeGuideDeps(db);
const ids: string[] = [];
const base = (): SaveGuideInput => ({ name: `QA guide ${randomUUID()}`, operationKey: randomUUID(), rows: [{ sizeCode: "M", lengthCm: "70,5", widthCm: "62" }] });
async function create(input = base()) {
  const result = await saveSizeGuide(deps, actor, input);
  if (!result.ok) throw new Error(result.message);
  ids.push(result.value.id);
  return { guide: result.value, input };
}

afterAll(async () => {
  const admin = postgres(process.env.TEST_MIGRATION_DATABASE_URL!, { max: 1 });
  try {
    for (const id of ids) {
      await admin`delete from app.products where size_guide_id=${id}`;
      await admin`delete from app.size_guides where id=${id}`;
    }
  } finally { await admin.end(); await sql.end(); }
});

describe("guías administrables", () => {
  it("normaliza medidas, lista guías y reconoce la creación incluso después de editar", async () => {
    const { guide, input } = await create();
    expect(guide.rows).toEqual([{ sizeCode: "M", lengthCm: "70.5", widthCm: "62.0" }]);
    expect((await listGuides(db)).find((g) => g.id === guide.id)).toMatchObject({ productCount: 0, version: 1 });
    const edited = await saveSizeGuide(deps, actor, { ...input, id: guide.id, expectedVersion: 1, name: `${input.name} edit`, operationKey: randomUUID() });
    expect(edited.ok && edited.value.version).toBe(2);
    const replay = await saveSizeGuide(deps, actor, input);
    expect(replay.ok && replay.value.id).toBe(guide.id);
    expect(replay.ok && replay.value.version).toBe(2);
    const [audit] = await sql<{ n: number }[]>`select count(*)::int n from app.audit_events where resource_id=${guide.id} and action='catalog.size_guide.created'`;
    expect(audit.n).toBe(1);
    expect(await saveSizeGuide(deps, actor, { ...input, name: "Different payload" })).toMatchObject({ ok: false, code: "VERSION_CONFLICT" });
  });

  it("rechaza nombres duplicados y permisos insuficientes sin escrituras", async () => {
    const { input } = await create();
    expect(await saveSizeGuide(deps, actor, { ...input, name: input.name.toUpperCase(), operationKey: randomUUID() })).toMatchObject({ ok: false, code: "VALIDATION_ERROR", field: "name" });
    expect(await saveSizeGuide({ ...deps, authorize: () => false }, actor, base())).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("serializa ediciones, actualiza productos compartidos y no duplica reintentos", async () => {
    const { guide, input } = await create();
    const [product] = await sql<{ id: string }[]>`insert into app.products (slug,title,size_guide_id,created_by,updated_by) values (${`qa-guide-${randomUUID()}`},'QA guía compartida',${guide.id},${actor.membershipId},${actor.membershipId}) returning id`;
    const edit = { ...input, id: guide.id, expectedVersion: 1, operationKey: randomUUID(), rows: [{ sizeCode: "L", lengthCm: "72", widthCm: "64" }] };
    const otherEdit = { ...edit, operationKey: randomUUID() };
    const results = await Promise.all([saveSizeGuide(deps, actor, edit), saveSizeGuide(deps, actor, otherEdit)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "VERSION_CONFLICT" });
    const winner = results[0].ok ? edit : otherEdit;
    expect(await saveSizeGuide(deps, actor, winner)).toMatchObject({ ok: true });
    const [updated] = await sql<{ version: number }[]>`select version from app.products where id=${product.id}`;
    expect(updated.version).toBe(2);
    const read = await readGuide(db, guide.id);
    expect(read).toMatchObject({ version: 2, rows: [{ sizeCode: "L", lengthCm: "72.0", widthCm: "64.0" }], products: [{ id: product.id }] });
  });
});
