/** Cookies de sesión: HttpOnly, SameSite=Lax (los enlaces de correo deben llevar la sesión) y `secure` en https. */
export function sessionCookieOptions(appUrl: string | undefined) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appUrl?.startsWith("https://") ?? false,
    path: "/",
  };
}
