import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { getAuthEnv } from "@/infrastructure/config/server";

import { createSupabaseSessionClient } from "../infrastructure/supabase-session";

const LINK_TYPES = new Set(["invite", "recovery"] as const);
type LinkType = "invite" | "recovery";

/** GET /admin/auth/confirm: canjea el token de un solo uso del correo por una sesión. */
export async function handleEmailLinkConfirmation(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const fail = NextResponse.redirect(new URL("/admin/login?motivo=enlace-invalido", url));

  const env = getAuthEnv();
  if (!env || !tokenHash || !type || !LINK_TYPES.has(type as LinkType) || tokenHash.length > 200) return fail;

  const supabase = await createSupabaseSessionClient(env);
  // Una sesión previa en el navegador no debe mezclarse con la del enlace.
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.verifyOtp({ type: type as LinkType, token_hash: tokenHash });
  if (error) return fail;
  return NextResponse.redirect(new URL("/admin/nueva-contrasena", url));
}

const SIGNOUT_REASONS = new Set(["revocada", "sin-acceso", "salida"]);

/** GET /admin/auth/salir: cierra la sesión local (p. ej. tras revocación) y vuelve al login. */
export async function handleForcedSignOut(request: NextRequest): Promise<NextResponse> {
  const reason = request.nextUrl.searchParams.get("motivo") ?? "salida";
  const env = getAuthEnv();
  if (env) {
    const supabase = await createSupabaseSessionClient(env);
    await supabase.auth.signOut({ scope: "local" });
  }
  const target = new URL("/admin/login", request.nextUrl);
  target.searchParams.set("motivo", SIGNOUT_REASONS.has(reason) ? reason : "salida");
  return NextResponse.redirect(target);
}
