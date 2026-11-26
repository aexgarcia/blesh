import { createHash } from "node:crypto";

import { lt, sql } from "drizzle-orm";

import { rateLimitCounters } from "../database/schema/rate-limit";
import type { AnyDatabase } from "../database/types";

/**
 * Límite de tasa por ventana fija sobre PostgreSQL (compartido entre instancias serverless).
 * Sin `server-only` para poder probarlo con una conexión de pruebas; la aplicación lo usa
 * desde Server Actions.
 */

export type RateRule = { scope: string; limit: number; windowSeconds: number };

/** Huella del cliente: nunca se guarda la IP en claro. */
export function rateBucket(scope: string, subject: string): string {
  return `${scope}:${createHash("sha256").update(`${scope}\n${subject}`).digest("hex").slice(0, 32)}`;
}

/**
 * Suma un intento y devuelve si cabe en todas las reglas. Cada intento cuenta aunque se
 * rechace (un cliente insistente no recupera cupo antes de que venza la ventana).
 */
export async function consumeRateLimit(db: AnyDatabase, subject: string, rules: readonly RateRule[], now: Date = new Date()): Promise<boolean> {
  let allowed = true;
  for (const rule of rules) {
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const expiresAt = new Date(windowStart.getTime() + windowMs);
    const [row] = await db
      .insert(rateLimitCounters)
      .values({ bucket: rateBucket(rule.scope, subject), windowStart, hits: 1, expiresAt })
      .onConflictDoUpdate({ target: [rateLimitCounters.bucket, rateLimitCounters.windowStart], set: { hits: sql`${rateLimitCounters.hits} + 1` } })
      .returning({ hits: rateLimitCounters.hits });
    if (row.hits === 1) {
      // Primera visita de la ventana: limpieza oportunista de contadores vencidos.
      await db.delete(rateLimitCounters).where(lt(rateLimitCounters.expiresAt, new Date(now.getTime() - 60 * 60 * 1000)));
    }
    if (row.hits > rule.limit) allowed = false;
  }
  return allowed;
}
