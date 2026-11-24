import { isValidSlug, slugify } from "../../../shared/domain/slug";
import type { SizeCode } from "../contracts";
import { normalizeSku, priceProblem, publicationIssues, sizeOrder, SKU_PATTERN } from "../domain/rules";
import { CatalogFailure, catalogResult, type CatalogResult } from "./errors";
import type { CatalogActor, CatalogDeps, CatalogTx, ColorRow, ImageRow, ProductRow, VariantRow } from "./ports";

function authorize(deps: CatalogDeps, actor: CatalogActor) {
  if (!deps.authorize(actor, "catalog.manage")) throw new CatalogFailure("FORBIDDEN", "No tienes permiso para editar el catálogo.");
}

async function lock(tx: CatalogTx, productId: string): Promise<ProductRow> {
  const product = await tx.lockProduct(productId);
  if (!product) throw new CatalogFailure("NOT_FOUND", "El producto no existe.");
  if (product.status === "archived") throw new CatalogFailure("INVALID_TRANSITION", "El producto está archivado: restáuralo como borrador para editarlo.");
  return product;
}

/** Tras cambiar hijos de un producto publicado, debe seguir siendo publicable. */
async function assertStillPublishable(tx: CatalogTx, product: ProductRow) {
  if (product.status !== "published") return;
  const [colors, variants, images, categoryActive] = await Promise.all([
    tx.listColors(product.id),
    tx.listVariants(product.id),
    tx.listImages(product.id),
    product.categoryId ? tx.categoryIsActive(product.categoryId) : Promise.resolve(false),
  ]);
  const issues = publicationIssues({ ...product, categoryActive, colors, variants, images });
  if (issues.length > 0) {
    throw new CatalogFailure("NOT_PUBLISHABLE", "Este cambio dejaría el producto publicado incompleto. Pásalo a borrador primero.", undefined, issues);
  }
}

/** Marca un cambio en el producto (versión) para que los editores abiertos detecten conflictos. */
async function touch(tx: CatalogTx, product: ProductRow, actor: CatalogActor) {
  await tx.updateProduct(product.id, {}, actor.membershipId);
}

// ---------- Producto ----------

export type ProductInfoInput = {
  title: string;
  slug?: string;
  shortDescription: string;
  description: string;
  categoryId: string | null;
  sizeGuideId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

async function validateReferences(tx: CatalogTx, input: ProductInfoInput) {
  if (input.categoryId && !(await tx.categoryIsActive(input.categoryId))) {
    throw new CatalogFailure("VALIDATION_ERROR", "La categoría no existe o está inactiva.", "categoryId");
  }
  if (input.sizeGuideId && !(await tx.sizeGuideExists(input.sizeGuideId))) {
    throw new CatalogFailure("VALIDATION_ERROR", "La guía de tallas no existe.", "sizeGuideId");
  }
}

function resolveSlug(input: ProductInfoInput): string {
  const slug = input.slug?.trim() ? input.slug.trim() : slugify(input.title);
  if (!isValidSlug(slug)) throw new CatalogFailure("VALIDATION_ERROR", "Usa solo minúsculas, números y guiones.", "slug");
  return slug;
}

export function createProductDraft(deps: CatalogDeps, actor: CatalogActor, input: ProductInfoInput): Promise<CatalogResult<ProductRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      await validateReferences(tx, input);
      const created = await tx.insertProduct({
        slug: resolveSlug(input),
        title: input.title.trim(),
        shortDescription: input.shortDescription.trim(),
        description: input.description.trim(),
        categoryId: input.categoryId,
        sizeGuideId: input.sizeGuideId,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        actorId: actor.membershipId,
      });
      await tx.audit({ actorId: actor.membershipId, action: "catalog.create_product", productId: created.id });
      return created;
    }),
  );
}

export function updateProductInfo(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: ProductInfoInput & { productId: string; expectedVersion: number },
): Promise<CatalogResult<ProductRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      if (product.version !== input.expectedVersion) {
        throw new CatalogFailure("VERSION_CONFLICT", "Otra persona modificó el producto. Recarga para ver los cambios.");
      }
      await validateReferences(tx, input);
      const slug = resolveSlug({ ...input, slug: input.slug ?? product.slug });
      if (slug !== product.slug && product.firstPublishedAt) {
        throw new CatalogFailure("SLUG_LOCKED", "La URL no puede cambiar después de publicar (rompería enlaces).", "slug");
      }
      const updated = await tx.updateProduct(
        product.id,
        {
          slug,
          title: input.title.trim(),
          shortDescription: input.shortDescription.trim(),
          description: input.description.trim(),
          categoryId: input.categoryId,
          sizeGuideId: input.sizeGuideId,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
        },
        actor.membershipId,
        input.expectedVersion,
      );
      if (!updated) throw new CatalogFailure("VERSION_CONFLICT", "Otra persona modificó el producto. Recarga para ver los cambios.");
      await assertStillPublishable(tx, updated);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.update_product", productId: product.id });
      return updated;
    }),
  );
}

// ---------- Colores ----------

export type ColorInput = { label: string; colorCode?: string; slug?: string; swatchHex: string | null; active: boolean };

export function addColor(deps: CatalogDeps, actor: CatalogActor, input: ColorInput & { productId: string }): Promise<CatalogResult<ColorRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const colors = await tx.listColors(product.id);
      const code = slugify(input.colorCode?.trim() || input.label);
      const slug = slugify(input.slug?.trim() || input.label);
      if (!isValidSlug(code) || !isValidSlug(slug)) throw new CatalogFailure("VALIDATION_ERROR", "Nombre de color inválido.", "label");
      if (colors.some((c) => c.colorCode === code || c.slug === slug)) {
        throw new CatalogFailure("DUPLICATE_COLOR", "Ese color ya existe en el producto.", "label");
      }
      const color = await tx.insertColor({
        productId: product.id,
        colorCode: code,
        label: input.label.trim(),
        slug,
        swatchHex: input.swatchHex,
        active: input.active,
        // El primer color activo es el principal por defecto (explícito y estable).
        isPrimary: input.active && !colors.some((c) => c.isPrimary),
        position: colors.length,
      });
      await touch(tx, product, actor);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.add_color", productId: product.id, changes: { color: code } });
      return color;
    }),
  );
}

export function updateColor(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: { productId: string; colorId: string; label: string; swatchHex: string | null; active: boolean; slug?: string },
): Promise<CatalogResult<ColorRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const colors = await tx.listColors(product.id);
      const color = colors.find((c) => c.id === input.colorId);
      if (!color) throw new CatalogFailure("NOT_FOUND", "El color no existe.");
      const slug = input.slug?.trim() ? slugify(input.slug) : color.slug;
      if (slug !== color.slug) {
        if (product.firstPublishedAt) throw new CatalogFailure("SLUG_LOCKED", "La URL del color no puede cambiar después de publicar.", "slug");
        if (colors.some((c) => c.id !== color.id && c.slug === slug)) throw new CatalogFailure("DUPLICATE_COLOR", "Otro color usa esa URL.", "slug");
      }
      if (!input.active && color.isPrimary) {
        throw new CatalogFailure("VALIDATION_ERROR", "Marca otro color como principal antes de desactivar este.", "active");
      }
      const updated = await tx.updateColor(color.id, { label: input.label.trim(), swatchHex: input.swatchHex, active: input.active, slug });
      await touch(tx, product, actor);
      await assertStillPublishable(tx, product);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.update_color", productId: product.id, changes: { color: color.colorCode, active: input.active } });
      return updated;
    }),
  );
}

export function setPrimaryColor(deps: CatalogDeps, actor: CatalogActor, input: { productId: string; colorId: string }): Promise<CatalogResult<void>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const colors = await tx.listColors(product.id);
      const target = colors.find((c) => c.id === input.colorId);
      if (!target) throw new CatalogFailure("NOT_FOUND", "El color no existe.");
      if (!target.active) throw new CatalogFailure("VALIDATION_ERROR", "El color principal debe estar activo.");
      for (const c of colors) if (c.isPrimary && c.id !== target.id) await tx.updateColor(c.id, { isPrimary: false });
      await tx.updateColor(target.id, { isPrimary: true });
      await touch(tx, product, actor);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.set_primary_color", productId: product.id, changes: { color: target.colorCode } });
    }),
  );
}

// ---------- Variantes ----------

export type VariantInput = { sku: string; priceMinor: number; compareAtMinor: number | null; active: boolean };

function validateVariant(input: VariantInput): string {
  const sku = normalizeSku(input.sku);
  if (!SKU_PATTERN.test(sku)) throw new CatalogFailure("VALIDATION_ERROR", "SKU: 3–40 caracteres, letras, números y guiones.", "sku");
  const problem = priceProblem(input.priceMinor, input.compareAtMinor);
  if (problem) throw new CatalogFailure("VALIDATION_ERROR", problem, input.compareAtMinor !== null && problem.includes("anterior") ? "compareAt" : "price");
  return sku;
}

export function addVariant(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: VariantInput & { productId: string; colorId: string; sizeCode: SizeCode },
): Promise<CatalogResult<VariantRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const sku = validateVariant(input);
      const colors = await tx.listColors(product.id);
      if (!colors.some((c) => c.id === input.colorId)) throw new CatalogFailure("NOT_FOUND", "El color no pertenece al producto.");
      const variants = await tx.listVariants(product.id);
      if (variants.some((v) => v.colorId === input.colorId && v.sizeCode === input.sizeCode)) {
        throw new CatalogFailure("DUPLICATE_COMBINATION", "Ese color ya tiene esa talla.", "sizeCode");
      }
      const variant = await tx.insertVariant({
        productId: product.id,
        colorId: input.colorId,
        sku,
        sizeCode: input.sizeCode,
        priceMinor: input.priceMinor,
        compareAtMinor: input.compareAtMinor,
        active: input.active,
        position: sizeOrder(input.sizeCode),
      });
      await touch(tx, product, actor);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.add_variant", productId: product.id, changes: { sku, size: input.sizeCode } });
      return variant;
    }),
  );
}

export function updateVariant(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: VariantInput & { productId: string; variantId: string; expectedVersion: number },
): Promise<CatalogResult<VariantRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const sku = validateVariant(input);
      const variants = await tx.listVariants(product.id);
      const current = variants.find((v) => v.id === input.variantId);
      if (!current) throw new CatalogFailure("NOT_FOUND", "La variante no existe.");
      const updated = await tx.updateVariant(
        current.id,
        { sku, priceMinor: input.priceMinor, compareAtMinor: input.compareAtMinor, active: input.active },
        input.expectedVersion,
      );
      if (!updated) throw new CatalogFailure("VERSION_CONFLICT", "La variante cambió mientras editabas. Recarga e inténtalo de nuevo.");
      await touch(tx, product, actor);
      await assertStillPublishable(tx, product);
      await tx.audit({
        actorId: actor.membershipId,
        action: "catalog.update_variant",
        productId: product.id,
        changes: { sku, priceMinor: [current.priceMinor, input.priceMinor], active: input.active },
      });
      return updated;
    }),
  );
}

// ---------- Imágenes ----------

export function attachImage(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: { productId: string; mediaId: string; colorId: string | null; alt: string },
): Promise<CatalogResult<ImageRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const alt = input.alt.trim();
      if (alt.length < 1 || alt.length > 200) throw new CatalogFailure("VALIDATION_ERROR", "Describe la imagen (1–200 caracteres).", "alt");
      if (input.colorId && !(await tx.listColors(product.id)).some((c) => c.id === input.colorId)) {
        throw new CatalogFailure("NOT_FOUND", "El color no pertenece al producto.");
      }
      const images = await tx.listImages(product.id);
      const group = images.filter((i) => i.colorId === input.colorId);
      const image = await tx.insertImage({
        productId: product.id,
        colorId: input.colorId,
        mediaId: input.mediaId,
        alt,
        position: group.length,
        // La primera imagen del grupo es la portada por defecto.
        isCover: group.length === 0,
      });
      await touch(tx, product, actor);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.attach_image", productId: product.id });
      return image;
    }),
  );
}

export function updateImage(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: { productId: string; imageId: string; alt?: string; makeCover?: boolean; move?: "up" | "down" },
): Promise<CatalogResult<void>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const images = await tx.listImages(product.id);
      const image = images.find((i) => i.id === input.imageId);
      if (!image) throw new CatalogFailure("NOT_FOUND", "La imagen no existe.");
      const group = images.filter((i) => i.colorId === image.colorId).sort((a, b) => a.position - b.position);

      if (input.alt !== undefined) {
        const alt = input.alt.trim();
        if (alt.length < 1 || alt.length > 200) throw new CatalogFailure("VALIDATION_ERROR", "Describe la imagen (1–200 caracteres).", "alt");
        await tx.updateImage(image.id, { alt });
      }
      if (input.makeCover && !image.isCover) {
        const currentCover = group.find((i) => i.isCover);
        if (currentCover) await tx.updateImage(currentCover.id, { isCover: false });
        await tx.updateImage(image.id, { isCover: true });
      }
      if (input.move) {
        const index = group.findIndex((i) => i.id === image.id);
        const swapWith = group[input.move === "up" ? index - 1 : index + 1];
        if (swapWith) {
          await tx.updateImage(image.id, { position: swapWith.position });
          await tx.updateImage(swapWith.id, { position: image.position });
        }
      }
      await touch(tx, product, actor);
      await assertStillPublishable(tx, product);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.update_image", productId: product.id });
    }),
  );
}

/** Quita la imagen del producto. El archivo se conserva (limpieza física diferida). */
export function detachImage(deps: CatalogDeps, actor: CatalogActor, input: { productId: string; imageId: string }): Promise<CatalogResult<void>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      const images = await tx.listImages(product.id);
      const image = images.find((i) => i.id === input.imageId);
      if (!image) throw new CatalogFailure("NOT_FOUND", "La imagen no existe.");
      await tx.deleteImage(image.id);
      if (image.isCover) {
        const next = images.filter((i) => i.colorId === image.colorId && i.id !== image.id).sort((a, b) => a.position - b.position)[0];
        if (next) await tx.updateImage(next.id, { isCover: true });
      }
      await touch(tx, product, actor);
      await assertStillPublishable(tx, product);
      await tx.audit({ actorId: actor.membershipId, action: "catalog.detach_image", productId: product.id });
    }),
  );
}

// ---------- Publicación ----------

export function publishProduct(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: { productId: string; expectedVersion: number; variantsWithStockRecord: ReadonlySet<string> },
): Promise<CatalogResult<ProductRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await lock(tx, input.productId);
      if (product.version !== input.expectedVersion) throw new CatalogFailure("VERSION_CONFLICT", "El producto cambió. Recarga antes de publicar.");
      if (product.status === "published") return product;
      const [colors, variants, images, categoryActive] = await Promise.all([
        tx.listColors(product.id),
        tx.listVariants(product.id),
        tx.listImages(product.id),
        product.categoryId ? tx.categoryIsActive(product.categoryId) : Promise.resolve(false),
      ]);
      const issues = publicationIssues({ ...product, categoryActive, colors, variants, images, variantsWithStockRecord: input.variantsWithStockRecord });
      if (issues.length > 0) throw new CatalogFailure("NOT_PUBLISHABLE", "Completa los requisitos antes de publicar.", undefined, issues);
      const now = deps.clock.now();
      const updated = await tx.updateProduct(
        product.id,
        { status: "published", publishedAt: now, firstPublishedAt: product.firstPublishedAt ?? now },
        actor.membershipId,
        input.expectedVersion,
      );
      if (!updated) throw new CatalogFailure("VERSION_CONFLICT", "El producto cambió. Recarga antes de publicar.");
      await tx.audit({ actorId: actor.membershipId, action: "catalog.publish", productId: product.id });
      return updated;
    }),
  );
}

export function changeProductStatus(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: { productId: string; expectedVersion: number; to: "draft" | "archived" },
): Promise<CatalogResult<ProductRow>> {
  return catalogResult(() =>
    deps.store.withProduct(async (tx) => {
      authorize(deps, actor);
      const product = await tx.lockProduct(input.productId);
      if (!product) throw new CatalogFailure("NOT_FOUND", "El producto no existe.");
      if (product.version !== input.expectedVersion) throw new CatalogFailure("VERSION_CONFLICT", "El producto cambió. Recarga e inténtalo de nuevo.");
      if (product.status === input.to) return product;
      const updated = await tx.updateProduct(product.id, { status: input.to, publishedAt: null }, actor.membershipId, input.expectedVersion);
      if (!updated) throw new CatalogFailure("VERSION_CONFLICT", "El producto cambió. Recarga e inténtalo de nuevo.");
      await tx.audit({ actorId: actor.membershipId, action: `catalog.${input.to === "archived" ? "archive" : "unpublish"}`, productId: product.id, changes: { from: product.status } });
      return updated;
    }),
  );
}
