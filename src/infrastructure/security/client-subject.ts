import { isIP } from "node:net";

/**
 * Identificador del cliente para límites de tasa. Solo se confía en `x-forwarded-for` cuando
 * el despliegue lo fija (Vercel) o cuando se declara un proxy de confianza con
 * `TRUST_PROXY_HEADERS=true` (el proxy debe sobrescribir la cabecera, no añadirla).
 * Sin confianza, todos comparten un cupo: estricto, pero un solo cliente puede agotarlo.
 */
export function rateLimitSubject(headers: Pick<Headers, "get">, trustedProxy: boolean): string {
  if (!trustedProxy) return "unknown";
  const value = headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip")?.trim();
  return value && isIP(value) ? value : "unknown";
}

export function trustsProxyHeaders(source: Record<string, string | undefined>): boolean {
  return source.VERCEL === "1" || source.TRUST_PROXY_HEADERS === "true";
}
