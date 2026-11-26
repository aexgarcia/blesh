import { describe, expect, it } from "vitest";

import { securityHeaders } from "@/infrastructure/security/headers";

describe("cabeceras de seguridad", () => {
  it("producción no habilita eval, websocket local ni orígenes comodín de scripts", () => {
    const headers = securityHeaders({ APP_ENV: "production", NODE_ENV: "production", APP_URL: "https://blesh.example", SUPABASE_URL: "https://storage.example" });
    const policy = headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("https://storage.example");
    expect(policy).not.toMatch(/unsafe-eval|localhost|127\.0\.0\.1/);
    expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
  });
  it("no fuerza HTTPS ni rompe HMR de desarrollo local", () => {
    const headers = securityHeaders({ APP_ENV: "development", NODE_ENV: "development" });
    const policy = headers[0].value;
    expect(policy).toContain("unsafe-eval");
    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(headers.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
  });
});
