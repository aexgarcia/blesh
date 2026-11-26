import { z } from "zod";

import { DELIVERY_MODES, MAX_ORDER_LINES, MAX_UNITS_PER_LINE } from "../contracts";

/**
 * Forma de las entradas públicas (frontera de red). Rechaza carritos manipulados antes de
 * consultar nada: ids no UUID, cantidades no enteras o fuera de rango, demasiadas líneas o
 * cuerpos enormes. Las reglas de negocio (unir repetidos, vendible, precio) siguen en sales.
 */

const price = z.number().int().positive().max(10_000_000);

export const quoteLinesSchema = z
  .array(
    z.object({
      variantId: z.uuid(),
      quantity: z.number().int().min(1).max(MAX_UNITS_PER_LINE),
      seenPriceMinor: price.nullish(),
    }),
  )
  .min(1)
  .max(MAX_ORDER_LINES);

const acceptedLines = z
  .string()
  .max(20_000)
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Carrito inválido." });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(MAX_UNITS_PER_LINE), acceptedPriceMinor: price }))
      .min(1, "Tu carrito está vacío.")
      .max(MAX_ORDER_LINES),
  );

export const requestFormSchema = z.object({
  customerName: z.string().max(120),
  deliveryPreference: z.enum(DELIVERY_MODES),
  acceptedTerms: z.literal("on").optional(),
  termsVersion: z.string().max(60),
  creationKey: z.uuid(),
  couponCode: z.string().trim().toUpperCase().max(30).regex(/^[A-Z0-9-]*$/).optional(),
  acceptedTotalMinor: z.coerce.number().int().min(0).max(100_000_000),
  lines: acceptedLines,
});
