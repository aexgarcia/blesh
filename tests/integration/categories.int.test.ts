import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { saveCategory, type SaveCategoryInput } from "@/modules/catalog/application/categories";
import { getCategoryDeps } from "@/modules/catalog/server";
import { listCategories } from "@/modules/catalog/infrastructure/category-store";
import { getPublicCategory, getPublicProductColor, listPublicCategories } from "@/modules/catalog/infrastructure/catalog-queries";
import { openTestDb } from "../support/test-db";

const { db, sql } = openTestDb();
const actor = { membershipId: randomUUID(), role: "operator" as const };
const deps = getCategoryDeps(db);
const ids: string[] = [];
const base = (): SaveCategoryInput => ({ name: `QA categoría ${randomUUID()}`, slug: `qa-category-${randomUUID()}`, description: "QA", position: 2, active: true, operationKey: randomUUID() });
async function create() {
  const input = base(); const result = await saveCategory(deps, actor, input);
  if (!result.ok) throw Error(result.message);
  ids.push(result.value.id); return { input, category: result.value };
}
afterAll(async () => {
  const admin = postgres(process.env.TEST_MIGRATION_DATABASE_URL!, { max: 1 });
  try { for (const id of ids) {
    await admin`delete from app.product_variants where product_id in (select id from app.products where category_id=${id})`;
    await admin`delete from app.product_colors where product_id in (select id from app.products where category_id=${id})`;
    await admin`delete from app.products where category_id=${id}`;
    await admin`delete from app.categories where id=${id}`;
  } }
  finally { await admin.end(); await sql.end(); }
});

describe("categorías administrables", () => {
  it("crea, edita y reconoce la creación original sin duplicar auditoría", async () => {
    const { input, category } = await create();
    expect(await saveCategory(deps, actor, { ...input, operationKey: randomUUID() })).toMatchObject({ ok: false, code: "DUPLICATE_SLUG" });
    const edit = { ...input, id: category.id, expectedVersion: 1, name: "QA nuevo nombre", operationKey: randomUUID() };
    expect(await saveCategory(deps, actor, edit)).toMatchObject({ ok: true, value: { version: 2 } });
    expect(await saveCategory(deps, actor, edit)).toMatchObject({ ok: true, value: { version: 2 } });
    expect(await saveCategory(deps, actor, input)).toMatchObject({ ok: true, value: { id: category.id, version: 2 } });
    expect(await saveCategory(deps, actor, { ...edit, expectedVersion: 2, slug: "otra-url", operationKey: randomUUID() })).toMatchObject({ ok: false, code: "SLUG_LOCKED" });
    const [audits] = await sql<{ n: number }[]>`select count(*)::int n from app.audit_events where resource_id=${category.id} and action='catalog.category.created'`;
    expect(audits.n).toBe(1);
  });
  it("controla versiones concurrentes y permisos", async () => {
    const { input, category } = await create();
    const edit = { ...input, id: category.id, expectedVersion: 1 };
    const results = await Promise.all([1, 2].map((position) => saveCategory(deps, actor, { ...edit, position, operationKey: randomUUID() })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "VERSION_CONFLICT" });
    expect(await saveCategory({ ...deps, authorize: () => false }, actor, base())).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
  it("desactivar oculta la categoría sin retirar la prenda; no deja breadcrumb roto", async () => {
    const { input, category } = await create();
    const slug = `qa-product-${randomUUID()}`;
    const [p] = await sql<{id: string}[]>`insert into app.products (slug,title,category_id,status,published_at,created_by,updated_by) values (${slug},'QA',${category.id},'published',now(),${actor.membershipId},${actor.membershipId}) returning id`;
    const [c] = await sql<{id: string}[]>`insert into app.product_colors (product_id,color_code,label,slug,is_primary) values (${p.id},'negro','Negro','negro',true) returning id`;
    await sql`insert into app.product_variants (product_id,color_id,sku,size_code,price_minor) values (${p.id},${c.id},${`QA-${randomUUID().slice(0,8).toUpperCase()}`},'M',4000)`;
    expect((await listPublicCategories(db)).some((c) => c.slug === input.slug)).toBe(true);
    expect((await listCategories(db)).find((c) => c.id === category.id)).toMatchObject({ productCount: 1, publishedCount: 1 });
    expect(await saveCategory(deps, actor, { ...input, id: category.id, expectedVersion: 1, active: false, operationKey: randomUUID() })).toMatchObject({ ok: true });
    expect(await getPublicCategory(db, input.slug)).toBeNull();
    expect((await listPublicCategories(db)).some((c) => c.slug === input.slug)).toBe(false);
    expect(await getPublicProductColor(db, slug, "negro")).toMatchObject({ slug, category: null });
    const [product] = await sql<{version:number;status:string}[]>`select version,status from app.products where id=${p.id}`;
    expect(product).toEqual({ version: 2, status: "published" });
  });
});
