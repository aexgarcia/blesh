import type { StoreProduct } from "./storefront";

export function productStructuredData(product: StoreProduct, origin: string) {
  const url = `${origin}/productos/${product.slug}/${product.color.slug}`;
  const groupId = `${origin}/#product-${product.productId}`;
  const organization = { "@type": "Organization", "@id": `${origin}/#organization`, name: "BLESH", url: origin };
  const breadcrumb = [
    { name: "Inicio", item: `${origin}/` },
    ...(product.category ? [{ name: product.category.name, item: `${origin}/categorias/${product.category.slug}` }] : []),
    { name: `${product.title} ${product.color.label}`, item: url },
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProductGroup", "@id": groupId, productGroupID: product.productId,
        name: product.title, description: product.shortDescription || product.description,
        brand: { "@type": "Brand", name: "BLESH" }, variesBy: ["https://schema.org/color", "https://schema.org/size"],
        // En un grupo multipágina no hay una URL canónica común: cada color mantiene la suya.
        hasVariant: product.sizes.map((size) => ({
          "@type": "Product", "@id": `${url}#sku-${encodeURIComponent(size.sku)}`,
          name: `${product.title} ${product.color.label} ${size.sizeLabel}`,
          sku: size.sku, color: product.color.label, size: size.sizeLabel, url,
          image: product.images.map((i) => i.url), description: product.shortDescription || product.description,
          isVariantOf: { "@id": groupId },
          offers: {
            "@type": "Offer", url, priceCurrency: "PEN", price: (size.priceMinor / 100).toFixed(2),
            availability: `https://schema.org/${size.soldOut ? "OutOfStock" : "InStock"}`, seller: organization,
          },
        })),
      },
      { "@type": "BreadcrumbList", itemListElement: breadcrumb.map((b, i) => ({ "@type": "ListItem", position: i + 1, ...b })) },
    ],
  };
}
