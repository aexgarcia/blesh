/** Tipos públicos del módulo customers; sin runtime de servidor. */

export type CustomerStatus = "active" | "archived";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Activo",
  archived: "Archivado",
};

/** Fila del directorio (solo personal autenticado; nunca en DTOs públicos). */
export type CustomerSummary = {
  id: string;
  name: string;
  /** Teléfono normalizado (E.164, p. ej. +51987654321). No es identidad verificada. */
  phone: string;
  email: string | null;
  status: CustomerStatus;
  updatedAt: string;
};

export type CustomerDetail = CustomerSummary & {
  version: number;
  createdAt: string;
  archivedAt: string | null;
};

/** Otra ficha con el mismo teléfono: se muestra para revisión humana, nunca se fusiona. */
export type CustomerMatch = { id: string; name: string; status: CustomerStatus };

/** Datos mínimos que otro módulo (ventas) puede copiar como snapshot al vincular. */
export type LinkableCustomer = { id: string; name: string; phone: string; email: string | null };

export type CustomerPage = { rows: CustomerSummary[]; total: number; page: number; pageSize: number };

export type CustomerErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "VERSION_CONFLICT"
  | "INVALID_STATE"
  | "PHONE_MATCH"
  | "IDEMPOTENCY_CONFLICT";

export const CUSTOMERS_PAGE_SIZE = 20;

/** Presentación legible del teléfono normalizado (+51 987 654 321). */
export { formatPhone } from "./domain/customer";
