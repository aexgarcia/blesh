import { z } from "zod";

import { parsePENInput } from "../../../shared/domain/money";
import { SIZE_CODES } from "../contracts";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid().nullable());

export const productInfoSchema = z.object({
  title: z.string().trim().min(1, "Ingresa el título.").max(160, "Máximo 160 caracteres."),
  slug: z.string().trim().max(80).optional(),
  shortDescription: z.string().trim().max(300, "Máximo 300 caracteres."),
  description: z.string().trim().max(5000, "Máximo 5000 caracteres."),
  categoryId: optionalUuid,
  sizeGuideId: optionalUuid,
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});

const price = (label: string) =>
  z
    .string()
    .transform((v, ctx) => {
      const minor = parsePENInput(v);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: `${label}: usa un formato como 70 o 70.50.` });
        return z.NEVER;
      }
      return minor;
    });

const optionalPrice = z
  .string()
  .transform((v, ctx) => {
    if (!v.trim()) return null;
    const minor = parsePENInput(v);
    if (minor === null) {
      ctx.addIssue({ code: "custom", message: "Precio anterior: usa un formato como 99 o 99.90." });
      return z.NEVER;
    }
    return minor;
  });

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true");

export const colorSchema = z.object({
  label: z.string().trim().min(1, "Ingresa el nombre del color.").max(40, "Máximo 40 caracteres."),
  swatchHex: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^#[0-9a-f]{6}$/, "Color hex como #1c1c1c.").nullable()),
  active: checkbox,
});

export const variantSchema = z.object({
  sku: z.string().trim().min(3, "SKU: mínimo 3 caracteres.").max(40),
  price: price("Precio"),
  compareAt: optionalPrice,
  active: checkbox,
});

export const newVariantSchema = variantSchema.extend({
  colorId: z.uuid(),
  sizeCode: z.enum(SIZE_CODES, { message: "Elige una talla." }),
});

export const imageMetaSchema = z.object({
  alt: z.string().trim().min(1, "Describe la imagen (texto alternativo).").max(200, "Máximo 200 caracteres."),
  colorId: optionalUuid,
});
