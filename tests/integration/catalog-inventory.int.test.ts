/**
 * Catálogo + inventario sobre PostgreSQL real (base blesh_test, rol runtime).
 */
import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import * as editing from "@/modules/catalog/application/product-editing";
import type { CatalogDeps } from "@/modules/catalog/application/ports";
import { createCatalogStore } from "@/modules/catalog/infrastructure/catalog-store";
import { listPublishedColorCards } from "@/modules/catalog/infrastructure/catalog-queries";
import { adjustStock, registerInitialStock, type InventoryDeps } from "@/modules/inventory/application/stock-adjustments";
import { createInventoryStore } from "@/modules/inventory/infrastructure/inventory-store";

import { openTestDb, resetTables } from "../support/test-db";

const { sql, db } = openTestDb();
const admin = postgres(process.env.TEST_MIGRATION_DATABASE_URL!, { max: 1, onnotice: () => undefined });
const owner = { membershipId: randomUUID(), role: "owner" as const };
const operator = { membershipId: randomUUID(), role: "operator" as const };

const catalog: CatalogDeps = { store: createCatalogStore(db), authorize: () => true, clock: { now: () => new Date() } };
const inventory: InventoryDeps = { store: createInventoryStore(db), authorize: () => true };

let categoryId: string;

beforeEach(async () => {
  await resetTables(["stock_movements", "inventory_balances", "product_images", "product_variants", "product_colors", "products", "media_assets", "audit_events"]);
  categoryId = (await sql<{ id: string }[]>`select id from app.categories where slug = 'boxy-essential'`)[0].id;
});

afterAll(async () => {
  await sql.end();
  await admin.end();
});

function unwrap<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function draft(title = "Boxy Essential") {
  return unwrap(
    await editing.createProductDraft(catalog, owner, {
      title,
      shortDescription: "Polo boxy de algodón",
      description: "Algodón peinado 20/1, corte boxy.",
      categoryId,
      sizeGuideId: null,
      seoTitle: null,
      seoDescription: null,
    }),
  );
}

async function media() {
  const [row] = await sql<{ id: string }[]>`
    insert into app.media_assets (object_key, mime, bytes, width, height, created_by)
    values (${`products/${randomUUID()}.webp`}, 'image/webp', 1000, 800, 1000, ${owner.membershipId}) returning id`;
  return row.id;
}

/** Producto Boxy con Negro (S, M) y Blanco (S), portadas y stock registrado. */
async function boxyEssential() {
  const product = await draft();
  const negro = unwrap(await editing.addColor(catalog, owner, { productId: product.id, label: "Negro", swatchHex: "#111111", active: true }));
  const blanco = unwrap(await editing.addColor(catalog, owner, { productId: product.id, label: "Blanco", swatchHex: null, active: true }));
  const add = async (colorId: string, sizeCode: "S" | "M", sku: string) =>
    unwrap(await editing.addVariant(catalog, owner, { productId: product.id, colorId, sizeCode, sku, priceMinor: 4000, compareAtMinor: null, active: true }));
  const variants = [await add(negro.id, "S", "BOX-NEG-S"), await add(negro.id, "M", "BOX-NEG-M"), await add(blanco.id, "S", "BOX-BLA-S")];
  unwrap(await editing.attachImage(catalog, owner, { productId: product.id, mediaId: await media(), colorId: negro.id, alt: "Boxy negro frente" }));
  unwrap(await editing.attachImage(catalog, owner, { productId: product.id, mediaId: await media(), colorId: blanco.id, alt: "Boxy blanco frente" }));
  return { product, negro, blanco, variants };
}

const version = async (productId: string) => (await sql<{ version: number }[]>`select version from app.products where id = ${productId}`)[0].version;

describe("catálogo", () => {
  it("un producto agrupa colores; el primero activo es el principal", async () => {
    const { negro, blanco } = await boxyEssential();
    expect(negro.isPrimary).toBe(true);
    expect(blanco.isPrimary).toBe(false);
  });

  it("rechaza SKU duplicado entre productos y combinación color/talla repetida", async () => {
    const { product, negro } = await boxyEssential();
    const dupCombo = await editing.addVariant(catalog, owner, { productId: product.id, colorId: negro.id, sizeCode: "S", sku: "OTRO-SKU", priceMinor: 4000, compareAtMinor: null, active: true });
    expect(dupCombo).toMatchObject({ ok: false, code: "DUPLICATE_COMBINATION" });

    const other = await draft("Longsleeve Flamas");
    const color = unwrap(await editing.addColor(catalog, owner, { productId: other.id, label: "Negro", swatchHex: null, active: true }));
    const dupSku = await editing.addVariant(catalog, owner, { productId: other.id, colorId: color.id, sizeCode: "S", sku: "box-neg-s", priceMinor: 7000, compareAtMinor: null, active: true });
    expect(dupSku).toMatchObject({ ok: false, code: "DUPLICATE_SKU" });
  });

  it("la base impide variantes con color de otro producto (FK compuesta)", async () => {
    const { negro } = await boxyEssential();
    const other = await draft("Otro producto");
    await expect(
      sql`insert into app.product_variants (product_id, color_id, sku, size_code, price_minor) values (${other.id}, ${negro.id}, 'HACK-1', 'XL', 100)`,
    ).rejects.toThrow(/product_variants_color_fk/);
  });

  it("no publica sin stock inicial registrado; con stock 0 sí (agotado)", async () => {
    const { product, variants } = await boxyEssential();
    const blocked = await editing.publishProduct(catalog, owner, { productId: product.id, expectedVersion: await version(product.id), variantsWithStockRecord: new Set() });
    expect(blocked).toMatchObject({ ok: false, code: "NOT_PUBLISHABLE" });
    if (!blocked.ok) expect(blocked.issues?.some((i) => i.code.startsWith("stock:"))).toBe(true);

    for (const v of variants) unwrap(await registerInitialStock(inventory, owner, { variantId: v.id, quantity: 0, operationKey: randomUUID(), note: null }));
    const published = await editing.publishProduct(catalog, owner, {
      productId: product.id,
      expectedVersion: await version(product.id),
      variantsWithStockRecord: new Set(variants.map((v) => v.id)),
    });
    expect(published).toMatchObject({ ok: true, value: { status: "published" } });
  });

  it("publicado: tarjetas por color, URL fija y sin cambios que lo dejen incompleto", async () => {
    const { product, negro, blanco, variants } = await boxyEssential();
    const published = unwrap(
      await editing.publishProduct(catalog, owner, { productId: product.id, expectedVersion: await version(product.id), variantsWithStockRecord: new Set(variants.map((v) => v.id)) }),
    );

    const cards = await listPublishedColorCards(db, { limit: 48 });
    expect(cards.map((c) => c.href).sort()).toEqual(["/productos/boxy-essential/blanco", "/productos/boxy-essential/negro"]);
    expect(cards.find((c) => c.colorId === negro.id)?.variantIds).toHaveLength(2);

    const relabel = await editing.updateProductInfo(catalog, owner, {
      productId: product.id,
      expectedVersion: published.version,
      slug: "otra-url",
      title: "Boxy",
      shortDescription: "x",
      description: "y",
      categoryId,
      sizeGuideId: null,
      seoTitle: null,
      seoDescription: null,
    });
    expect(relabel).toMatchObject({ ok: false, code: "SLUG_LOCKED" });

    const [blancoCover] = await sql<{ id: string }[]>`select id from app.product_images where color_id = ${blanco.id}`;
    const removeCover = await editing.detachImage(catalog, owner, { productId: product.id, imageId: blancoCover.id });
    expect(removeCover).toMatchObject({ ok: false, code: "NOT_PUBLISHABLE" });
  });

  it("conflicto de versión al editar con datos desactualizados", async () => {
    const product = await draft();
    const input = { productId: product.id, expectedVersion: product.version, title: "A", shortDescription: "", description: "", categoryId, sizeGuideId: null, seoTitle: null, seoDescription: null };
    expect((await editing.updateProductInfo(catalog, owner, input)).ok).toBe(true);
    expect(await editing.updateProductInfo(catalog, owner, { ...input, title: "B" })).toMatchObject({ ok: false, code: "VERSION_CONFLICT" });
  });

  it("sin permiso no edita", async () => {
    const denied: CatalogDeps = { ...catalog, authorize: () => false };
    expect(await editing.createProductDraft(denied, operator, { title: "X", shortDescription: "", description: "", categoryId: null, sizeGuideId: null, seoTitle: null, seoDescription: null })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
  });
});

describe("inventario", () => {
  it("ajustes concurrentes nunca dejan stock negativo", async () => {
    const { variants } = await boxyEssential();
    const variantId = variants[0].id;
    unwrap(await registerInitialStock(inventory, owner, { variantId, quantity: 5, operationKey: randomUUID(), note: null }));

    const results = await Promise.all(
      Array.from({ length: 10 }, () => adjustStock(inventory, operator, { variantId, delta: -1, reason: "damage", note: null, operationKey: randomUUID() })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const [balance] = await sql<{ on_hand: number }[]>`select on_hand from app.inventory_balances where variant_id = ${variantId}`;
    expect(balance.on_hand).toBe(0);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from app.stock_movements where variant_id = ${variantId}`;
    expect(n).toBe(6); // conteo inicial + 5 salidas
  });

  it("no baja el físico por debajo de lo reservado", async () => {
    const { variants } = await boxyEssential();
    const variantId = variants[0].id;
    unwrap(await registerInitialStock(inventory, owner, { variantId, quantity: 5, operationKey: randomUUID(), note: null }));
    // Simula 3 unidades reservadas por pedidos confirmados (fase 5).
    await admin`update app.inventory_balances set reserved = 3 where variant_id = ${variantId}`;
    const result = await adjustStock(inventory, owner, { variantId, delta: -3, reason: "loss", note: "Robo", operationKey: randomUUID() });
    expect(result).toMatchObject({ ok: false, code: "BELOW_RESERVED" });
    expect((await adjustStock(inventory, owner, { variantId, delta: -2, reason: "loss", note: "Robo", operationKey: randomUUID() })).ok).toBe(true);
  });

  it("reenviar el mismo ajuste (doble clic / timeout) no lo aplica dos veces", async () => {
    const { variants } = await boxyEssential();
    const variantId = variants[0].id;
    unwrap(await registerInitialStock(inventory, owner, { variantId, quantity: 1, operationKey: randomUUID(), note: null }));
    const key = randomUUID();
    const input = { variantId, delta: 4, reason: "restock" as const, note: null, operationKey: key };
    const [a, b] = await Promise.all([adjustStock(inventory, owner, input), adjustStock(inventory, owner, input)]);
    expect(a.ok && b.ok).toBe(true);
    const [balance] = await sql<{ on_hand: number }[]>`select on_hand from app.inventory_balances where variant_id = ${variantId}`;
    expect(balance.on_hand).toBe(5);
    expect(await adjustStock(inventory, owner, { ...input, delta: 9 })).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" });
  });

  it("el historial de movimientos es inmutable para el rol runtime", async () => {
    const { variants } = await boxyEssential();
    unwrap(await registerInitialStock(inventory, owner, { variantId: variants[0].id, quantity: 2, operationKey: randomUUID(), note: null }));
    await expect(sql`update app.stock_movements set delta_on_hand = 100`).rejects.toThrow(/permission denied/);
    await expect(sql`delete from app.stock_movements`).rejects.toThrow(/permission denied/);
    await expect(sql`delete from app.categories`).rejects.toThrow(/permission denied/);
  });
});
