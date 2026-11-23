import type { AdminRole, Capability } from "../contracts";

/** Capacidades exclusivas del propietario. El resto las comparten ambos roles. */
const OWNER_ONLY: ReadonlySet<Capability> = new Set<Capability>([
  "customers.archive",
  "orders.cancel_paid",
  "orders.exceptional_discount",
  "refunds.manage",
  "payment_terms.authorize",
  "access.manage",
]);

export function roleCan(role: AdminRole, capability: Capability): boolean {
  if (role === "owner") return true;
  return !OWNER_ONLY.has(capability);
}
