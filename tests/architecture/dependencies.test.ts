/**
 * Reglas de dependencias de docs/desarrollo.md, comprobadas sobre imports reales
 * (alias y relativos). Complementa a no-restricted-imports de ESLint.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");

type SourceFile = { rel: string; content: string; imports: string[] };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

/** Devuelve la ruta relativa a src/ de un import interno, o el especificador si es paquete. */
function resolveImport(fromRel: string, spec: string): string {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  }
  return `pkg:${spec}`;
}

const files: SourceFile[] = walk(SRC).map((full) => {
  const rel = path.relative(SRC, full).split(path.sep).join("/");
  const content = readFileSync(full, "utf8");
  const imports = [...content.matchAll(IMPORT_RE)].map((m) => resolveImport(rel, m[1] ?? m[2] ?? m[3]));
  return { rel, content, imports };
});

const moduleOf = (rel: string) => /^modules\/([^/]+)\//.exec(rel)?.[1];
const isPublicEntry = (rel: string) => /^modules\/[^/]+\/(contracts|server)(\.tsx?)?$/.test(rel);

describe("arquitectura", () => {
  it("las pruebas unitarias viven fuera de src y reflejan sus carpetas", () => {
    function testFiles(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? testFiles(full) : /\.(test|spec)\.tsx?$/.test(name) ? [full] : [];
      });
    }
    expect(testFiles(SRC).map((file) => path.relative(SRC, file))).toEqual([]);
    const unitRoot = path.join(ROOT, "tests/unit");
    const tests = testFiles(unitRoot);
    expect(tests.length).toBeGreaterThan(0);
    const violations = tests.filter((file) => {
      const relative = path.relative(unitRoot, file);
      return !statSync(path.join(SRC, path.dirname(relative)), { throwIfNoEntry: false })?.isDirectory();
    });
    expect(violations.map((file) => path.relative(unitRoot, file))).toEqual([]);
  });

  it("encuentra archivos fuente", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("entre módulos solo se importa contracts o server", () => {
    const violations = files.flatMap((file) => {
      const from = moduleOf(file.rel);
      if (!from) return [];
      return file.imports
        .filter((target) => {
          const to = moduleOf(target);
          // Excepción documentada (modelo-de-datos.md): FKs de integridad entre esquemas Drizzle.
          // Solo schema.ts → schema.ts; ningún otro código lee tablas de otro módulo.
          const schemaFk = /\/infrastructure\/schema\.ts$/.test(file.rel) && /\/infrastructure\/schema$/.test(target);
          return to && to !== from && !isPublicEntry(target) && !schemaFk;
        })
        .map((target) => `${file.rel} → ${target}`);
    });
    expect(violations).toEqual([]);
  });

  it("app solo usa fachadas, contratos o presentation de módulos y no la base de datos", () => {
    const violations = files
      .filter((file) => file.rel.startsWith("app/"))
      .flatMap((file) =>
        file.imports
          .filter(
            (t) =>
              /^modules\/[^/]+\/(domain|application|infrastructure)\//.test(t) ||
              t.startsWith("infrastructure/database"),
          )
          .map((t) => `${file.rel} → ${t}`),
      );
    expect(violations).toEqual([]);
  });

  it("dominio no depende de framework, ORM ni infraestructura", () => {
    const forbidden = /^(pkg:(react|next|next\/.*|drizzle-orm.*|postgres|server-only)|infrastructure\/|app\/|modules\/)/;
    const violations = files
      .filter((file) => /^modules\/[^/]+\/domain\/|^shared\/domain\//.test(file.rel))
      .flatMap((file) =>
        file.imports
          .filter((t) => forbidden.test(t) && moduleOf(t) !== moduleOf(file.rel))
          .map((t) => `${file.rel} → ${t}`),
      );
    expect(violations).toEqual([]);
  });

  it("shared no conoce módulos, rutas ni composición", () => {
    const violations = files
      .filter((file) => file.rel.startsWith("shared/"))
      .flatMap((file) =>
        file.imports.filter((t) => /^(modules|app|composition)\//.test(t)).map((t) => `${file.rel} → ${t}`),
      );
    expect(violations).toEqual([]);
  });

  it("Client Components no importan código de servidor", () => {
    const violations = files
      .filter((file) => /^\s*["']use client["']/.test(file.content))
      .flatMap((file) =>
        file.imports
          .filter(
            (t) =>
              t === "pkg:server-only" ||
              t.startsWith("infrastructure/") ||
              /^modules\/[^/]+\/(server|infrastructure|application)/.test(t),
          )
          .map((t) => `${file.rel} → ${t}`),
      );
    expect(violations).toEqual([]);
  });

  it("los módulos de servidor declaran server-only", () => {
    const missing = files
      .filter((f) => /^modules\/[^/]+\/server\.ts$/.test(f.rel) || /^infrastructure\/(database\/client|config\/server)\.ts$/.test(f.rel))
      .filter((f) => !/^import\s+["']server-only["'];/m.test(f.content))
      .map((f) => f.rel);
    expect(missing).toEqual([]);
  });

  it("las instancias Drizzle se crean solo con la fábrica (casing snake_case)", () => {
    const offenders = files
      .filter((f) => f.rel !== "infrastructure/database/drizzle.ts")
      .filter((f) => /import\s*\{[^}]*\bdrizzle\b[^}]*\}\s*from\s*["']drizzle-orm\/postgres-js["']/.test(f.content))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });

  it("no hay ciclos entre módulos", () => {
    const graph = new Map<string, Set<string>>();
    for (const file of files) {
      const from = moduleOf(file.rel);
      if (!from) continue;
      for (const target of file.imports) {
        const to = moduleOf(target);
        if (to && to !== from) {
          if (!graph.has(from)) graph.set(from, new Set());
          graph.get(from)!.add(to);
        }
      }
    }
    const cycles: string[] = [];
    const visit = (node: string, stack: string[]) => {
      if (stack.includes(node)) {
        cycles.push([...stack.slice(stack.indexOf(node)), node].join(" → "));
        return;
      }
      for (const next of graph.get(node) ?? []) visit(next, [...stack, node]);
    };
    for (const node of graph.keys()) visit(node, []);
    expect(cycles).toEqual([]);
  });
});
