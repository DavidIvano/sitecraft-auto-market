import { getEnabledPublicLocaleDefinitions } from "../i18n/release4.ts";
import { RELEASE4_FLAGS, SITE_URL } from "../lib/config.ts";
import { setPublicCacheHeaders, setUnavailableHeaders } from "../lib/publicCache.ts";
import { loadSeoSitemapManifest } from "../lib/seo/sitemapRoute.ts";
import { renderSitemapIndex } from "../lib/seo/sitemapXml.ts";

export const prerender = false;

export async function GET() {
  const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";
  let manifest;
  try {
    manifest = await loadSeoSitemapManifest();
  } catch {
    const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" });
    setUnavailableHeaders(headers);
    return new Response("Sitemap manifest temporarily unavailable", { status: 503, headers });
  }
  const manifestByLocale = new Map(manifest?.locales.map((item) => [item.locale, item]) || []);
  const entries = getEnabledPublicLocaleDefinitions(RELEASE4_FLAGS).flatMap((definition) => {
    const localeEntry = { loc: new URL(`/sitemaps/${definition.code}.xml`, siteUrl).toString(), lastmod: null };
    const localeManifest = manifestByLocale.get(definition.code);
    if (!localeManifest) return [localeEntry];
    const shards = Array.from({ length: localeManifest.shardCount }, (_, index) => ({
      loc: new URL(
        `/sitemaps/${definition.code}/listings/${localeManifest.generation}/${index + 1}.xml`,
        siteUrl,
      ).toString(),
      lastmod: localeManifest.lastmod,
    }));
    return [localeEntry, ...shards];
  });
  const body = renderSitemapIndex(entries);
  const headers = new Headers({
    "Content-Type": "application/xml; charset=utf-8",
    "X-SiteCraft-Sitemap-Source": manifest ? "xano_sharded" : "compatibility_combined",
    "X-SiteCraft-Query-Count": manifest ? "1" : "0",
  });
  setPublicCacheHeaders(headers, "sitemap");
  return new Response(body, { headers });
}
