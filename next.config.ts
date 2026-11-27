import type { NextConfig } from "next";

import { parseSiteConfig } from "./src/infrastructure/config/site";
import { securityHeaders } from "./src/infrastructure/security/headers";

/** Imágenes de catálogo y de contenido (portada) desde los buckets públicos de Supabase Storage. */
function storageImagePatterns(): URL[] {
  const base = process.env.SUPABASE_URL;
  if (!base) return [];
  return [new URL("/storage/v1/object/public/catalog/**", base), new URL("/storage/v1/object/public/content/**", base)];
}

const isLocalDevelopment = (process.env.APP_ENV ?? "development") === "development" && !process.env.VERCEL_ENV;

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    serverActions: {
      // Imágenes de producto: máximo 5 MB + margen del multipart (ver módulo media).
      bodySizeLimit: "6mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Resolver notFound() de metadata antes de enviar el shell, también en URLs sin caché.
  // Evita un 200 inicial para productos/categorías inexistentes con PPR.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  async headers() {
    const { indexable } = parseSiteConfig(process.env);
    const noindex = { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" };
    return [
      { source: "/:path*", headers: [...securityHeaders(process.env), ...(!indexable ? [noindex] : [])] },
      { source: "/admin/:path*", headers: [noindex, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/solicitud", headers: [noindex, { key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  images: {
    remotePatterns: storageImagePatterns(),
    // Solo en desarrollo: Supabase local vive en 127.0.0.1. Nunca en preview/producción.
    dangerouslyAllowLocalIP: isLocalDevelopment,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
