import { describe, expect, it } from "vitest";

import { rateLimitSubject } from "@/infrastructure/security/client-subject";

describe("identidad de límites por plataforma", () => {
  it("no deja evadir cuotas por cabeceras arbitrarias fuera del proxy confiable", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5", "x-real-ip": "198.51.100.1" });
    expect(rateLimitSubject(headers, false)).toBe("unknown");
    expect(rateLimitSubject(headers, true)).toBe("203.0.113.5");
    expect(rateLimitSubject(new Headers({ "x-forwarded-for": "arbitrary-key" }), true)).toBe("unknown");
  });
});

describe("trustsProxyHeaders", () => {
  it("confía en Vercel o en un proxy declarado", async () => {
    const { trustsProxyHeaders } = await import("@/infrastructure/security/client-subject");
    expect(trustsProxyHeaders({ VERCEL: "1" })).toBe(true);
    expect(trustsProxyHeaders({ TRUST_PROXY_HEADERS: "true" })).toBe(true);
    expect(trustsProxyHeaders({})).toBe(false);
  });
});
