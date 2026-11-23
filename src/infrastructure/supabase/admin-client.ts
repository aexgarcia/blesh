import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthEnv } from "../config/env";

/**
 * Cliente con clave secreta (Auth admin y Storage). Solo servidor y scripts; nunca persiste sesión.
 * Lo comparten los adaptadores de identity y media.
 */
export function createSupabaseAdminClient(env: AuthEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
