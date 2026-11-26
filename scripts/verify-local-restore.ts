/**
 * Ensayo NO destructivo de restauración de app/drizzle: copia blesh local a una base efímera,
 * compara tablas/recuentos/balances y elimina únicamente esa copia. No es un backup externo.
 * No cubre Auth ni archivos Storage. Credenciales de Docker son las ficticias del compose.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const source = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
if (process.env.APP_ENV !== "development" || process.env.VERCEL || !["localhost", "127.0.0.1"].includes(source.hostname) || !["54329", "55429"].includes(source.port) || source.pathname !== "/blesh") {
  throw new Error("Ensayo bloqueado: solo development, base blesh de docker-compose local en puerto 54329 o 55429");
}
const id = randomUUID().replaceAll("-", "");
const target = `blesh_restore_check_${id}`;
const dump = `/tmp/blesh_restore_${id}.dump`;
const started = Date.now();
const docker = (args: string[]) => execFileSync("docker", ["exec", "blesh-db", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const query = (database: string, sql: string) => docker(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "blesh_admin", "-d", database, "-At", "-c", sql]);
let created = false;
try {
  docker(["pg_dump", "-U", "blesh_admin", "-d", "blesh", "-Fc", "--schema=app", "--schema=drizzle", "-f", dump]);
  docker(["createdb", "-U", "blesh_admin", "-T", "template0", target]);
  created = true;
  docker(["pg_restore", "-U", "blesh_admin", "-d", target, "--no-owner", "--exit-on-error", dump]);
  const listSql = "select schemaname || '.' || tablename from pg_tables where schemaname in ('app','drizzle') order by 1";
  const tables = query("blesh", listSql).split("\n").filter(Boolean);
  if (tables.join("\n") !== query(target, listSql)) throw new Error("Restauración incompleta: tablas distintas");
  for (const table of tables) {
    if (!/^(app|drizzle)\.[a-z_]+$/.test(table)) throw new Error("Nombre de tabla inesperado");
    const sql = `select count(*) from ${table}`;
    if (query("blesh", sql) !== query(target, sql)) throw new Error(`Recuento distinto en ${table}; detener escrituras durante el ensayo`);
  }
  const invalid = query(target, "select count(*) from app.inventory_balances b where on_hand < 0 or reserved < 0 or reserved > on_hand or reserved <> coalesce((select sum(quantity) from app.stock_reservations r where r.variant_id=b.variant_id and r.status='active'),0)");
  if (invalid !== "0") throw new Error("La copia contiene balances/reservas que requieren conciliación");
  console.log(JSON.stringify({ verified: true, scope: "PostgreSQL app + drizzle local", tables: tables.length, balanceIssues: 0, seconds: Math.round((Date.now() - started) / 1000), authAndFiles: "no incluidos" }));
} finally {
  // Verificación explícita: jamás eliminar una base que no sea esta copia efímera única.
  if (!/^blesh_restore_check_[a-f0-9]{32}$/.test(target) || target === "blesh" || target === "blesh_test") throw new Error("Destino de limpieza inválido");
  if (created) docker(["dropdb", "-U", "blesh_admin", target]);
  if (/^\/tmp\/blesh_restore_[a-f0-9]{32}\.dump$/.test(dump)) docker(["rm", "-f", "--", dump]);
}
