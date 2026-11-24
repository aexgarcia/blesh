import type { AdjustmentReason } from "../contracts";

export const MAX_ADJUSTMENT = 100_000;

export type AdjustmentProblem = { code: "VALIDATION_ERROR" | "BELOW_RESERVED" | "NEGATIVE_STOCK"; message: string; field?: string };

/** Motivos que requieren una nota explicativa. */
const NOTE_REQUIRED: ReadonlySet<AdjustmentReason> = new Set(["count_correction", "loss", "other"]);

export function validateAdjustment(input: { delta: number; reason: AdjustmentReason; note: string | null }): AdjustmentProblem | null {
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) return { code: "VALIDATION_ERROR", message: "Indica una cantidad entera distinta de 0.", field: "delta" };
  if (Math.abs(input.delta) > MAX_ADJUSTMENT) return { code: "VALIDATION_ERROR", message: "Cantidad fuera de rango.", field: "delta" };
  if (input.reason === "restock" && input.delta < 0) return { code: "VALIDATION_ERROR", message: "Un ingreso debe sumar unidades.", field: "delta" };
  if ((input.reason === "damage" || input.reason === "loss") && input.delta > 0) return { code: "VALIDATION_ERROR", message: "Daño o pérdida deben restar unidades.", field: "delta" };
  if (NOTE_REQUIRED.has(input.reason) && !input.note?.trim()) return { code: "VALIDATION_ERROR", message: "Explica el motivo en la nota.", field: "note" };
  return null;
}

/** El físico nunca baja de 0 ni de lo ya reservado por pedidos confirmados. */
export function checkResultingBalance(onHand: number, reserved: number, delta: number): AdjustmentProblem | null {
  const next = onHand + delta;
  if (next < 0) return { code: "NEGATIVE_STOCK", message: `Solo hay ${onHand} unidades físicas.`, field: "delta" };
  if (next < reserved) return { code: "BELOW_RESERVED", message: `Hay ${reserved} unidades reservadas por pedidos; el físico no puede quedar por debajo.`, field: "delta" };
  return null;
}
