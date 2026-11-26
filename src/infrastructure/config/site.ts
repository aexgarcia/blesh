/** Configuración pública de SEO/analítica, sin credenciales ni conexión a BD. */
export type SiteConfig = { origin: string; indexable: boolean; measurementId: string | null };

export function parseSiteConfig(source: Record<string, string | undefined>): SiteConfig {
  let url: URL;
  try {
    url = new URL(source.APP_URL ?? "http://localhost:3000");
  } catch {
    throw new Error("Configuración inválida: APP_URL debe ser una URL pública absoluta");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Configuración inválida: APP_URL debe contener solo el origen, sin credenciales, ruta ni parámetros");
  }
  // VERCEL_ENV manda sobre una APP_ENV copiada por error a un preview.
  const indexable = source.APP_ENV === "production" && (!source.VERCEL_ENV || source.VERCEL_ENV === "production");
  if (indexable && (url.protocol !== "https:" || /^(localhost|127\.|\[::1\])/.test(url.hostname))) {
    throw new Error("Configuración inválida: APP_URL requiere un dominio HTTPS público en producción");
  }
  const id = source.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const localQa = source.ANALYTICS_QA === "true" && source.APP_ENV === "development" && !source.VERCEL_ENV && /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  const enabled = (indexable && source.ANALYTICS_ENABLED === "true") || localQa;
  return { origin: url.origin, indexable, measurementId: enabled && id && /^G-[A-Z0-9]{5,20}$/.test(id) ? id : null };
}
