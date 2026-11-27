/** CSP compatible con el shell prerenderizado. No se presenta como CSP estricta con nonce. */
export function securityHeaders(source: Record<string, string | undefined>) {
  const local = source.APP_ENV !== "production" && source.VERCEL_ENV === undefined;
  const devRuntime = source.NODE_ENV !== "production";
  let storageOrigin = "";
  try { storageOrigin = new URL(source.SUPABASE_URL ?? "").origin; } catch { /* Sin proveedor. */ }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devRuntime ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${storageOrigin} https://*.google-analytics.com`,
    `media-src 'self' ${storageOrigin}`,
    `connect-src 'self' ${storageOrigin} https://*.google-analytics.com https://www.googletagmanager.com${devRuntime && local ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(source.APP_ENV === "production" && source.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ];
  return [
    { key: "Content-Security-Policy", value: directives.map((d) => d.trim()).join("; ") },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    ...(source.APP_ENV === "production" && source.APP_URL?.startsWith("https://") ? [{ key: "Strict-Transport-Security", value: "max-age=15552000" }] : []),
  ];
}
