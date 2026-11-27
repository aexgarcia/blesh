/** Destinos internos admitidos; evita enlaces externos, scripts y rutas administrativas. */
export function isHomeTarget(href: string): boolean {
  return /^(?:#(?:drop|productos|pack|movimiento)|\/productos|\/(?:categorias|productos)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(href);
}

export function homeTargetAvailable(href: string, categories: readonly { slug: string }[], products: readonly { slug: string; status: string }[]): boolean {
  if (!isHomeTarget(href)) return false;
  if (href.startsWith("/categorias/")) return categories.some((c) => `/categorias/${c.slug}` === href);
  if (href.startsWith("/productos/")) return products.some((p) => `/productos/${p.slug}` === href && p.status === "published");
  return true;
}
