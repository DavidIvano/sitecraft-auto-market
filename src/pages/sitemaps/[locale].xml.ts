import type { APIRoute } from "astro";
import { normalizeLocale } from "../../i18n/locale.ts";
import { projectCatalogForLocale } from "../../i18n/publicListing.ts";
import { getPublicPageMessages } from "../../i18n/publicRoutes.ts";
import { isPublicLocaleRouteEnabled } from "../../i18n/release4.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import {
  RELEASE4_FLAGS,
  SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED,
  SEO_SITEMAP_SHARDS_ENABLED,
  SITE_URL,
} from "../../lib/config.ts";
import { isValidPublicCarSlug } from "../../lib/publicCar.ts";
import { setPublicCacheHeaders, setPublicNoStoreHeaders, setUnavailableHeaders } from "../../lib/publicCache.ts";
import { getLocalizedApprovedCars } from "../../lib/xano.ts";
import { loadLocalizedSeoTaxonomySitemapFacets } from "../../lib/seo/taxonomyRoute.ts";
import { renderUrlSet } from "../../lib/seo/sitemapXml.ts";
import { toSitemapIsoDate } from "../../lib/seo/sitemapApi.ts";
import { SEO_SITEMAP_SEED_PATHS } from "../../lib/seo/sitemapPolicy.ts";
import {
  buildSeoTaxonomyGraph,
  getIndexableSeoTaxonomyFacets,
  getTaxonomyBasePath,
} from "../../lib/seo/taxonomies.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const locale = normalizeLocale(params.locale, { activeOnly: true });
  if (!locale || !isPublicLocaleRouteEnabled(locale, RELEASE4_FLAGS)) {
    const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
    setUnavailableHeaders(headers);
    return new Response("Sitemap not found", { status: 404, headers });
  }

  let sourceListings = null;
  let boundedTaxonomyFacets;
  let shardedMode = false;
  try {
    if (SEO_SITEMAP_SHARDS_ENABLED) {
      try {
        boundedTaxonomyFacets = await loadLocalizedSeoTaxonomySitemapFacets(locale, {
          requireBounded: true,
          allowCompatibilityFallback: false,
        });
        if (!boundedTaxonomyFacets) throw new Error("Bounded taxonomy sitemap feed is unavailable");
        shardedMode = true;
      } catch (error) {
        if (!SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED) throw error;
        sourceListings = await getLocalizedApprovedCars(locale);
        boundedTaxonomyFacets = null;
      }
    } else {
      [sourceListings, boundedTaxonomyFacets] = await Promise.all([
        getLocalizedApprovedCars(locale),
        loadLocalizedSeoTaxonomySitemapFacets(locale),
      ]);
    }
  } catch {
    const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" });
    setUnavailableHeaders(headers);
    return new Response("Sitemap source temporarily unavailable", { status: 503, headers });
  }

  // Throws if a public locale was enabled without its complete SEO dictionary.
  getPublicPageMessages(locale);
  const cars = projectCatalogForLocale(sourceListings || [], locale)
    .filter((car, index, list) => isValidPublicCarSlug(car.slug) && list.findIndex((candidate) => candidate.slug === car.slug) === index);
  const localizedSlugs = new Set(cars.map((car) => car.slug));
  const taxonomyCars = (sourceListings || []).filter((car) => localizedSlugs.has(car.slug));
  const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";
  const strictSeoRelease = isStrictSeoReleaseLocale(locale);
  const taxonomyGraph = boundedTaxonomyFacets ? null : buildSeoTaxonomyGraph(taxonomyCars);
  const taxonomyFacets = boundedTaxonomyFacets?.facets
    || getIndexableSeoTaxonomyFacets(taxonomyGraph!, locale);
  const taxonomyEntries = taxonomyFacets
    .map((facet) => ({ path: getTaxonomyBasePath(facet), lastmod: facet.lastmod }));
  const indexablePagePaths = strictSeoRelease
    ? [
        ...SEO_SITEMAP_SEED_PATHS.map((path) => ({ path, lastmod: null })),
        ...taxonomyEntries,
      ]
    : [];

  const urls = [
    ...indexablePagePaths.map(({ path, lastmod }) => ({ loc: new URL(`/${locale}${path}`, siteUrl).toString(), lastmod })),
    ...(!shardedMode ? cars.map((car) => ({
      loc: new URL(`/${locale}/cars/${encodeURIComponent(car.slug)}/`, siteUrl).toString(),
      lastmod: toSitemapIsoDate(car.translation_updated_at || car.updated_at || car.created_at),
    })) : []),
  ];
  const body = renderUrlSet(urls);
  const queryCount = (sourceListings ? 1 : 0) + (boundedTaxonomyFacets?.queryCount || 0);
  const headers = new Headers({
    "Content-Type": "application/xml; charset=utf-8",
    "X-SiteCraft-Query-Count": String(queryCount),
    "X-SiteCraft-Sitemap-Source": shardedMode ? "xano_pages_only" : "compatibility_combined",
  });
  if (shardedMode) setPublicCacheHeaders(headers, "sitemap");
  else setPublicNoStoreHeaders(headers);
  return new Response(body, { headers });
};
