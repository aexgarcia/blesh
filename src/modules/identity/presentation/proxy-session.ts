import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { parseAuthEnv } from "../../../infrastructure/config/env";
import { sessionCookieOptions } from "../infrastructure/cookie-options";

/** Rutas administrativas accesibles sin sesión. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/recuperar", "/admin/auth/"];

const isPublic = (pathname: string) => PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p));

/**
 * Proxy de /admin: refresca los tokens de Supabase (los Server Components no pueden escribir
 * cookies) y redirige con 307 si no hay sesión. Es una comprobación optimista: la membresía,
 * MFA y permisos se verifican en cada página, acción y Route Handler.
 */
export async function adminSessionProxy(request: NextRequest): Promise<NextResponse> {
  const env = parseAuthEnv(process.env);
  const { pathname } = request.nextUrl;
  if (!env) {
    return isPublic(pathname) ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login?motivo=no-configurado", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions(process.env.APP_URL),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims valida el JWT y refresca la sesión si expiró.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isPublic(pathname)) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin" && pathname !== "/admin/pedidos") login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
