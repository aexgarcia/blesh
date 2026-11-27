/**
 * Contenido de la tienda tomado del prototipo (prototipo/index.html y producto.html).
 * Valores iniciales: portada, colecciones, pack y reels se pueden reemplazar desde Tienda.
 * El resto se edita aquí. Imágenes/videos viven en el bucket `content` (claves `key`).
 *
 * `confirmations`: datos del negocio que aún NO están confirmados. Mientras sean `false`, la
 * tienda muestra el texto alternativo (`fallback`) y oculta enlaces/contactos. Cambiar a
 * `true` solo cuando el negocio lo confirme por escrito.
 */

export const CONTENT_VERSION = "2026-11-23-prototipo";

export const CONFIRMATIONS = {
  /** Promesa «Envíos en 24 a 48 h». */
  shippingPromise: false,
  /** Políticas (cambios, envíos, privacidad, términos) revisadas y publicadas. */
  policies: false,
  /** Newsletter con almacenamiento y consentimiento reales. */
  newsletter: false,
};

/** Texto que depende de una confirmación: sin ella se usa `fallback` (o se omite si es null). */
export type Gated = { text: string; requires: keyof typeof CONFIRMATIONS; fallback: string | null };
export type Copy = string | Gated;
export type AssetRef = { key: string; alt: string };

export const RAW_CONTENT = {
  announcements: [
    "BLESH / DROP 00 — DOS FORMAS DE LLEVARLO",
    { text: "ENVÍOS EN 24 A 48 HORAS", requires: "shippingPromise", fallback: "RECOJO O ENVÍO: LO COORDINAMOS POR WHATSAPP" },
    "ARMA TU PACK · COMBINA TUS PRENDAS",
    "PRECIO DE LANZAMIENTO EN DROP 00",
  ] satisfies Copy[],
  hero: {
    image: { key: "hero/banner.webp", alt: "BLESH DROP 00 — longsleeve Archives" },
    // El prototipo decía «Pre-order»: la preventa está fuera de V1 (ADR-014).
    eyebrow: "Drop 00 · 4 nuevos items",
    title: "Nuevo lanzamiento.",
    cta: { label: "Ver colección", href: "#drop" },
    meta: ["300 GSM", "Double sleeve", "100% cotton"],
    metaRight: { text: "Envíos 24 a 48 h", requires: "shippingPromise", fallback: "Recojo o envío a coordinar" } satisfies Copy,
  },
  drop: {
    eyebrow: "Drop 00 · Precio lanzamiento",
    title: "Nuevos ingresos",
    productSlugs: ["longsleeve-archives", "longsleeve-flamas", "white-premium-boxy", "grey-premium-boxy", "zip-hoodie-vapor", "zip-hoodie-flying"],
  },
  collections: {
    eyebrow: "Elige tu línea",
    title: "Colecciones",
    items: [
      { title: "Manga larga", text: "DROP 00 · Dos diseños para llevar BLESH.", href: "/categorias/manga-larga", image: { key: "collections/manga-larga.webp", alt: "Manga larga BLESH" } },
      { title: "Básicos premium", text: "Heavy cotton · 300 GSM · Prelavado.", href: "/categorias/basicos", image: { key: "collections/basicos.webp", alt: "Básicos premium BLESH" } },
    ],
  },
  pack: { eyebrow: "Boxy Essential · Combina colores y tallas", title: "Arma tu pack", productSlug: "boxy-essential", categorySlug: "boxy-essential" },
  banner: {
    image: { key: "banner/basicos.webp", alt: "" },
    eyebrow: "La base de todos tus looks",
    title: "Básicos 300 GSM",
    cta: { label: "Explorar básicos", href: "/categorias/basicos" },
  },
  catalog: { eyebrow: "Explora Blesh", title: "Todas las prendas" },
  reels: {
    eyebrow: "Mira las prendas en video",
    title: "En movimiento",
    handle: "@blesh_pe",
    items: [
      { title: "ZIP HOODIE / VAPOR", productSlug: "zip-hoodie-vapor", video: "reels/vapor.mp4", poster: "reels/vapor.webp" },
      { title: "DROP 00 / ARCHIVES", productSlug: "longsleeve-archives", video: "reels/archives.mp4", poster: "reels/archives.webp" },
      { title: "DETALLES / 300 GSM", productSlug: "white-premium-boxy", video: "reels/detalles.mp4", poster: "reels/detalles.webp" },
    ],
  },
  trust: [
    { icon: "truck", title: { text: "Envíos en 24 a 48 h", requires: "shippingPromise", fallback: "Envío o recojo" }, text: { text: "Consulta las opciones para tu dirección al comprar.", requires: "shippingPromise", fallback: "Lo coordinamos contigo por WhatsApp al registrar tu solicitud." } },
    { icon: "ruler", title: "Tu talla", text: "Revisa la guía de medidas de cada prenda." },
    { icon: "card", title: "Medios de pago", text: "Los acordamos contigo por WhatsApp. Nada se cobra en la web." },
    { icon: "star", title: "Blesh community", text: { text: "Suscríbete para conocer los próximos drops.", requires: "newsletter", fallback: "Muy pronto: avisos de los próximos drops." } },
  ] satisfies { icon: "truck" | "ruler" | "card" | "star"; title: Copy; text: Copy }[],
  products: {
    "longsleeve-archives": {
      badge: "DROP 00",
      launchPrice: true,
      subtitle: "BLESH ARCHIVES — DOUBLE SLEEVE",
      details: ["100% algodón peinado", "Tejido 20/1", "Double Sleeve", "Serigrafía premium", "Alta fijación de color", "Resistente a los lavados", "Pestaña personalizada Blesh ★", "Boxy Fit", "Acabados premium"],
    },
    "longsleeve-flamas": {
      badge: "DROP 00",
      launchPrice: true,
      subtitle: "BLESH FLAMES — DOUBLE SLEEVE",
      details: ["100% algodón peinado", "Tejido 20/1", "Double Sleeve", "Serigrafía premium", "Trama de colores", "Alta fijación de color", "Resistente a los lavados", "Boxy Fit", "Acabados premium"],
    },
    "white-premium-boxy": {
      badge: "300 GSM",
      launchPrice: true,
      subtitle: "BLESH PREMIUM BASIC — 300 GSM",
      details: ["300 GSM Heavyweight", "100% algodón", "Extra suave al tacto", "Prelavado", "Acabado anti-pilling", "Estructura premium", "Boxy Fit", "Hecho para uso diario"],
    },
    "grey-premium-boxy": {
      badge: "300 GSM",
      launchPrice: true,
      subtitle: "BLESH PREMIUM BASIC — 300 GSM",
      details: ["300 GSM Heavyweight", "100% algodón", "Extra suave al tacto", "Prelavado", "Acabado anti-pilling", "Estructura premium", "Boxy Fit", "Hecho para uso diario"],
    },
    "zip-hoodie-vapor": {
      badge: "SALE",
      subtitle: "DOUBLE ZIP HOODIE — BLESH",
      details: ["Double zip", "French Terry 3 hilos suavizado · 450 GSM", "Bordado", "Estampado tacto cero", "Alto relieve", "Firma Blesh bordada en capucha", "Fit oversized / streetwear premium"],
    },
    "zip-hoodie-flying": {
      badge: "SALE",
      subtitle: "DOUBLE ZIP HOODIE — BLESH",
      details: ["Double zip", "French Terry 3 hilos suavizado · 450 GSM", "Bordado", "Estampado tacto cero", "Alto relieve", "Firma Blesh bordada en capucha", "Fit oversized / streetwear premium"],
    },
    "boxy-essential": {
      subtitle: "BOXY ESSENTIAL",
      details: ["100% algodón peinado 20/1: más suave al tacto y con acabado más limpio", "Cuello licrado: vuelve a su forma lavada tras lavada", "Corte boxy", "Tela fresca para el día a día"],
    },
  } as Record<string, { badge?: string; subtitle?: string; details?: string[]; launchPrice?: boolean }>,
  shippingNote: {
    title: { text: "Envíos en 24 a 48 h", requires: "shippingPromise", fallback: "Entrega y pago por WhatsApp" } satisfies Copy,
    text: { text: "Consulta las opciones para tu dirección al comprar.", requires: "shippingPromise", fallback: "Registra tu solicitud y coordinamos contigo recojo o envío (costo por acordar) y la forma de pago." } satisfies Copy,
  },
  productChips: [
    { text: "Envíos 24 a 48 h", requires: "shippingPromise", fallback: "Recojo o envío" },
    { text: "Cambios de talla", requires: "policies", fallback: "Pago por WhatsApp" },
  ] satisfies Copy[],
  policiesText: {
    shipping: { text: "Envíos: 24 a 48 horas. Consulta las opciones para tu dirección al finalizar la compra.", requires: "shippingPromise", fallback: "Envíos: costo y plazo se acuerdan por WhatsApp antes de confirmar tu pedido. También puedes recoger." } satisfies Copy,
    changes: { text: "Cambios y devoluciones: trae o envía la prenda. Después de revisarla, enviaremos el cambio. El envío del cambio no es gratuito.", requires: "policies", fallback: "Cambios y devoluciones: política en preparación. Escríbenos con tu referencia de pedido si necesitas ayuda." } satisfies Copy,
  },
  footer: {
    community: { title: "Blesh community", text: "Suscríbete para conocer los próximos drops antes que nadie." },
    shopLinks: [
      { label: "Manga larga", href: "/categorias/manga-larga" },
      { label: "Básicos 300 GSM", href: "/categorias/basicos" },
      { label: "Boxy essential", href: "/categorias/boxy-essential" },
      { label: "Zip hoodies", href: "/categorias/zip-hoodies" },
    ],
    policyLinks: [
      { label: "Cambios y devoluciones", href: "https://bleshperu.myshopify.com/policies/refund-policy", external: true },
      { label: "Envíos: 24 a 48 horas", href: "https://bleshperu.myshopify.com/policies/shipping-policy", external: true },
      { label: "Privacidad", href: "https://bleshperu.myshopify.com/policies/privacy-policy", external: true },
      { label: "Términos y condiciones", href: "/terminos-y-condiciones" },
    ],
    copyright: "blesh | ropa streetwear. Todos los derechos reservados.",
    location: "Lima, Perú",
  },
  /** Perfiles públicos de redes (visibles). */
  socials: {
    instagram: { label: "@blesh_pe", href: "https://www.instagram.com/blesh_pe/", external: true },
    tiktok: { label: "TikTok", href: "https://www.tiktok.com/@blesh_p", external: true },
  },
  nav: [
    { label: "Inicio", href: "/" },
    { label: "Productos", href: "/#productos" },
    { label: "Arma tu pack", href: "/#pack" },
    { label: "En movimiento", href: "/#movimiento" },
    { label: "Contacto", href: "#contacto" },
  ],
};

/** Recursos a importar desde el prototipo (fuente → clave en el bucket `content`). */
export const PROTOTYPE_CONTENT_ASSETS: { key: string; source: string; kind: "image" | "video" }[] = [
  { key: "hero/banner.webp", source: "https://cdn.shopify.com/s/files/1/0825/6189/2604/files/BANNER.png?v=1791335917&width=2200", kind: "image" },
  { key: "collections/manga-larga.webp", source: "https://cdn.shopify.com/s/files/1/0825/6189/2604/files/flamas2.jpg?v=1793660796&width=1400", kind: "image" },
  { key: "collections/basicos.webp", source: "https://cdn.shopify.com/s/files/1/0825/6189/2604/files/IMG_3167.heic?v=1791600655&width=1400", kind: "image" },
  { key: "banner/basicos.webp", source: "https://cdn.shopify.com/s/files/1/0825/6189/2604/files/blanco_1.jpg?v=1793660530&width=2000", kind: "image" },
  { key: "reels/vapor.mp4", source: "https://bleshperu.myshopify.com/cdn/shop/videos/c/vp/31c1aefe78754864a4bba9cecc615d7c/31c1aefe78754864a4bba9cecc615d7c.HD-1080p-7.2Mbps-97081153.mp4?v=0", kind: "video" },
  { key: "reels/vapor.webp", source: "https://bleshperu.myshopify.com/cdn/shop/files/preview_images/31c1aefe78754864a4bba9cecc615d7c.thumbnail.0000000000.jpg?v=1791691576&width=700", kind: "image" },
  { key: "reels/archives.mp4", source: "https://bleshperu.myshopify.com/cdn/shop/videos/c/vp/7803eb1ca570471e86db54e92a994fe4/7803eb1ca570471e86db54e92a994fe4.HD-720p-1.6Mbps-97082043.mp4?v=0", kind: "video" },
  { key: "reels/archives.webp", source: "https://bleshperu.myshopify.com/cdn/shop/files/preview_images/7803eb1ca570471e86db54e92a994fe4.thumbnail.0000000000.jpg?v=1791692904&width=700", kind: "image" },
  { key: "reels/detalles.mp4", source: "https://bleshperu.myshopify.com/cdn/shop/videos/c/vp/cad5ad4755224b35bf7a6f4a0c042cd6/cad5ad4755224b35bf7a6f4a0c042cd6.HD-1080p-7.2Mbps-97081514.mp4?v=0", kind: "video" },
  { key: "reels/detalles.webp", source: "https://bleshperu.myshopify.com/cdn/shop/files/preview_images/cad5ad4755224b35bf7a6f4a0c042cd6.thumbnail.0000000000.jpg?v=1791692128&width=700", kind: "image" },
];
