import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Ejecutar mediante `npm test` / `npm run test:integration` (scripts/vitest.mjs) para normalizar la ruta en Windows.

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lanza fuera de React Server Components; en pruebas es un no-op.
      "server-only": fileURLToPath(new URL("./tests/support/server-only-noop.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/architecture/**/*.test.ts", "tests/integration/migrations.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          // Requiere PostgreSQL local (npm run db:up) y Supabase local (npm run auth:up).
          name: "integration",
          include: ["tests/integration/**/*.int.test.ts"],
          globalSetup: ["tests/integration/setup/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 60_000,
        },
      },
    ],
  },
});
