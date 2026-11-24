import "server-only";

import { getAuthEnv } from "@/infrastructure/config/server";
import { getDb } from "@/infrastructure/database/client";

import type { IdentityDeps } from "../application/ports";
import { createMembershipStore } from "./membership-store";
import { createSupabaseAdminClient, createSupabaseAuthAdminGateway } from "./supabase-admin";

/** Ensambla dependencias del módulo para el runtime de Next. `null` si Auth no está configurado. */
export function getIdentityDeps(): IdentityDeps | null {
  const env = getAuthEnv();
  if (!env) return null;
  return {
    store: createMembershipStore(getDb()),
    auth: createSupabaseAuthAdminGateway(createSupabaseAdminClient(env)),
    clock: { now: () => new Date() },
  };
}
