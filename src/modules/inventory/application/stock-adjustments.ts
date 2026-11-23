import type { AdjustmentReason, InventoryErrorCode, StockBalance, StockMovementView } from "../contracts";
import { checkResultingBalance, validateAdjustment } from "../domain/stock";

export type MovementInput = {
  variantId: string;
  deltaOnHand: number;
  reason: string;
  note: string | null;
  operationKey: string;
  actorId: string;
};

export interface InventoryTx {
  /** Bloquea el balance (FOR UPDATE). */
  lockBalance(variantId: string): Promise<StockBalance | null>;
  insertBalance(variantId: string, onHand: number): Promise<StockBalance>;
  /** Actualización condicional: on_hand + delta >= reserved y >= 0. Devuelve null si no se cumple. */
  applyDelta(variantId: string, delta: number): Promise<StockBalance | null>;
  findMovementByKey(operationKey: string): Promise<(StockMovementView & { operationKey: string }) | null>;
  insertMovement(input: MovementInput & { onHandAfter: number; reservedAfter: number }): Promise<StockMovementView>;
}

export interface InventoryStore {
  transaction<T>(fn: (tx: InventoryTx) => Promise<T>): Promise<T>;
  balances(variantIds: readonly string[]): Promise<StockBalance[]>;
  movements(variantIds: readonly string[], limit: number): Promise<StockMovementView[]>;
}

export type InventoryActor = { membershipId: string; role: "owner" | "operator" };

export type InventoryDeps = {
  store: InventoryStore;
  authorize: (actor: InventoryActor, capability: "inventory.adjust") => boolean;
};

export type InventoryResult<T> = { ok: true; value: T } | { ok: false; code: InventoryErrorCode; message: string; field?: string };

class InventoryFailure extends Error {
  constructor(readonly code: InventoryErrorCode, message: string, readonly field?: string) {
    super(message);
  }
}

async function run<T>(fn: () => Promise<T>): Promise<InventoryResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof InventoryFailure) return { ok: false, code: error.code, message: error.message, field: error.field };
    throw error;
  }
}

function authorize(deps: InventoryDeps, actor: InventoryActor) {
  if (!deps.authorize(actor, "inventory.adjust")) throw new InventoryFailure("FORBIDDEN", "No tienes permiso para ajustar stock.");
}

/**
 * Reintento idempotente: misma clave + mismos datos devuelve el resultado original;
 * misma clave con datos distintos es un conflicto (no se aplica dos veces).
 */
function replayOrConflict(existing: StockMovementView, input: { variantId: string; delta: number }): StockMovementView {
  if (existing.variantId !== input.variantId || existing.deltaOnHand !== input.delta) {
    throw new InventoryFailure("IDEMPOTENCY_CONFLICT", "Esta operación ya se registró con otros datos. Recarga la página.");
  }
  return existing;
}

/** Registra el stock inicial (conteo físico) de una variante. Cantidad 0 permitida. */
export function registerInitialStock(
  deps: InventoryDeps,
  actor: InventoryActor,
  input: { variantId: string; quantity: number; operationKey: string; note: string | null },
): Promise<InventoryResult<StockBalance>> {
  return run(() =>
    deps.store.transaction(async (tx) => {
      authorize(deps, actor);
      if (!Number.isSafeInteger(input.quantity) || input.quantity < 0 || input.quantity > 100_000) {
        throw new InventoryFailure("VALIDATION_ERROR", "Indica una cantidad entera de 0 o más.", "quantity");
      }
      const existing = await tx.lockBalance(input.variantId);
      if (existing) {
        const replay = await tx.findMovementByKey(input.operationKey);
        if (replay || input.quantity === 0) return existing;
        throw new InventoryFailure("ALREADY_REGISTERED", "El stock inicial ya está registrado; usa un ajuste.");
      }
      const balance = await tx.insertBalance(input.variantId, input.quantity);
      if (input.quantity > 0) {
        await tx.insertMovement({
          variantId: input.variantId,
          deltaOnHand: input.quantity,
          reason: "initial_count",
          note: input.note,
          operationKey: input.operationKey,
          actorId: actor.membershipId,
          onHandAfter: balance.onHand,
          reservedAfter: balance.reserved,
        });
      }
      return balance;
    }),
  );
}

/** Ajuste manual con motivo. Nunca deja el físico bajo 0 ni bajo lo reservado. */
export function adjustStock(
  deps: InventoryDeps,
  actor: InventoryActor,
  input: { variantId: string; delta: number; reason: AdjustmentReason; note: string | null; operationKey: string },
): Promise<InventoryResult<StockMovementView>> {
  return run(() =>
    deps.store.transaction(async (tx) => {
      authorize(deps, actor);
      const problem = validateAdjustment(input);
      if (problem) throw new InventoryFailure(problem.code, problem.message, problem.field);

      const previous = await tx.findMovementByKey(input.operationKey);
      if (previous) return replayOrConflict(previous, input);

      const balance = await tx.lockBalance(input.variantId);
      if (!balance) throw new InventoryFailure("NOT_REGISTERED", "Registra primero el stock inicial de esta talla.");
      const resulting = checkResultingBalance(balance.onHand, balance.reserved, input.delta);
      if (resulting) throw new InventoryFailure(resulting.code, resulting.message, resulting.field);

      const updated = await tx.applyDelta(input.variantId, input.delta);
      if (!updated) throw new InventoryFailure("BELOW_RESERVED", "El stock cambió mientras tanto. Recarga e inténtalo de nuevo.");
      return tx.insertMovement({
        variantId: input.variantId,
        deltaOnHand: input.delta,
        reason: input.reason,
        note: input.note?.trim() || null,
        operationKey: input.operationKey,
        actorId: actor.membershipId,
        onHandAfter: updated.onHand,
        reservedAfter: updated.reserved,
      });
    }),
  );
}
