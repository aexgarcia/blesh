import "server-only";

import { parseSiteConfig } from "../config/site";

export function getSiteConfig() {
  return parseSiteConfig(process.env);
}
