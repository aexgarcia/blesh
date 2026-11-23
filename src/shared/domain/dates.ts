/** Fechas almacenadas en UTC; se muestran en hora de Lima. */

export const BUSINESS_TIME_ZONE = "America/Lima";

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: BUSINESS_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  timeZone: BUSINESS_TIME_ZONE,
  dateStyle: "medium",
});

export function formatLimaDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

export function formatLimaDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Reloj inyectable para reglas que dependen del tiempo. */
export type Clock = { now: () => Date };
export const systemClock: Clock = { now: () => new Date() };
