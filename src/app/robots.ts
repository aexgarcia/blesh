import { getSiteConfig } from "@/infrastructure/seo/server";
import { buildRobots } from "@/shared/seo/crawling";

export default function robots() {
  const site = getSiteConfig();
  return buildRobots(site.origin, site.indexable);
}
