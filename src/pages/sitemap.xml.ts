import { getEnabledPublicLocaleDefinitions } from "../i18n/release4.ts";
import { RELEASE4_FLAGS, SITE_URL } from "../lib/config.ts";
import { setPublicCacheHeaders } from "../lib/publicCache.ts";

export const prerender = false;

const xmlEscape = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export function GET() {
  const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";
  const entries = getEnabledPublicLocaleDefinitions(RELEASE4_FLAGS).map((definition) => (
    new URL(`/sitemaps/${definition.code}.xml`, siteUrl).toString()
  ));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((loc) => `  <sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
  const headers = new Headers({ "Content-Type": "application/xml; charset=utf-8" });
  setPublicCacheHeaders(headers, "sitemap");
  return new Response(body, { headers });
}
