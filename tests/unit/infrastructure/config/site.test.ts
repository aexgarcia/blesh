import { describe, expect, it } from "vitest";

import { parseSiteConfig } from "@/infrastructure/config/site";

const production = { APP_ENV: "production", APP_URL: "https://blesh.example", ANALYTICS_ENABLED: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST12345" };

describe("aislamiento SEO/GA por entorno", () => {
  it("preview nunca indexa ni carga GA aunque copie APP_ENV de producción", () => {
    expect(parseSiteConfig({ ...production, VERCEL_ENV: "preview", ANALYTICS_QA: "true" })).toEqual({ origin: "https://blesh.example", indexable: false, measurementId: null });
    expect(parseSiteConfig({ ...production, APP_ENV: "development" }).measurementId).toBeNull();
  });
  it("producción requiere dominio HTTPS sin rutas ni credenciales", () => {
    expect(parseSiteConfig(production).indexable).toBe(true);
    for (const APP_URL of ["https://user:password@blesh.example", "https://blesh.example/?token=secret", "https://blesh.example/base", "https://localhost", "http://blesh.example", "ftp://blesh.example"]) {
      expect(() => parseSiteConfig({ ...production, APP_URL })).toThrow(/APP_URL/);
    }
  });
  it("GA ausente/inválido permanece apagado; QA solo localhost explícito", () => {
    expect(parseSiteConfig({ ...production, ANALYTICS_ENABLED: undefined }).measurementId).toBeNull();
    expect(parseSiteConfig({ ...production, NEXT_PUBLIC_GA_MEASUREMENT_ID: "" }).measurementId).toBeNull();
    expect(parseSiteConfig({ ...production, NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-<script>' }).measurementId).toBeNull();
    expect(parseSiteConfig({ APP_ENV: "development", APP_URL: "http://localhost:3000", ANALYTICS_QA: "true", NEXT_PUBLIC_GA_MEASUREMENT_ID: production.NEXT_PUBLIC_GA_MEASUREMENT_ID }).measurementId).toBe(production.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  });
});
