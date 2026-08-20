import type { APIRoute } from "astro";
import { normalizeLocale } from "../../../../../i18n/locale.ts";
import { isPublicLocaleRouteEnabled } from "../../../../../i18n/release4.ts";
import { isStrictSeoReleaseLocale } from "../../../../../i18n/releaseStage3.ts";
import { RELEASE4_FLAGS, SITE_URL } from "../../../../../lib/config.ts";
import { setPublicCacheHeaders, setUnavailableHeaders } from "../../../../../lib/publicCache.ts";
import {
  SITEMAP_GENERATION_PATTERN,
  SITEMAP_MAX_SHARDS_PER_LOCALE,
} from "../../../../../lib/seo/sitemapApi.ts";
import { loadSeoListingSitemapShard } from "../../../../../lib/seo/sitemapRoute.ts";
import { renderUrlSet } from "../../../../../lib/seo/sitemapXml.ts";

export const prerender = false;

const notFound = () => {
  const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
  setUnavailableHeaders(headers);
  return new Response("Listing sitemap shard not found", { status: 404, headers });
};

export const GET: APIRoute = async ({ params }) => {
  const locale = normalizeLocale(params.locale, { activeOnly: true });
  const generation = String(params.generation || "").trim();
  const rawPage = String(params.page || "").trim();
  const page = /^\d+$/u.test(rawPage) ? Number(rawPage) : 0;
  if (!locale
    || !isPublicLocaleRouteEnabled(locale, RELEASE4_FLAGS)
    || !isStrictSeoReleaseLocale(locale)
    || !SITEMAP_GENERATION_PATTERN.test(generation)
    || !Number.isSafeInteger(page)
    || page < 1
    || page > SITEMAP_MAX_SHARDS_PER_LOCALE) {
    return notFound();
  }

  let shard;
  try {
    shard = await loadSeoListingSitemapShard({ locale, generation, page });
  } catch {
    const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" });
    setUnavailableHeaders(headers);
    return new Response("Listing sitemap shard temporarily unavailable", { status: 503, headers });
  }
  if (!shard) return notFound();

  const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";
  const body = renderUrlSet(shard.items.map((item) => ({
    loc: new URL(`/${locale}/cars/${encodeURIComponent(item.slug)}/`, siteUrl).toString(),
    lastmod: item.lastmod,
  })));
  const headers = new Headers({
    "Content-Type": "application/xml; charset=utf-8",
    "X-SiteCraft-Query-Count": "1",
    "X-SiteCraft-Sitemap-Source": "xano_slug_shard",
    "X-SiteCraft-Sitemap-Generation": shard.generation,
  });
  setPublicCacheHeaders(headers, "sitemap");
  return new Response(body, { headers });
};
