/** Normaliza solo signos habituales; rechaza letras o contenido de enlaces. */
export function normalizeWhatsapp(value: string): string {
  return value.trim().replace(/^\+/, "").replace(/[\s()-]/g, "");
}

export function isSocialProfile(value: string, platform: "instagram" | "tiktok"): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      [platform + ".com", "www." + platform + ".com"].includes(url.hostname) &&
      url.pathname !== "/" && !url.search && !url.hash;
  } catch { return false; }
}
