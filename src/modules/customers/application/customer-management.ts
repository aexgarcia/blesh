import type { CustomerDetail, CustomerErrorCode, CustomerMatch, CustomerStatus, LinkableCustomer } from "../contracts";
import { parseCustomerFields, parseReason, type FieldProblem } from "../domain/customer";

export type CustomerRow = {
  id: string;
  name: string;
  phoneNormalized: string;
  email: string | null;
  status: CustomerStatus;
  version: number;
  creationKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type CustomerPatch = Partial<Pick<CustomerRow, "name" | "phoneNormalized" | "email" | "status" | "archivedAt">>;

/** Operaciones dentro de una transacción (la ficha editada queda bloqueada con FOR UPDATE). */
export interface CustomerTx {
  lock(id: string): Promise<CustomerRow | null>;
  /** Serializa envíos con la misma clave de alta (bloqueo consultivo de la transacción). */
  lockCreationKey(creationKey: string): Promise<void>;
  findByCreationKey(creationKey: string): Promise<CustomerRow | null>;
  insert(input: { name: string; phoneNormalized: string; email: string | null; creationKey: string; actorId: string }): Promise<CustomerRow>;
  /** Incrementa la versión; devuelve null si `expectedVersion` ya no coincide. */
  update(id: string, patch: CustomerPatch, actorId: string, expectedVersion: number): Promise<CustomerRow | null>;
  phoneMatches(phoneNormalized: string, excludeId?: string): Promise<CustomerMatch[]>;
  audit(entry: { actorId: string; action: string; customerId: string; changes?: Record<string, unknown>; reason?: string | null }): Promise<void>;
}

export interface CustomerStore {
  transaction<T>(fn: (tx: CustomerTx) => Promise<T>): Promise<T>;
}

export type CustomerActor = { membershipId: string; role: "owner" | "operator" };
export type CustomerCapability = "customers.manage" | "customers.archive";

export type CustomerDeps = {
  store: CustomerStore;
  authorize: (actor: CustomerActor, capability: CustomerCapability) => boolean;
};

export type CustomerResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CustomerErrorCode; message: string; field?: string; matches?: CustomerMatch[] };

export class CustomerFailure extends Error {
  constructor(
    readonly code: CustomerErrorCode,
    message: string,
    readonly field?: string,
    readonly matches?: CustomerMatch[],
  ) {
    super(message);
    this.name = "CustomerFailure";
  }
}

async function run<T>(fn: () => Promise<T>): Promise<CustomerResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof CustomerFailure) return { ok: false, code: error.code, message: error.message, field: error.field, matches: error.matches };
    throw error;
  }
}

function invalid(problem: FieldProblem): never {
  throw new CustomerFailure("VALIDATION_ERROR", problem.message, problem.field);
}

function authorize(authorizeFn: CustomerDeps["authorize"], actor: CustomerActor, capability: CustomerCapability) {
  if (!authorizeFn(actor, capability)) {
    throw new CustomerFailure(
      "FORBIDDEN",
      capability === "customers.archive" ? "Solo el propietario puede archivar o reactivar clientes." : "No tienes permiso para gestionar clientes.",
    );
  }
}

/** Coincidencias por teléfono: se informan y exigen confirmación explícita; nunca se fusiona. */
function phoneMatchFailure(matches: CustomerMatch[]): CustomerFailure {
  const names = matches.map((m) => m.name).join(", ");
  return new CustomerFailure(
    "PHONE_MATCH",
    `Ya hay ${matches.length === 1 ? "una ficha" : `${matches.length} fichas`} con este teléfono (${names}). Revisa si es la misma persona; si es otra, confirma para continuar.`,
    "phone",
    matches,
  );
}

export function toCustomerDetail(row: CustomerRow): CustomerDetail {
  return {
    id: row.id,
    name: row.name,
    phone: row.phoneNormalized,
    email: row.email,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

export type CreateCustomerInput = {
  name: string;
  phone: string;
  email?: string | null;
  /** UUID generado al abrir el formulario: un reintento no crea dos fichas. */
  creationKey: string;
  /** El operador revisó las fichas con el mismo teléfono y confirma que es otra persona. */
  confirmSharedPhone: boolean;
};

/**
 * Alta dentro de una transacción ya abierta. Ventas la usará al confirmar un pedido
 * para crear ficha, vincular y confirmar en la misma transacción.
 */
export async function createCustomerInTx(
  tx: CustomerTx,
  authorizeFn: CustomerDeps["authorize"],
  actor: CustomerActor,
  input: CreateCustomerInput,
): Promise<CustomerDetail> {
  authorize(authorizeFn, actor, "customers.manage");
  const parsed = parseCustomerFields(input);
  if (!parsed.ok) invalid(parsed.problem);
  const fields = parsed.value;

  await tx.lockCreationKey(input.creationKey);
  const previous = await tx.findByCreationKey(input.creationKey);
  if (previous) {
    if (previous.name !== fields.name || previous.phoneNormalized !== fields.phone) {
      throw new CustomerFailure("IDEMPOTENCY_CONFLICT", "Este formulario ya creó una ficha con otros datos. Recarga la página.");
    }
    return toCustomerDetail(previous);
  }

  const matches = await tx.phoneMatches(fields.phone);
  if (matches.length > 0 && !input.confirmSharedPhone) throw phoneMatchFailure(matches);

  const row = await tx.insert({ name: fields.name, phoneNormalized: fields.phone, email: fields.email, creationKey: input.creationKey, actorId: actor.membershipId });
  // Auditoría sin teléfono ni correo: solo qué campos se informaron.
  await tx.audit({
    actorId: actor.membershipId,
    action: "customer.created",
    customerId: row.id,
    changes: { fields: ["name", "phone", ...(fields.email ? ["email"] : [])], sharedPhone: matches.length > 0 },
  });
  return toCustomerDetail(row);
}

export function createCustomer(deps: CustomerDeps, actor: CustomerActor, input: CreateCustomerInput): Promise<CustomerResult<CustomerDetail>> {
  return run(() => deps.store.transaction((tx) => createCustomerInTx(tx, deps.authorize, actor, input)));
}

async function lockForChange(tx: CustomerTx, id: string, expectedVersion: number): Promise<CustomerRow> {
  const row = await tx.lock(id);
  if (!row) throw new CustomerFailure("NOT_FOUND", "La ficha no existe.");
  if (row.version !== expectedVersion) {
    throw new CustomerFailure("VERSION_CONFLICT", "Otra persona modificó esta ficha. Recarga la página para ver los cambios.");
  }
  return row;
}

async function saveOrConflict(tx: CustomerTx, id: string, patch: CustomerPatch, actorId: string, expectedVersion: number): Promise<CustomerRow> {
  const updated = await tx.update(id, patch, actorId, expectedVersion);
  if (!updated) throw new CustomerFailure("VERSION_CONFLICT", "Otra persona modificó esta ficha. Recarga la página para ver los cambios.");
  return updated;
}

/**
 * Edita el contacto actual. No toca snapshots de pedidos: ventas guarda su propia copia.
 */
export function updateCustomer(
  deps: CustomerDeps,
  actor: CustomerActor,
  input: { id: string; expectedVersion: number; name: string; phone: string; email?: string | null; confirmSharedPhone: boolean },
): Promise<CustomerResult<CustomerDetail>> {
  return run(() =>
    deps.store.transaction(async (tx) => {
      authorize(deps.authorize, actor, "customers.manage");
      const parsed = parseCustomerFields(input);
      if (!parsed.ok) invalid(parsed.problem);
      const fields = parsed.value;

      const row = await lockForChange(tx, input.id, input.expectedVersion);
      if (row.status === "archived") throw new CustomerFailure("INVALID_STATE", "La ficha está archivada. El propietario debe reactivarla para editarla.");

      const changed = [
        row.name !== fields.name ? "name" : null,
        row.phoneNormalized !== fields.phone ? "phone" : null,
        row.email !== fields.email ? "email" : null,
      ].filter((f): f is string => f !== null);
      if (changed.length === 0) return toCustomerDetail(row);

      if (changed.includes("phone") && !input.confirmSharedPhone) {
        const matches = await tx.phoneMatches(fields.phone, row.id);
        if (matches.length > 0) throw phoneMatchFailure(matches);
      }

      const updated = await saveOrConflict(tx, row.id, { name: fields.name, phoneNormalized: fields.phone, email: fields.email }, actor.membershipId, input.expectedVersion);
      await tx.audit({ actorId: actor.membershipId, action: "customer.updated", customerId: row.id, changes: { fields: changed } });
      return toCustomerDetail(updated);
    }),
  );
}

/** Archivar: solo propietario, con motivo. Conserva pedidos e historia; no habilita marketing. */
export function archiveCustomer(
  deps: CustomerDeps,
  actor: CustomerActor,
  input: { id: string; expectedVersion: number; reason: string },
): Promise<CustomerResult<CustomerDetail>> {
  return run(() =>
    deps.store.transaction(async (tx) => {
      authorize(deps.authorize, actor, "customers.archive");
      const reason = parseReason(input.reason, true);
      if (!reason.ok) invalid(reason.problem);
      const row = await lockForChange(tx, input.id, input.expectedVersion);
      if (row.status === "archived") throw new CustomerFailure("INVALID_STATE", "La ficha ya está archivada.");
      const updated = await saveOrConflict(tx, row.id, { status: "archived", archivedAt: new Date() }, actor.membershipId, input.expectedVersion);
      await tx.audit({ actorId: actor.membershipId, action: "customer.archived", customerId: row.id, reason: reason.value });
      return toCustomerDetail(updated);
    }),
  );
}

export function reactivateCustomer(
  deps: CustomerDeps,
  actor: CustomerActor,
  input: { id: string; expectedVersion: number; reason?: string | null },
): Promise<CustomerResult<CustomerDetail>> {
  return run(() =>
    deps.store.transaction(async (tx) => {
      authorize(deps.authorize, actor, "customers.archive");
      const reason = parseReason(input.reason, false);
      if (!reason.ok) invalid(reason.problem);
      const row = await lockForChange(tx, input.id, input.expectedVersion);
      if (row.status === "active") throw new CustomerFailure("INVALID_STATE", "La ficha ya está activa.");
      const updated = await saveOrConflict(tx, row.id, { status: "active", archivedAt: null }, actor.membershipId, input.expectedVersion);
      await tx.audit({ actorId: actor.membershipId, action: "customer.reactivated", customerId: row.id, reason: reason.value });
      return toCustomerDetail(updated);
    }),
  );
}

/**
 * Para vincular un pedido (fase de ventas): la ficha debe existir y estar activa.
 * Devuelve los datos que ventas copia como snapshot; editar la ficha después no los cambia.
 */
export async function requireLinkableCustomerInTx(
  tx: CustomerTx,
  authorizeFn: CustomerDeps["authorize"],
  actor: CustomerActor,
  customerId: string,
): Promise<LinkableCustomer> {
  authorize(authorizeFn, actor, "customers.manage");
  const row = await tx.lock(customerId);
  if (!row) throw new CustomerFailure("NOT_FOUND", "La ficha no existe.");
  if (row.status !== "active") throw new CustomerFailure("INVALID_STATE", "La ficha está archivada: elige una activa o pide al propietario reactivarla.");
  return { id: row.id, name: row.name, phone: row.phoneNormalized, email: row.email };
}
