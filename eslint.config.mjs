import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Límites entre módulos (docs/desarrollo.md). tests/architecture los comprueba también
// con imports relativos, ciclos y Client Components.
const crossModuleDeepImport = {
  group: ["@/modules/*/*", "!@/modules/*/contracts", "!@/modules/*/server"],
  message:
    "Entre módulos solo se importa otro/contracts u otro/server. Dentro del propio módulo usa rutas relativas.",
};

const frameworkAndIo = [
  { name: "react", message: "El dominio/aplicación no depende de React." },
  { name: "server-only", message: "El dominio/aplicación no depende del runtime de Next." },
];
const frameworkAndIoPatterns = [
  { group: ["next", "next/*"], message: "El dominio/aplicación no depende de Next.js." },
  { group: ["drizzle-orm", "drizzle-orm/*", "postgres"], message: "IO solo en infrastructure." },
  { group: ["@/infrastructure/*", "@/infrastructure/**"], message: "Usa puertos; la infraestructura los implementa." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [crossModuleDeepImport] }],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/domain/**", "@/modules/*/application/**", "@/modules/*/infrastructure/**"],
              message: "Las rutas usan la fachada (server/contracts) o presentation del módulo.",
            },
            {
              group: ["@/infrastructure/database", "@/infrastructure/database/**"],
              message: "Las rutas no acceden a la base de datos directamente; usa la fachada del módulo.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.ts", "src/shared/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: frameworkAndIo,
          patterns: [
            ...frameworkAndIoPatterns,
            { group: ["@/modules/**"], message: "El dominio no importa otros módulos." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: frameworkAndIo, patterns: [...frameworkAndIoPatterns, crossModuleDeepImport] },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/modules/**", "@/app/**", "@/composition/**"], message: "shared no conoce negocio." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Referencia visual estática, fuera del runtime.
    "prototipo/**",
  ]),
]);

export default eslintConfig;
