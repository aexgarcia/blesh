import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listPublicSitemapEntries } from "@/modules/catalog/infrastructure/catalog-queries";

import { openTestDb, resetTables } from "../support/test-db";

const { sql, db } = openTestDb();
beforeEach(async () => { await resetTables(["products"]); });
afterAll(async () => { await sql.end(); });

describe("URLs públicas del sitemap", () => {
  it("no trunca a 100 y omite borradores, colores inactivos y colores sin talla activa", async () => {
    const actor = randomUUID();
    const [category] = await sql<{ id: string }[]>`select id from app.categories order by slug limit 1`;
    const [product] = await sql<{ id: string }[]>`insert into app.products (slug,title,category_id,status,published_at,created_by,updated_by) values ('sitemap-test','Sitemap',${category.id},'published',now(),${actor},${actor}) returning id`;
    for (let n = 0; n < 105; n++) {
      const [color] = await sql<{ id: string }[]>`insert into app.product_colors (product_id,color_code,label,slug,active) values (${product.id},${`c-${n}`},${`Color ${n}`},${`color-${n}`},${n !== 103}) returning id`;
      await sql`insert into app.product_variants (product_id,color_id,sku,size_code,price_minor,active) values (${product.id},${color.id},${`SITEMAP-${n}`},'S',4000,${n !== 104})`;
    }
    const entries = await listPublicSitemapEntries(db);
    expect(entries).toHaveLength(103);
    expect(entries.some((e) => e.href.endsWith("/color-102"))).toBe(true);
    expect(entries.some((e) => /color-10[34]$/.test(e.href))).toBe(false);
    expect(entries.every((e) => !Number.isNaN(Date.parse(e.updatedAt)))).toBe(true);
    await sql`update app.products set status='draft' where id=${product.id}`;
    expect(await listPublicSitemapEntries(db)).toEqual([]);
  });
});
