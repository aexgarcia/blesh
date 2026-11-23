import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Mismas reglas de carga de .env que Next.js (.env.local, .env.development, ...).
loadEnvConfig(process.cwd());

// `generate` no necesita conexión; `migrate`/`studio` sí y usan la credencial de migración.
const url = process.env.MIGRATION_DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema/index.ts",
  out: "./db/migrations",
  casing: "snake_case",
  schemaFilter: ["app"],
  strict: true,
  verbose: true,
  migrations: {
    // Esquema de control separado: el migrador lo crea antes de aplicar 0000 (que crea "app").
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  ...(url ? { dbCredentials: { url } } : {}),
});
