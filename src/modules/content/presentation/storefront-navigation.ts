export const STOREFRONT_SETTINGS = [
  { slug: "general", label: "Configuración general", description: "WhatsApp, correo, redes sociales y datos del negocio." },
  { slug: "portada", label: "Portada", description: "Imagen principal, mensaje de bienvenida y botón de la tienda." },
  { slug: "colecciones", label: "Colecciones", description: "Tarjetas, imágenes, enlaces y orden de tus colecciones." },
  { slug: "pack", label: "Arma tu pack", description: "Productos incluidos, precios y visibilidad de la promoción." },
  { slug: "movimiento", label: "En movimiento", description: "Videos de prendas, portadas, enlaces y cuenta social." },
  { slug: "biblioteca", label: "Biblioteca", description: "Sube y consulta las imágenes y videos de la tienda." },
] as const;

export const storefrontSettingHref = (slug: string) => `/admin/tienda/${slug}`;
