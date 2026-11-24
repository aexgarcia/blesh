import type { AdminRole, MembershipStatus } from "../contracts";

export type Membership = {
  id: string;
  authSubject: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: MembershipStatus;
  invitedBy: string | null;
  invitedAt: Date;
  activatedAt: Date | null;
  disabledAt: Date | null;
  sessionsRevokedAt: Date | null;
  version: number;
};

export type NewMembership = Pick<Membership, "authSubject" | "email" | "displayName" | "role" | "status" | "invitedBy">;

export type MembershipPatch = Partial<
  Pick<Membership, "authSubject" | "role" | "status" | "activatedAt" | "disabledAt" | "sessionsRevokedAt">
>;

export type AuditEntry = {
  actorType: "admin" | "system";
  actorId: string | null;
  action: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  reason?: string | null;
};

/** Operaciones dentro de una transacción ya serializada para cambios de acceso. */
export interface MembershipTx {
  list(): Promise<Membership[]>;
  findById(id: string): Promise<Membership | null>;
  findByEmail(email: string): Promise<Membership | null>;
  findBySubject(subject: string): Promise<Membership | null>;
  insert(input: NewMembership): Promise<Membership>;
  /** Actualiza e incrementa `version`; falla si `expectedVersion` no coincide. */
  update(id: string, patch: MembershipPatch, expectedVersion?: number): Promise<Membership | null>;
  delete(id: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

export interface MembershipStore {
  /** Ejecuta `fn` bajo un bloqueo exclusivo de cambios de acceso (serializa concurrencia). */
  withAccessLock<T>(fn: (tx: MembershipTx) => Promise<T>): Promise<T>;
  findBySubject(subject: string): Promise<Membership | null>;
  list(): Promise<Membership[]>;
}

/** Operaciones administrativas del proveedor de identidad. */
export interface AuthAdminGateway {
  /** Crea el usuario y envía invitación de un solo uso. */
  inviteUser(email: string): Promise<{ subject: string }>;
  deleteUser(subject: string): Promise<void>;
  /** `null` si el proveedor no respondió (se muestra como desconocido). */
  hasVerifiedMfa(subject: string): Promise<boolean | null>;
  /** Elimina todos los factores MFA para un reenrolamiento controlado. */
  resetMfa(subject: string): Promise<void>;
}

export type Clock = { now: () => Date };

export type IdentityDeps = {
  store: MembershipStore;
  auth: AuthAdminGateway;
  clock: Clock;
};
