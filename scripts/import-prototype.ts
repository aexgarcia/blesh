/**
 * Importa el prototipo (prototipo/) al entorno LOCAL:
 *   npm run prototype:import              contenido + catálogo
 *   npm run prototype:import -- --content solo fotos/videos de la portada (bucket `content`)
 *   npm run prototype:import -- --catalog solo productos del prototipo (base local)
 *
 * - Descarga los recursos del CDN de la tienda Shopify del negocio y los guarda en el
 *   almacenamiento PROPIO (no se enlaza Shopify). Imágenes → WebP; videos → MP4 tal cual.
 * - Productos: se crean publicados con stock FICTICIO de desarrollo (disponible → 10, agotado → 0).
 *   Nunca en preview/producción: el catálogo real se carga desde el panel.
 * - Idempotente: omite lo que ya existe (slug, SKU, imagen con el mismo texto alternativo).
 */
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import sharp from "sharp";

import { appEnvSchema, parseAuthEnv } from "../src/infrastructure/config/env";
import { createDrizzle } from "../src/infrastructure/database/drizzle";
import { createSupabaseAdminClient } from "../src/infrastructure/supabase/admin-client";
import { CONTENT_BUCKET } from "../src/modules/content/contracts";
import { PROTOTYPE_CONTENT_ASSETS } from "../src/modules/content/infrastructure/storefront-content";
import { ingestImage } from "../src/modules/media/application/ingest-image";
import { createMediaRepository, createSupabaseObjectStorage, sharpImageProcessor } from "../src/modules/media/infrastructure/adapters";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";
const CDN = "https://cdn.shopify.com/s/files/1/0825/6189/2604/files/";

type Size = "S" | "M" | "L";
type ColorDef = { code: string; label: string; swatch: string | null; images: string[]; available: Record<Size, boolean> };
type ProductDef = {
  slug: string;
  title: string;
  category: string;
  guide: "premium" | null;
  shortDescription: string;
  description: string;
  priceMinor: number;
  compareAtMinor: number | null;
  skuPrefix: string;
  colors: ColorDef[];
};

const all = (v: boolean): Record<Size, boolean> => ({ S: v, M: v, L: v });

/** prototipo/assets/data.js, adaptado al modelo producto → color → talla. */
const PRODUCTS: ProductDef[] = [
  {
    slug: "longsleeve-archives",
    title: 'Longsleeve "Archives"',
    category: "manga-larga",
    guide: "premium",
    shortDescription: "BLESH ARCHIVES — DOUBLE SLEEVE",
    description:
      "Una pieza construida para destacar. Confeccionada en algodón 100% peinado 20/1, logrando una estructura firme, tacto suave y una caída premium. El gráfico BLESH ARCHIVES está trabajado en serigrafía premium, con alta fijación de color para mantener su intensidad lavado tras lavado. La construcción Double Sleeve completa la silueta, acompañada de una pestaña personalizada con las estrellas de Blesh.",
    priceMinor: 7000,
    compareAtMinor: 9900,
    skuPrefix: "LS-ARCHIVES",
    colors: [
      {
        code: "gris",
        label: "Gris",
        swatch: null,
        available: all(true),
        images: ["DELANTERO_WEB_ARCHIVES_70d742ac-503a-4787-a6cf-c41fd3379a43.png?v=1791416836", "gris3.jpg?v=1793660652", "gris2.jpg?v=1793660652", "gris.jpg?v=1793660652", "Imagen_de_Codex_10_oct_2026_02_09_43.png?v=1791616323"],
      },
    ],
  },
  {
    slug: "longsleeve-flamas",
    title: 'Longsleeve "Flamas"',
    category: "manga-larga",
    guide: "premium",
    shortDescription: "BLESH FLAMES — DOUBLE SLEEVE",
    description:
      "Una pieza que lleva el gráfico como protagonista. Confeccionada en algodón 100% peinado 20/1, con una estructura firme, tacto suave y una caída premium. El gráfico FLAMES está trabajado en serigrafía premium con trama de colores, logrando mayor detalle y profundidad en las tonalidades, con alta fijación para mantener la intensidad del estampado lavado tras lavado.",
    priceMinor: 7000,
    compareAtMinor: 9900,
    skuPrefix: "LS-FLAMAS",
    colors: [
      {
        code: "negro",
        label: "Negro",
        swatch: null,
        available: all(true),
        images: ["DELANTERO_WEB_FLAMES.png?v=1791416971", "flamas2.jpg?v=1793660796", "flamas1.jpg?v=1793660796", "flamas3.jpg?v=1793660797", "Imagen_de_Codex_10_oct_2026_02_09_43.png?v=1791616323"],
      },
    ],
  },
  {
    slug: "white-premium-boxy",
    title: "White Premium Boxy",
    category: "basicos",
    guide: "premium",
    shortDescription: "BLESH PREMIUM BASIC — 300 GSM",
    description:
      "El básico llevado a otro nivel. Construido en algodón 100% premium de 300 GSM, con una estructura pesada, caída firme y un tacto extra suave. Su proceso de prelavado ayuda a mantener la forma y estabilidad de la prenda, mientras que el acabado anti-pilling reduce la formación de pelusas con el uso.",
    priceMinor: 5200,
    compareAtMinor: 6900,
    skuPrefix: "PB-WHITE",
    colors: [
      {
        code: "perla",
        label: "Perla",
        swatch: null,
        available: { S: false, M: true, L: true },
        images: ["PERLAA.png?v=1791591866", "blannco_2.jpg?v=1793660530", "blanco_1.jpg?v=1793660530", "3.jpg?v=1793660530", "IMG_3233.png?v=1791600251", "Imagen_de_Codex_9_oct_2026_20_20_15.png?v=1791595352"],
      },
    ],
  },
  {
    slug: "grey-premium-boxy",
    title: "Grey Premium Boxy",
    category: "basicos",
    guide: "premium",
    shortDescription: "BLESH PREMIUM BASIC — 300 GSM",
    description:
      "El básico llevado a otro nivel. Construido en algodón 100% premium de 300 GSM, con una estructura pesada, caída firme y un tacto extra suave. Su proceso de prelavado ayuda a mantener la forma y estabilidad de la prenda, mientras que el acabado anti-pilling reduce la formación de pelusas con el uso.",
    priceMinor: 5200,
    compareAtMinor: 6900,
    skuPrefix: "PB-GREY",
    colors: [
      {
        code: "gris",
        label: "Gris",
        swatch: null,
        available: all(false),
        images: [
          "GRIS.png?v=1791527200",
          "Sin_titulo-1.jpg?v=1793659804",
          "Sin_titulo-3.jpg?v=1793659804",
          "Imagen_de_Codex_10_oct_2026_23_20_08-1.png?v=1791692546",
          "Imagen_de_Codex_9_oct_2026_20_20_15_3a8de9ad-eb93-431e-a19e-c8ec0207cd50.png?v=1791600394",
          "Sin_titulo-2.jpg?v=1793659804",
        ],
      },
    ],
  },
  {
    slug: "zip-hoodie-vapor",
    title: "Zip Hoodie / Vapor",
    category: "zip-hoodies",
    guide: null,
    shortDescription: "DOUBLE ZIP HOODIE — BLESH",
    description:
      "Hoodie premium de doble cierre, confeccionado en French Terry de 3 hilos de 450 GSM, suavizado para un tacto más cómodo y pesado. Incluye detalles en bordado, estampado de tacto cero y aplicaciones en alto relieve que aportan textura y profundidad al diseño. La capucha lleva la firma de Blesh bordada, reforzando el acabado premium de la pieza.",
    priceMinor: 9900,
    compareAtMinor: null,
    skuPrefix: "ZIP-VAPOR",
    colors: [
      {
        code: "crema",
        label: "Crema",
        swatch: null,
        available: { S: false, M: true, L: true },
        images: ["BLESH-Zip-Crema-Frente-Final.png?v=1790996199", "BLESH-Zip-Crema-Espalda-Diseno-Pegado-Exacto-v3.png?v=1790998485"],
      },
    ],
  },
  {
    slug: "zip-hoodie-flying",
    title: "Zip Hoodie / Flying",
    category: "zip-hoodies",
    guide: null,
    shortDescription: "DOUBLE ZIP HOODIE — BLESH",
    description:
      "Hoodie premium de doble cierre, confeccionado en French Terry de 3 hilos de 450 GSM, suavizado para un tacto más cómodo y pesado. Incluye detalles en bordado, estampado de tacto cero y aplicaciones en alto relieve que aportan textura y profundidad al diseño. La capucha lleva la firma de Blesh bordada, reforzando el acabado premium de la pieza.",
    priceMinor: 9900,
    compareAtMinor: null,
    skuPrefix: "ZIP-FLYING",
    colors: [
      {
        code: "chocolate",
        label: "Chocolate",
        swatch: null,
        available: { S: false, M: true, L: true },
        images: ["BLESH-Zip-Chocolate-Catalogo.png?v=1791136127", "zip_hoodie.png?v=1791136097"],
      },
    ],
  },
  {
    slug: "boxy-essential",
    title: "Boxy Essential",
    category: "boxy-essential",
    guide: null,
    shortDescription: "El básico que vas a usar todos los días. Corte boxy y tela fresca.",
    description: "El básico que vas a usar todos los días. Corte boxy, tela fresca y un cuello que no se rinde.",
    priceMinor: 4000,
    compareAtMinor: null,
    skuPrefix: "BOXY-ESSENTIAL",
    colors: [
      { code: "blanco", label: "Blanco", swatch: "#f4f4f2", available: all(true), images: ["DELANTEBLANCO.jpg?v=1794949165", "ESPALDABLANCA.jpg?v=1794949165"] },
      { code: "celeste", label: "Celeste", swatch: "#a9c6e3", available: all(true), images: ["DELANTEAZUL.jpg?v=1794948873", "ESPALDAAZUL.jpg?v=1794948873"] },
      { code: "negro", label: "Negro", swatch: "#161616", available: all(true), images: ["DELANTENEGRO.jpg?v=1794949184", "ESPALDANEGRO.jpg?v=1794949185"] },
    ],
  },
];

function assertLocal(databaseUrl: string) {
  const env = appEnvSchema.parse(process.env.APP_ENV ?? "development");
  if (env !== "development" && env !== "test") throw new Error(`Bloqueado: APP_ENV=${env}. La importación del prototipo es solo local.`);
  const host = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error(`Bloqueado: la base no es local (${host}).`);
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { headers: { "user-agent": "blesh-import/1.0" } });
  if (!response.ok) throw new Error(`Descarga fallida (${response.status}): ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

const withWidth = (file: string, width: number) => `${CDN}${file}&width=${width}`;

async function importContent(client: ReturnType<typeof createSupabaseAdminClient>) {
  const options = { public: true, fileSizeLimit: 20 * 1024 * 1024, allowedMimeTypes: ["image/webp", "video/mp4"] };
  const { data: existing } = await client.storage.getBucket(CONTENT_BUCKET);
  const { error } = existing ? await client.storage.updateBucket(CONTENT_BUCKET, options) : await client.storage.createBucket(CONTENT_BUCKET, options);
  if (error) throw new Error(error.message);

  for (const asset of PROTOTYPE_CONTENT_ASSETS) {
    const raw = await download(asset.source);
    const bytes =
      asset.kind === "image"
        ? new Uint8Array(await sharp(raw).rotate().resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer())
        : raw;
    const { error: uploadError } = await client.storage
      .from(CONTENT_BUCKET)
      .upload(asset.key, bytes, { contentType: asset.kind === "image" ? "image/webp" : "video/mp4", upsert: true, cacheControl: "86400" });
    if (uploadError) throw new Error(`${asset.key}: ${uploadError.message}`);
    console.log(`  ✓ ${asset.key} (${Math.round(bytes.byteLength / 1024)} KB)`);
  }
}

async function importCatalog(sql: postgres.Sql, client: ReturnType<typeof createSupabaseAdminClient>, supabaseUrl: string) {
  const deps = {
    processor: sharpImageProcessor,
    storage: createSupabaseObjectStorage(client, supabaseUrl),
    repository: createMediaRepository(createDrizzle(sql)),
    newId: randomUUID,
  };
  const [guide] = await sql<{ id: string }[]>`select id from app.size_guides where code = 'premium'`;

  // El primero de la lista queda como el más reciente (orden del rail «Nuevos ingresos»).
  for (const [index, def] of PRODUCTS.entries()) {
    const [category] = await sql<{ id: string }[]>`select id from app.categories where slug = ${def.category}`;
    if (!category) throw new Error(`Falta la categoría ${def.category} (seed de la fase 3).`);
    const publishedAt = new Date(Date.now() - index * 60_000).toISOString();
    let [product] = await sql<{ id: string }[]>`select id from app.products where slug = ${def.slug}`;
    if (!product) {
      [product] = await sql<{ id: string }[]>`
        insert into app.products (slug, title, short_description, description, category_id, size_guide_id, status, published_at, first_published_at, created_by, updated_by)
        values (${def.slug}, ${def.title}, ${def.shortDescription}, ${def.description}, ${category.id}, ${def.guide ? (guide?.id ?? null) : null},
                'published', ${publishedAt}, ${publishedAt}, ${SYSTEM_ACTOR}, ${SYSTEM_ACTOR})
        returning id`;
      console.log(`  + producto ${def.slug}`);
    }

    const hasPrimary = (await sql`select 1 from app.product_colors where product_id = ${product.id} and is_primary`).length > 0;
    for (const [position, color] of def.colors.entries()) {
      let [row] = await sql<{ id: string }[]>`select id from app.product_colors where product_id = ${product.id} and slug = ${color.code}`;
      if (!row) {
        [row] = await sql<{ id: string }[]>`
          insert into app.product_colors (product_id, color_code, label, slug, swatch_hex, position, is_primary)
          values (${product.id}, ${color.code}, ${color.label}, ${color.code}, ${color.swatch}, ${position}, ${!hasPrimary && position === 0})
          returning id`;
        console.log(`    + color ${color.label}`);
      } else if (color.swatch) {
        await sql`update app.product_colors set swatch_hex = ${color.swatch} where id = ${row.id}`;
      }

      for (const [sizePosition, size] of (["S", "M", "L"] as Size[]).entries()) {
        const sku = `${def.skuPrefix}-${color.code.toUpperCase()}-${size}`;
        if ((await sql`select 1 from app.product_variants where sku = ${sku}`).length > 0) continue;
        const [variant] = await sql<{ id: string }[]>`
          insert into app.product_variants (product_id, color_id, sku, size_code, price_minor, compare_at_minor, position)
          values (${product.id}, ${row.id}, ${sku}, ${size}, ${def.priceMinor}, ${def.compareAtMinor}, ${sizePosition})
          returning id`;
        const units = color.available[size] ? 10 : 0;
        await sql`insert into app.inventory_balances (variant_id, on_hand) values (${variant.id}, ${units})`;
        if (units > 0) {
          await sql`
            insert into app.stock_movements (variant_id, delta_on_hand, on_hand_after, reserved_after, reason, note, operation_key, actor_id)
            values (${variant.id}, ${units}, ${units}, 0, 'initial_count', 'Stock ficticio de desarrollo (prototipo)', ${`prototype:${sku}`}, null)`;
        }
      }

      // Fotos del prototipo: la primera es portada del color (desplaza la portada anterior).
      for (const [imagePosition, file] of color.images.entries()) {
        const alt = `${def.title} ${color.label} — foto ${imagePosition + 1}`;
        if ((await sql`select 1 from app.product_images where product_id = ${product.id} and color_id = ${row.id} and alt = ${alt}`).length > 0) continue;
        let bytes = await download(withWidth(file, 1600));
        if (bytes.byteLength > 5 * 1024 * 1024) bytes = await download(withWidth(file, 1100));
        const result = await ingestImage(deps, { bytes, actorId: SYSTEM_ACTOR });
        if (!result.ok) throw new Error(`${file}: ${result.message}`);
        if (imagePosition === 0) await sql`update app.product_images set is_cover = false, position = position + 100 where product_id = ${product.id} and color_id = ${row.id}`;
        await sql`
          insert into app.product_images (product_id, color_id, media_id, alt, position, is_cover)
          values (${product.id}, ${row.id}, ${result.image.id}, ${alt}, ${imagePosition}, ${imagePosition === 0})`;
      }
    }
  }
}

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("Falta MIGRATION_DATABASE_URL (ver .env.example).");
  assertLocal(url);
  const auth = parseAuthEnv(process.env);
  if (!auth) throw new Error("Falta configuración de Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY).");
  const client = createSupabaseAdminClient(auth);
  const args = process.argv.slice(2);
  const only = args.includes("--content") ? "content" : args.includes("--catalog") ? "catalog" : "all";

  if (only !== "catalog") {
    console.log("Contenido de portada → bucket «content»");
    await importContent(client);
  }
  if (only !== "content") {
    console.log("Catálogo del prototipo → base local");
    const sql = postgres(url, { max: 1, onnotice: () => undefined });
    try {
      await importCatalog(sql, client, auth.SUPABASE_URL);
    } finally {
      await sql.end();
    }
  }
  console.log("✓ Listo. La caché pública se renueva en ≤ 5 min (o reinicia `npm run dev`).");
}

main().catch((error: unknown) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
