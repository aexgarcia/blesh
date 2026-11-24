import type { ReservationLine, ReserveResult, StockBalance, StockShortage } from "../contracts";

export type ReservationRow = { id: string; orderId: string; variantId: string; quantity: number; status: "active" | "consumed" | "released" };

/** Operaciones dentro de la transacción del llamador (ventas). */
export interface ReservationTx {
  lockBalance(variantId: string): Promise<StockBalance | null>;
  /** Cambia físico/reservado de forma condicional (nunca negativo ni físico < reservado). Null si no se cumple. */
  applyDeltas(variantId: string, deltaOnHand: number, deltaReserved: number): Promise<StockBalance | null>;
  activeReservations(orderId: string): Promise<ReservationRow[]>;
  insertReservation(input: { orderId: string; variantId: string; quantity: number }): Promise<void>;
  closeReservation(id: string, status: "consumed" | "released"): Promise<void>;
  insertMovement(input: {
    variantId: string;
    deltaOnHand: number;
    deltaReserved: number;
    onHandAfter: number;
    reservedAfter: number;
    reason: "reservation" | "release" | "consumption" | "return_inspected";
    note: string | null;
    orderId: string;
    operationKey: string;
    actorId: string;
  }): Promise<void>;
}

/** Une cantidades por variante y ordena por id: orden de bloqueo consistente entre transacciones. */
export function normalizeLines(lines: readonly ReservationLine[]): ReservationLine[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new RangeError("Cantidad inválida");
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...totals.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([variantId, quantity]) => ({ variantId, quantity }));
}

function unexpected(): never {
  throw new Error("El balance cambió dentro de la transacción bloqueada.");
}

/**
 * Reserva todas las líneas o ninguna: primero bloquea y comprueba cada balance;
 * si falta alguna unidad no modifica nada y devuelve los faltantes.
 */
export async function reserveForOrder(tx: ReservationTx, input: { orderId: string; lines: readonly ReservationLine[]; actorId: string }): Promise<ReserveResult> {
  const lines = normalizeLines(input.lines);
  const shortages: StockShortage[] = [];
  for (const line of lines) {
    const balance = await tx.lockBalance(line.variantId);
    const available = balance ? balance.available : 0;
    if (available < line.quantity) shortages.push({ variantId: line.variantId, requested: line.quantity, available });
  }
  if (shortages.length > 0) return { ok: false, shortages };

  for (const line of lines) {
    const updated = (await tx.applyDeltas(line.variantId, 0, line.quantity)) ?? unexpected();
    await tx.insertReservation({ orderId: input.orderId, variantId: line.variantId, quantity: line.quantity });
    await tx.insertMovement({
      variantId: line.variantId,
      deltaOnHand: 0,
      deltaReserved: line.quantity,
      onHandAfter: updated.onHand,
      reservedAfter: updated.reserved,
      reason: "reservation",
      note: null,
      orderId: input.orderId,
      operationKey: `reservation:${input.orderId}:${line.variantId}`,
      actorId: input.actorId,
    });
  }
  return { ok: true };
}

/**
 * Cierra las reservas activas del pedido: `release` devuelve unidades al disponible (cancelación);
 * `consume` las descuenta del físico (despacho/entrega). Cada reserva se cierra una sola vez.
 */
export async function closeOrderReservations(tx: ReservationTx, input: { orderId: string; mode: "release" | "consume"; actorId: string }): Promise<number> {
  const reservations = (await tx.activeReservations(input.orderId)).sort((a, b) => (a.variantId < b.variantId ? -1 : 1));
  for (const r of reservations) {
    await tx.lockBalance(r.variantId);
    const deltaOnHand = input.mode === "consume" ? -r.quantity : 0;
    const updated = (await tx.applyDeltas(r.variantId, deltaOnHand, -r.quantity)) ?? unexpected();
    await tx.closeReservation(r.id, input.mode === "consume" ? "consumed" : "released");
    await tx.insertMovement({
      variantId: r.variantId,
      deltaOnHand,
      deltaReserved: -r.quantity,
      onHandAfter: updated.onHand,
      reservedAfter: updated.reserved,
      reason: input.mode === "consume" ? "consumption" : "release",
      note: null,
      orderId: input.orderId,
      operationKey: `${input.mode}:${input.orderId}:${r.variantId}`,
      actorId: input.actorId,
    });
  }
  return reservations.length;
}

/** Reingreso de prendas devueltas e inspeccionadas como aptas. Clave única por recepción y variante. */
export async function restockReturnedUnits(
  tx: ReservationTx,
  input: { orderId: string; variantId: string; quantity: number; operationKey: string; actorId: string; note: string | null },
): Promise<void> {
  const balance = await tx.lockBalance(input.variantId);
  if (!balance) throw new Error("La variante no tiene stock registrado.");
  const updated = (await tx.applyDeltas(input.variantId, input.quantity, 0)) ?? unexpected();
  await tx.insertMovement({
    variantId: input.variantId,
    deltaOnHand: input.quantity,
    deltaReserved: 0,
    onHandAfter: updated.onHand,
    reservedAfter: updated.reserved,
    reason: "return_inspected",
    note: input.note,
    orderId: input.orderId,
    operationKey: input.operationKey,
    actorId: input.actorId,
  });
}
