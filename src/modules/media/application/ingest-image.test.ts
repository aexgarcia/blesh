import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { sharpImageProcessor } from "../infrastructure/adapters";
import { ingestImage, type MediaDeps } from "./ingest-image";

function fakeDeps() {
  const stored = new Map<string, Uint8Array>();
  const deps: MediaDeps = {
    processor: sharpImageProcessor,
    storage: {
      put: async (key, bytes) => void stored.set(key, bytes),
      delete: async (key) => void stored.delete(key),
      publicUrl: (key) => `https://cdn.test/${key}`,
    },
    repository: {
      insertReady: async (input) => ({ id: randomUUID(), objectKey: input.objectKey, width: input.width, height: input.height }),
      findByIds: async () => [],
    },
    newId: randomUUID,
  };
  return { deps, stored };
}

const png = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#1c1c1c" } }).png().toBuffer().then((b) => new Uint8Array(b));

describe("ingesta de imágenes (sharp real)", () => {
  it("convierte a WebP con clave generada por el servidor", async () => {
    const { deps, stored } = fakeDeps();
    const result = await ingestImage(deps, { bytes: await png(800, 1000), actorId: randomUUID() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image).toMatchObject({ width: 800, height: 1000 });
    const [key, bytes] = [...stored.entries()][0];
    expect(key).toMatch(/^products\/[0-9a-f-]{36}\.webp$/);
    expect((await sharp(bytes).metadata()).format).toBe("webp");
  });

  it("elimina metadatos EXIF (p. ej. GPS) y aplica la orientación", async () => {
    const { deps, stored } = fakeDeps();
    const withExif = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#fff" } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "secreto", Artist: "persona" } } })
      .toBuffer();
    const result = await ingestImage(deps, { bytes: new Uint8Array(withExif), actorId: randomUUID() });
    expect(result.ok).toBe(true);
    const meta = await sharp([...stored.values()][0]).metadata();
    expect(meta.exif).toBeUndefined();
    // Orientación 6 = rotada 90°: el resultado queda apaisado y ya sin orientación pendiente.
    expect(meta.width).toBe(900);
    expect(meta.height).toBe(600);
  });

  it("rechaza SVG/HTML aunque se declare como imagen", async () => {
    const { deps, stored } = fakeDeps();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><script>alert(1)</script></svg>');
    const result = await ingestImage(deps, { bytes: svg, actorId: randomUUID() });
    expect(result).toMatchObject({ ok: false, code: "UNSUPPORTED_FORMAT" });
    const html = new TextEncoder().encode("<html><body>hola</body></html>");
    expect((await ingestImage(deps, { bytes: html, actorId: randomUUID() })).ok).toBe(false);
    expect(stored.size).toBe(0);
  });

  it("rechaza imágenes pequeñas, demasiado pesadas o vacías", async () => {
    const { deps } = fakeDeps();
    expect(await ingestImage(deps, { bytes: await png(300, 300), actorId: randomUUID() })).toMatchObject({ ok: false, code: "IMAGE_TOO_SMALL" });
    expect(await ingestImage(deps, { bytes: new Uint8Array(6 * 1024 * 1024), actorId: randomUUID() })).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
    expect(await ingestImage(deps, { bytes: new Uint8Array(), actorId: randomUUID() })).toMatchObject({ ok: false, code: "INVALID_IMAGE" });
  });

  it("si falla el registro en BD, borra el objeto subido", async () => {
    const { deps, stored } = fakeDeps();
    deps.repository.insertReady = async () => {
      throw new Error("db down");
    };
    await expect(ingestImage(deps, { bytes: await png(500, 500), actorId: randomUUID() })).rejects.toThrow("db down");
    expect(stored.size).toBe(0);
  });
});
