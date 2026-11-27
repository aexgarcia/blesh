/**
 * Flujo de autenticación con Supabase Auth local real. Las invitaciones de estas pruebas NO
 * envían correo (el SMTP local es Gmail real): se genera el enlace con la API de administración.
 * Requiere `npm run auth:up` y las variables SUPABASE_* en .env.local.
 */
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { parseAuthEnv } from "@/infrastructure/config/env";
import * as access from "@/modules/identity/application/access-management";
import type { IdentityDeps } from "@/modules/identity/application/ports";
import type { AdminActor } from "@/modules/identity/contracts";
import { decideAdminSession } from "@/modules/identity/domain/session";
import { createMembershipStore } from "@/modules/identity/infrastructure/membership-store";
import { createSupabaseAdminClient, createSupabaseAuthAdminGateway } from "@/modules/identity/infrastructure/supabase-admin";
import { readVerifiedClaims } from "@/modules/identity/infrastructure/supabase-session";

import { openTestDb, resetTables } from "../support/test-db";
import { totp } from "../support/totp";

const env = parseAuthEnv(process.env);
if (!env) throw new Error("Faltan SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY (npm run auth:up).");

const { sql, db } = openTestDb();
const admin = createSupabaseAdminClient(env);
/** token_hash del enlace de invitación por correo (equivale al enlace que recibiría la persona). */
const inviteTokens = new Map<string, string>();
const auth: IdentityDeps["auth"] = {
  ...createSupabaseAuthAdminGateway(admin),
  async inviteUser(email) {
    const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });
    if (error || !data.user) throw error ?? new Error("invite");
    inviteTokens.set(email, data.properties.hashed_token);
    return { subject: data.user.id };
  },
};
const deps: IdentityDeps = { store: createMembershipStore(db), auth, clock: { now: () => new Date() } };
const createdUsers: string[] = [];
const PASSWORD = "Prueba-segura-12345";

/** Cliente "navegador" con su propia sesión en memoria. */
function browserClient(): SupabaseClient {
  return createClient(env!.SUPABASE_URL, env!.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function createAuthUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("sin usuario");
  createdUsers.push(data.user.id);
  return data.user.id;
}

async function decide(client: SupabaseClient, subject: string) {
  const claims = await readVerifiedClaims(client);
  if (!claims) return { kind: "anonymous" as const };
  return decideAdminSession(claims, await deps.store.findBySubject(subject));
}

async function enrollAndVerifyTotp(client: SupabaseClient) {
  const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `test-${randomUUID()}` });
  if (error || !data) throw error;
  const verified = await client.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (verified.error) throw verified.error;
  return { factorId: data.id, secret: data.totp.secret };
}

let owner: AdminActor;

beforeAll(async () => {
  const health = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY } }).catch(() => null);
  if (!health?.ok) throw new Error("Supabase local no responde: ejecuta `npm run auth:up`.");
});

beforeEach(async () => {
  await resetTables(["admin_memberships", "audit_events"]);
  // Propietario de prueba con membresía activa (el alta por invitación se prueba aparte).
  const subject = await createAuthUser(`owner-${randomUUID()}@blesh.test`);
  const [row] = await sql<{ id: string }[]>`
    insert into app.admin_memberships (auth_subject, email, display_name, role, status, activated_at)
    values (${subject}, ${`owner-${subject}@blesh.test`}, 'Owner', 'owner', 'active', now()) returning id`;
  owner = { membershipId: row.id, authSubject: subject, role: "owner", displayName: "Owner", email: "owner@blesh.test" };
});

afterAll(async () => {
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  await sql.end();
});

async function activeOperator() {
  const email = `op-${randomUUID()}@blesh.test`;
  const subject = await createAuthUser(email);
  const [row] = await sql<{ id: string; version: number }[]>`
    insert into app.admin_memberships (auth_subject, email, display_name, role, status, activated_at)
    values (${subject}, ${email}, 'Operador', 'operator', 'active', now()) returning id, version`;
  return { subject, email, membershipId: row.id };
}

describe("Supabase Auth local", () => {
  it("la contraseña sola no basta: exige MFA; tras TOTP la sesión es aal2 y válida", async () => {
    const op = await activeOperator();
    const client = browserClient();
    const login = await client.auth.signInWithPassword({ email: op.email, password: PASSWORD });
    expect(login.error).toBeNull();
    expect(await decide(client, op.subject)).toEqual({ kind: "needs_mfa" });

    await enrollAndVerifyTotp(client);
    expect(await deps.auth.hasVerifiedMfa(op.subject)).toBe(true);
    expect(await decide(client, op.subject)).toEqual({ kind: "allowed" });
  });

  it("un código TOTP incorrecto no eleva la sesión", async () => {
    const op = await activeOperator();
    const client = browserClient();
    await client.auth.signInWithPassword({ email: op.email, password: PASSWORD });
    const { data } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "wrong" });
    const result = await client.auth.mfa.challengeAndVerify({ factorId: data!.id, code: "000000" === totp(data!.totp.secret) ? "111111" : "000000" });
    expect(result.error).not.toBeNull();
    expect(await decide(client, op.subject)).toEqual({ kind: "needs_mfa" });
  });

  it("revocar sesiones invalida la sesión previa incluso tras refrescar el token", async () => {
    const op = await activeOperator();
    const client = browserClient();
    await client.auth.signInWithPassword({ email: op.email, password: PASSWORD });
    const { secret, factorId } = await enrollAndVerifyTotp(client);
    expect((await decide(client, op.subject)).kind).toBe("allowed");

    await new Promise((r) => setTimeout(r, 1100));
    expect((await access.revokeSessions(deps, owner, { membershipId: op.membershipId })).ok).toBe(true);
    expect((await decide(client, op.subject)).kind).toBe("revoked");

    // Un refresh emite un JWT nuevo, pero conserva el momento de autenticación original.
    const refreshed = await client.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect((await decide(client, op.subject)).kind).toBe("revoked");

    // Un inicio de sesión nuevo (contraseña + TOTP) vuelve a ser válido.
    await new Promise((r) => setTimeout(r, 1100));
    const fresh = browserClient();
    await fresh.auth.signInWithPassword({ email: op.email, password: PASSWORD });
    await fresh.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
    expect((await decide(fresh, op.subject)).kind).toBe("allowed");
  });

  it("desactivar bloquea al instante una sesión aal2 abierta", async () => {
    const op = await activeOperator();
    const client = browserClient();
    await client.auth.signInWithPassword({ email: op.email, password: PASSWORD });
    await enrollAndVerifyTotp(client);
    const [{ version }] = await sql<{ version: number }[]>`select version from app.admin_memberships where id = ${op.membershipId}`;
    expect((await access.deactivateAdmin(deps, owner, { membershipId: op.membershipId, expectedVersion: version })).ok).toBe(true);
    expect((await decide(client, op.subject)).kind).toBe("not_admin");
  });

  it("restablecer MFA elimina los factores del proveedor", async () => {
    const op = await activeOperator();
    const client = browserClient();
    await client.auth.signInWithPassword({ email: op.email, password: PASSWORD });
    await enrollAndVerifyTotp(client);
    const result = await access.resetAdminMfa(deps, owner, { membershipId: op.membershipId, reason: "Cambio de teléfono verificado" });
    expect(result.ok).toBe(true);
    expect(await deps.auth.hasVerifiedMfa(op.subject)).toBe(false);
  });

  it("sin registro público: signUp está deshabilitado", async () => {
    const { error } = await browserClient().auth.signUp({ email: `intruso-${randomUUID()}@blesh.test`, password: PASSWORD });
    expect(error).not.toBeNull();
  });

  it("invitación: crea usuario y un enlace de un solo uso", async () => {
    const email = `invitado-${randomUUID()}@blesh.test`;
    const invited = await access.inviteAdmin(deps, owner, { email, displayName: "Invitado", role: "operator" });
    expect(invited.ok).toBe(true);
    if (!invited.ok) return;
    createdUsers.push(invited.value.authSubject);
    const tokenHash = inviteTokens.get(email);
    expect(tokenHash).toBeTruthy();

    const client = browserClient();
    const verified = await client.auth.verifyOtp({ type: "invite", token_hash: tokenHash! });
    expect(verified.error).toBeNull();
    // Reutilizar el mismo enlace falla (un solo uso).
    const reused = await browserClient().auth.verifyOtp({ type: "invite", token_hash: tokenHash! });
    expect(reused.error).not.toBeNull();

    // Antes de completar MFA, un invitado no accede a la administración.
    expect((await decide(client, invited.value.authSubject)).kind).toBe("not_admin");
    const claims = await readVerifiedClaims(client);
    expect(decideAdminSession(claims!, await deps.store.findBySubject(invited.value.authSubject), { allowInvited: true }).kind).toBe("needs_mfa");
  });
});
