/** Dependencias de identity para scripts de operación (fuera del runtime de Next). */
import { loadEnvConfig } from "@next/env";
import { createDrizzle } from "../../src/infrastructure/database/drizzle";
import postgres from "postgres";

import { parseAuthEnv, parseServerEnv } from "../../src/infrastructure/config/env";
import type { IdentityDeps } from "../../src/modules/identity/application/ports";
import { createMembershipStore } from "../../src/modules/identity/infrastructure/membership-store";
import {
  createSupabaseAdminClient,
  createSupabaseAuthAdminGateway,
} from "../../src/modules/identity/infrastructure/supabase-admin";

export function createScriptIdentityDeps(): { deps: IdentityDeps; close: () => Promise<void> } {
  loadEnvConfig(process.cwd());
  const env = parseServerEnv(process.env);
  const auth = parseAuthEnv(process.env);
  if (!auth) throw new Error("Falta configuración de Supabase (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY).");
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: env.DATABASE_PREPARE });
  return {
    deps: {
      store: createMembershipStore(createDrizzle(sql)),
      auth: createSupabaseAuthAdminGateway(createSupabaseAdminClient(auth)),
      clock: { now: () => new Date() },
    },
    close: () => sql.end(),
  };
}

/** Lee `--clave valor` de los argumentos. */
export function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
