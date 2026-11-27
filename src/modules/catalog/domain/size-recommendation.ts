/**
 * Calculadora de tallas BLESH: talla aproximada por altura y peso (S, M o L).
 * Puro y sin I/O. Los rangos son un punto de partida; ajustarlos con pedidos reales.
 */

export const BODY_SIZE_RULES = { mFromHeightCm: 168, lFromHeightCm: 178, lFromWeightKg: 80, mFromWeightKg: 68 } as const;

/**
 * Altura: < 168 → S; 168–177 → M; ≥ 178 → L. Peso: ≥ 80 → L; ≥ 68 y S → M.
 * Devuelve null si los datos están fuera de rangos razonables.
 */
export function recommendByBody(input: { heightCm: number; weightKg: number }, rules = BODY_SIZE_RULES): "S" | "M" | "L" | null {
  const { heightCm, weightKg } = input;
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm < 100 || heightCm > 230 || weightKg < 30 || weightKg > 250) return null;
  let size: "S" | "M" | "L" = heightCm < rules.mFromHeightCm ? "S" : heightCm < rules.lFromHeightCm ? "M" : "L";
  if (weightKg >= rules.lFromWeightKg) size = "L";
  else if (weightKg >= rules.mFromWeightKg && size === "S") size = "M";
  return size;
}
