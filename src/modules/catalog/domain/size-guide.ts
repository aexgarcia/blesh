import { isSizeCode, sizeOrder } from "./rules";

export type GuideInput = { name: string; rows: { sizeCode: string; lengthCm: string; widthCm: string }[] };

/** Acepta cm con hasta un decimal; evita el redondeo silencioso de numeric(5,1). */
export function parseCentimeters(input: string): string | null {
  const value = input.trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d)?$/.test(value)) return null;
  const number = Number(value);
  return number > 0 && number <= 200 ? number.toFixed(1) : null;
}

export function normalizeGuide(input: GuideInput): GuideInput | { message: string; field: string } {
  const name = input.name.trim();
  if (!name || name.length > 100) return { message: "El nombre debe tener entre 1 y 100 caracteres.", field: "name" };
  if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 7) return { message: "Añade entre 1 y 7 tallas.", field: "rows" };
  const seen = new Set<string>();
  const rows = [];
  for (const row of input.rows) {
    if (!row || !isSizeCode(row.sizeCode) || seen.has(row.sizeCode)) return { message: "Elige tallas válidas sin repetir.", field: "rows" };
    if (typeof row.lengthCm !== "string" || typeof row.widthCm !== "string") return { message: "Ingresa largo y ancho en centímetros.", field: "rows" };
    seen.add(row.sizeCode);
    const lengthCm = parseCentimeters(row.lengthCm);
    const widthCm = parseCentimeters(row.widthCm);
    if (!lengthCm || !widthCm) return { message: `${row.sizeCode}: largo y ancho deben ser mayores que 0 y hasta 200 cm, con un máximo de un decimal.`, field: "rows" };
    rows.push({ sizeCode: row.sizeCode, lengthCm, widthCm });
  }
  if (seen.has("UNICA") && rows.length > 1) return { message: "Talla única debe ir sola en la guía.", field: "rows" };
  rows.sort((a, b) => sizeOrder(a.sizeCode) - sizeOrder(b.sizeCode));
  return { name, rows };
}
