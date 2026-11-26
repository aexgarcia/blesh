import { describe, expect, it } from "vitest";

import { productStructuredData } from "@/composition/product-seo";
import type { StoreProduct } from "@/composition/storefront";

describe("datos estructurados de variantes", () => {
  it("precio/stock corresponden a cada talla del color; no inventa reseñas o envío", () => {
    const product = {
      productId: "p1", slug: "boxy", title: "Boxy", shortDescription: "Algodón", description: "Prenda",
      color: { slug: "negro", label: "Negro" }, category: { slug: "ropa", name: "Ropa" },
      images: [{ url: "https://images.example/negro.webp" }],
      sizes: [{ sku: "NEG-S", sizeLabel: "S", priceMinor: 4000, soldOut: false }, { sku: "NEG-M", sizeLabel: "M", priceMinor: 4500, soldOut: true }],
    } as StoreProduct;
    const data = productStructuredData(product, "https://blesh.example");
    const group = data["@graph"][0];
    expect(group).toMatchObject({ "@type": "ProductGroup", productGroupID: "p1", hasVariant: [
      { sku: "NEG-S", color: "Negro", offers: { price: "40.00", priceCurrency: "PEN", availability: "https://schema.org/InStock" } },
      { sku: "NEG-M", offers: { price: "45.00", availability: "https://schema.org/OutOfStock" } },
    ] });
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|review|shippingDetails|returnPolicy/);
  });
});
