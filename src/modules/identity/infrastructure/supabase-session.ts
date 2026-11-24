import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { AuthEnv } from "../../../infrastructure/config/env";
import type { VerifiedSessionClaims } from "../domain/session";
import { sessionCookieOptions } from "./cookie-options";

/**
 * Cliente Supabase ligado a las cookies de la petición. En Server Components la escritura
 * de cookies no está permitida y se ignora (el proxy refresca la sesión).
 */
export async function createSupabaseSessionClient(env: AuthEnv): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions(process.env.APP_URL),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component: sin escritura de cookies.
        }
      },
    },
  });
}

type AmrEntry = { method?: string; timestamp?: number };

/**
 * Verifica el JWT de sesión (firma/expiración vía proveedor) y extrae los claims necesarios.
 * Devuelve `null` si no hay sesión válida.
 */
export async function readVerifiedClaims(client: SupabaseClient): Promise<VerifiedSessionClaims | null> {
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; aal?: string; amr?: AmrEntry[]; iat?: number };
  const timestamps = (claims.amr ?? []).map((entry) => entry.timestamp).filter((t): t is number => typeof t === "number");
  return {
    subject: claims.sub,
    assuranceLevel: claims.aal === "aal2" ? "aal2" : "aal1",
    // Primer factor de la sesión; se mantiene igual al refrescar el token.
    authenticatedAt: timestamps.length > 0 ? Math.min(...timestamps) : (claims.iat ?? 0),
  };
}
