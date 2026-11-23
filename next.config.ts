import type { NextConfig } from "next";

/** Imágenes de catálogo servidas desde el bucket público del almacenamiento (Supabase Storage). */
function storageImagePatterns(): URL[] {
  const base = process.env.SUPABASE_URL;
  if (!base) return [];
  return [new URL("/storage/v1/object/public/catalog/**", base)];
}

const isLocalDevelopment = (process.env.APP_ENV ?? "development") === "development";

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
