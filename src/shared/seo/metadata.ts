import type { Metadata } from "next";

export function pageMetadata(input: { origin: string; path: string; title: string; description: string; image?: { url: string; alt: string } | null }): Metadata {
  const url = new URL(input.path, input.origin).href;
  const images = input.image ? [{ url: input.image.url, alt: input.image.alt }] : [];
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "BLESH", locale: "es_PE", url, title: input.title, description: input.description, images },
    twitter: { card: input.image ? "summary_large_image" : "summary", title: input.title, description: input.description, images: images.map((i) => i.url) },
  };
}

/** El único parámetro canónico admitido en listados es la página real. */
export function listingPath(base: string, value: string | string[] | undefined): string {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(n) && n > 1 && n < 10_000 ? `${base}?pagina=${n}` : base;
}

/** JSON-LD no es JS ejecutable, pero su serialización tampoco debe cerrar el script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
