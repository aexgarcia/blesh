import { getStoreCategories, getStoreSitemapEntries } from "@/composition/storefront";
import { getSiteConfig } from "@/infrastructure/seo/server";
import { buildSitemap } from "@/shared/seo/crawling";

export default async function sitemap() {
  const site = getSiteConfig();
  if (!site.indexable) return [];
  const [products, categories] = await Promise.all([getStoreSitemapEntries(), getStoreCategories()]);
  return buildSitemap({ ...site, products, categories });
}
