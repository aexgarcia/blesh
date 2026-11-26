import { z } from "zod";

export const packSettingsSchema = z.object({
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(80),
  productSlugs: z.array(z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(12),
  tierTotalsMinor: z.tuple([z.number().int().min(1).max(10_000_000), z.number().int().min(1).max(20_000_000), z.number().int().min(1).max(30_000_000)]),
}).superRefine((data, ctx) => {
  const [one, two, three] = data.tierTotalsMinor;
  if (two <= one || two > 2 * one || three <= two || three > two + one || 2 * three > 3 * two) ctx.addIssue({ code: "custom", path: ["tierTotalsMinor"], message: "Los totales deben aumentar y el precio por prenda no puede subir al añadir unidades." });
  if (data.enabled && !data.productSlugs.length) ctx.addIssue({ code: "custom", path: ["productSlugs"], message: "Selecciona al menos un producto para activar el pack." });
  if (new Set(data.productSlugs).size !== data.productSlugs.length) ctx.addIssue({ code: "custom", path: ["productSlugs"], message: "Hay productos repetidos." });
});

export class PackSettingsFailure extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
