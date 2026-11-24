/** Tipos públicos del módulo identity; sin runtime de servidor. */

export type AdminRole = "owner" | "operator";
export type MembershipStatus = "invited" | "active" | "disabled";

/** Actor administrativo verificado por el servidor. Nunca proviene del cliente. */
export type AdminActor = {
  membershipId: string;
  authSubject: string;
  role: AdminRole;
  displayName: string;
  email: string;
};

/** Capacidades de la matriz owner/operator (docs/administracion.md). */
export type Capability =
  | "catalog.manage"
  | "inventory.adjust"
  | "orders.operate"
  | "orders.manual_create"
  | "payments.record"
  | "customers.manage"
  | "customers.archive"
  | "orders.cancel_paid"
  | "orders.exceptional_discount"
  | "refunds.manage"
  | "payment_terms.authorize"
  | "access.manage";

/** Fila del listado de Gestión de acceso. Sin secretos ni datos MFA. */
export type AdminUserSummary = {
  membershipId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: MembershipStatus;
  mfaEnrolled: boolean | null;
  invitedAt: string;
  activatedAt: string | null;
  sessionsRevokedAt: string | null;
  isCurrentUser: boolean;
  /** Versión para concurrencia optimista en cambios de rol/estado. */
  version: number;
};

export type IdentityErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "LAST_OWNER"
  | "SELF_ACTION"
  | "ALREADY_EXISTS"
  | "INVALID_STATE"
  | "OWNER_ALREADY_EXISTS"
  | "PROVIDER_ERROR";

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Propietario",
  operator: "Operador",
};

export const STATUS_LABELS: Record<MembershipStatus, string> = {
  invited: "Invitado",
  active: "Activo",
  disabled: "Desactivado",
};
