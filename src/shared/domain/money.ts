/**
 * Dinero en PEN como entero de céntimos (S/ 40,00 = 4000). Sin floats en cálculos.
 */

export const CURRENCY = "PEN" as const;
export type Currency = typeof CURRENCY;

/** Máximo precio unitario aceptado: S/ 100.000,00. */
export const MAX_UNIT_PRICE_MINOR = 10_000_000;
/** Máximo total de pedido aceptado: S/ 1.000.000,00. */
export const MAX_ORDER_TOTAL_MINOR = 100_000_000;

export function isMinorAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assertMinorAmount(value: number, max: number = MAX_ORDER_TOTAL_MINOR): number {
  if (!isMinorAmount(value) || value > max) {
    throw new RangeError(`Importe inválido: ${value}`);
  }
  return value;
}

/** Multiplica un precio unitario por una cantidad entera positiva. */
export function multiplyMinor(unitMinor: number, quantity: number): number {
  assertMinorAmount(unitMinor, MAX_UNIT_PRICE_MINOR);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError(`Cantidad inválida: ${quantity}`);
  }
  return assertMinorAmount(unitMinor * quantity);
}

export function sumMinor(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += assertMinorAmount(amount);
  }
  return assertMinorAmount(total);
}

/**
 * Convierte un importe escrito por una persona ("70", "70.5", "70,50", "1 250.00") a céntimos,
 * sin floats. Devuelve `null` si es ambiguo o inválido (p. ej. "1.250,00" o más de 2 decimales).
 */
export function parsePENInput(input: string): number | null {
  const compact = input.trim().replace(/^S\/\s*/i, "").replace(/\s/g, "");
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(compact);
  if (!match) return null;
  const soles = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const minor = soles * 100 + cents;
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Céntimos a texto editable: 7050 → "70.50". */
export function minorToInput(minor: number): string {
  const soles = Math.floor(minor / 100);
  const cents = String(minor % 100).padStart(2, "0");
  return `${soles}.${cents}`;
}

const penFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formatea solo para presentación: 4000 → "S/ 40.00". */
export function formatPEN(minor: number): string {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Importe inválido: ${minor}`);
  }
  // División exacta para mostrar; el valor de negocio sigue siendo entero.
  return penFormatter.format(minor / 100);
}
