import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { AnyDatabase } from "@/infrastructure/database/types";
import type { AdminActor } from "@/modules/identity/contracts";
import { defaultHomeSections, readHomeSections, saveHomeSectionWithin } from "@/modules/content/server";
import { getAdminPackSettings, savePackSettingsWithin, buildSalesDeps } from "@/modules/sales/server";
import { quoteCart, submitWebRequest } from "@/modules/sales/application/web-requests";
import { createOrderRequest } from "@/modules/sales/application/order-commands";
import { REQUEST_TERMS, type PackSettingsInput } from "@/modules/sales/contracts";

import { openTestDb, resetTables } from "../support/test-db";
import { saveHomeVisuals } from "@/composition/storefront-visuals";
import { submitConfiguredStorefrontRequest } from "@/composition/storefront-ordering";

const { db, sql } = openTestDb();
const owner: AdminActor = { membershipId: randomUUID(), authSubject: randomUUID(), role: "owner", displayName: "QA", email: "qa@blesh.test" };
const operator: AdminActor = { ...owner, membershipId: randomUUID(), role: "operator" };
const deps = buildSalesDeps(db);
const base: PackSettingsInput = { enabled: true, label: "Pack QA", productSlugs: ["pack-settings-qa"], tierTotalsMinor: [4000,7000,9000] };
let variantId: string;

const savePack = (input = base, version = 0, operationKey = randomUUID(), actor = owner) =>
  db.transaction((tx) => savePackSettingsWithin(tx as unknown as AnyDatabase, actor, { ...input, expectedVersion: version, operationKey }));

beforeEach(async () => {
  await resetTables(["pack_config", "storefront_sections", "orders", "products"]);
  const [category] = await sql<{ id: string }[]>`select id from app.categories order by slug limit 1`;
  const [product] = await sql<{ id: string }[]>`insert into app.products (slug,title,category_id,status,published_at,created_by,updated_by) values ('pack-settings-qa','Pack QA',${category.id},'published',now(),${owner.membershipId},${owner.membershipId}) returning id`;
  const [color] = await sql<{ id: string }[]>`insert into app.product_colors (product_id,color_code,label,slug,is_primary) values (${product.id},'negro','Negro','negro',true) returning id`;
  [{ id: variantId }] = await sql<{ id: string }[]>`insert into app.product_variants (product_id,color_id,sku,size_code,price_minor) values (${product.id},${color.id},'PACK-SETTINGS-QA-M','M',4000) returning id`;
  await sql`insert into app.inventory_balances (variant_id,on_hand) values (${variantId},10)`;
});

afterAll(async () => {
  await resetTables(["pack_config", "storefront_sections"]);
  await sql.end();
});

describe("tienda administrable", () => {
  it("guarda datos generales y usa el número actual de pedidos sin confiar en el navegador", async () => {
    const data = { ...defaultHomeSections().general, orderWhatsapp: "+51 900 000 001", contactWhatsapp: "+51 900 000 002", email: "qa@example.com" };
    const operationKey = randomUUID();
    const save = (values = data, expectedVersion = 0, key = operationKey, actor = owner) => db.transaction((tx) => saveHomeSectionWithin(tx as unknown as AnyDatabase, actor, "general", { data: values, expectedVersion, operationKey: key }));
    await expect(save(data, 0, randomUUID(), operator)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await save(); await save();
    expect((await readHomeSections(db)).general).toMatchObject({ version: 1, data: { orderWhatsapp: "51900000001", contactWhatsapp: "51900000002" } });
    const request = { lines: [{ variantId, quantity: 1, acceptedPriceMinor: 4000 }], acceptedTotalMinor: 4000, customerName: "QA", customerPhone: "987654321", deliveryPreference: "pickup" as const, creationKey: randomUUID(), termsVersion: REQUEST_TERMS.version, acceptedTerms: true };
    const first = await submitConfiguredStorefrontRequest(request, { consumeRateLimit: async () => true }, db);
    expect(first).toMatchObject({ ok: true });
    if (first.ok) expect(first.receipt.whatsappUrl).toMatch(/^https:\/\/wa.me\/51900000001\?/);
    await save({ ...data, orderWhatsapp: "51900000003" }, 1, randomUUID());
    const changed = await submitConfiguredStorefrontRequest({ ...request, creationKey: randomUUID() }, { consumeRateLimit: async () => true }, db);
    if (changed.ok) expect(changed.receipt.whatsappChatUrl).toBe("https://wa.me/51900000003");
    expect(changed.ok).toBe(true);
    await save({ ...data, orderWhatsapp: "" }, 2, randomUUID());
    expect(await submitConfiguredStorefrontRequest({ ...request, creationKey: randomUUID() }, { consumeRateLimit: async () => { throw Error("Disabled request must not consume quota"); } }, db)).toMatchObject({ ok: false, code: "ORDERING_DISABLED" });
    await expect(save(data, 1, randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("portada y colecciones validan permisos, archivos y destinos antes de publicar", async () => {
    const refs = { db, assets: [{ key: "hero/banner.webp", kind: "image" }, { key: "collections/a.webp", kind: "image" }], products: [{ slug: "pack-settings-qa", status: "published" }], categories: [{ slug: "qa-category" }] };
    const hero = { ...defaultHomeSections().hero, title: "Portada QA", ctaHref: "/productos/pack-settings-qa" };
    const input = { data: hero, expectedVersion: 0, operationKey: randomUUID() };
    await expect(saveHomeVisuals(refs, operator, "hero", input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveHomeVisuals({ ...refs, assets: [] }, owner, "hero", input)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(saveHomeVisuals({ ...refs, products: [] }, owner, "hero", input)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await readHomeSections(db)).hero.version).toBe(0);
    await saveHomeVisuals(refs, owner, "hero", input);
    await saveHomeVisuals(refs, owner, "hero", input);
    expect((await readHomeSections(db)).hero).toMatchObject({ version: 1, data: hero });
    const item = { id: randomUUID(), title: "Colección QA", text: "", href: "/categorias/qa-category", imageKey: "collections/a.webp", imageAlt: "Prenda QA" };
    const collection = { data: { enabled: true, title: "Líneas", eyebrow: "", items: [item] }, expectedVersion: 0, operationKey: randomUUID() };
    await expect(saveHomeVisuals({ ...refs, categories: [] }, owner, "collections", collection)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await saveHomeVisuals(refs, owner, "collections", collection);
    expect((await readHomeSections(db)).collections).toMatchObject({ version: 1, data: collection.data });
    const [audit] = await sql<{ n: number }[]>`select count(*)::int n from app.audit_events where actor_id=${owner.membershipId} and action='content.hero.updated'`;
    expect(audit.n).toBe(1);
    const edits = await Promise.allSettled(["Uno", "Dos"].map((title) => saveHomeVisuals(refs, owner, "hero", { data: { ...hero, title }, expectedVersion: 1, operationKey: randomUUID() })));
    expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(edits.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "VERSION_CONFLICT" } });
  });

  it("operator no puede cambiar secciones ni precios; no hay escrituras parciales", async () => {
    await expect(savePack(base, 0, randomUUID(), operator)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(db.transaction((tx) => saveHomeSectionWithin(tx as unknown as AnyDatabase, operator, "pack", { data: defaultHomeSections().pack, expectedVersion: 0, operationKey: randomUUID() }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await readHomeSections(db)).pack.version).toBe(0);
    expect((await getAdminPackSettings(owner, db)).version).toBe(0);
  });

  it("guarda contenido, orden y visibilidad; un reintento no duplica la auditoría", async () => {
    const data = { ...defaultHomeSections().reels, enabled: false, title: "Videos de prendas", items: [...defaultHomeSections().reels.items].reverse() };
    const operationKey = randomUUID();
    const save = () => db.transaction((tx) => saveHomeSectionWithin(tx as unknown as AnyDatabase, owner, "reels", { data, expectedVersion: 0, operationKey }));
    await save(); await save();
    const read = (await readHomeSections(db)).reels;
    expect(read).toMatchObject({ version: 1, data });
    const [count] = await sql<{ n: number }[]>`select count(*)::int n from app.audit_events where actor_id=${owner.membershipId} and action='content.reels.updated'`;
    expect(count.n).toBe(1);
    await expect(db.transaction((tx) => saveHomeSectionWithin(tx as unknown as AnyDatabase, owner, "reels", { data: { ...data, title: "Otro" }, expectedVersion: 1, operationKey }))).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("dos ediciones con la misma versión: gana una y la otra debe recargar", async () => {
    const results = await Promise.allSettled([savePack(), savePack({ ...base, tierTotalsMinor: [4000,7200,9600] })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe("VERSION_CONFLICT");
  });

  it("cambiar precios conserva solicitudes previas; web/manual usan la misma política y desactivar quita el descuento", async () => {
    await savePack();
    const request = { lines: [{ variantId, quantity: 3, acceptedPriceMinor: 4000 }], acceptedTotalMinor: 9000, customerName: "Cliente QA", customerPhone: "987654321", deliveryPreference: "pickup" as const, creationKey: randomUUID(), termsVersion: REQUEST_TERMS.version, acceptedTerms: true };
    const original = await submitWebRequest(deps, request, { consumeRateLimit: async () => true });
    expect(original.ok && original.request.totalMinor).toBe(9000);
    expect(original.ok && original.request.message).toContain("Pack QA");
    const manual = await createOrderRequest(deps, owner, { source: "whatsapp", lines: [{ variantId, quantity: 3 }], customerName: "Cliente QA", customerPhone: "987654321", deliveryPreference: "pickup", creationKey: randomUUID() });
    expect(manual.ok).toBe(true);
    if (manual.ok) {
      const [row] = await sql<{ total_minor: number; promotion_code: string }[]>`select total_minor,promotion_code from app.order_revisions where order_id=${manual.value.id}`;
      expect(row).toMatchObject({ total_minor: 9000, promotion_code: "pack-boxy-essential@2" });
    }
    await savePack({ ...base, label: "Nombre nuevo", tierTotalsMinor: [4000,7500,9900] }, 1);
    const quote = await quoteCart(deps, [{ variantId, quantity: 3 }]);
    expect(quote.ok && quote.quote.totalMinor).toBe(9900);
    const changed = await submitWebRequest(deps, { ...request, creationKey: randomUUID() }, { consumeRateLimit: async () => true });
    expect(changed).toMatchObject({ ok: false, code: "QUOTE_CHANGED" });
    const retry = await submitWebRequest(deps, request, { consumeRateLimit: async () => { throw new Error("No consumir para reintento"); } });
    expect(retry.ok && retry.replayed && retry.request.totalMinor).toBe(9000);
    expect(retry.ok && retry.request.message).toContain("Pack QA");
    expect(retry.ok && retry.request.message).not.toContain("Nombre nuevo");
    await savePack({ ...base, enabled: false }, 2);
    const disabled = await quoteCart(deps, [{ variantId, quantity: 3 }]);
    expect(disabled.ok && disabled.quote.totalMinor).toBe(12000);
  });

  it("contenido y promoción se revierten juntos si una versión está desactualizada", async () => {
    await savePack();
    await expect(db.transaction(async (raw) => {
      const tx = raw as unknown as AnyDatabase;
      await saveHomeSectionWithin(tx, owner, "pack", { data: { enabled: true, eyebrow: "", title: "No debe guardarse" }, expectedVersion: 0, operationKey: randomUUID() });
      await savePackSettingsWithin(tx, owner, { ...base, expectedVersion: 0, operationKey: randomUUID() });
    })).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await readHomeSections(db)).pack.version).toBe(0);
  });
});
