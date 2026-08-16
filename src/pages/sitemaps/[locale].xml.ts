import type { APIRoute } from "astro";
import { normalizeLocale } from "../../i18n/locale.ts";
import { projectCatalogForLocale } from "../../i18n/publicListing.ts";
import { getPublicPageMessages } from "../../i18n/publicRoutes.ts";
import { isPublicLocaleRouteEnabled } from "../../i18n/release4.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import { PUBLIC_STATIC_PAGE_CODES } from "../../i18n/staticPages.ts";
import { RELEASE4_FLAGS, SITE_URL } from "../../lib/config.ts";
import { isValidPublicCarSlug } from "../../lib/publicCar.ts";
import { setPublicCacheHeaders, setUnavailableHeaders } from "../../lib/publicCache.ts";
import { getLocalizedApprovedCars } from "../../lib/xano.ts";

export const prerender = false;

const xmlEscape = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const toIsoDate = (value?: string | number) => {
  if (!value) return null;
  const date = typeof value === "number" || /^\d+$/.test(String(value)) ? new Date(Number(value)) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const GET: APIRoute = async ({ params }) => {
  const locale = normalizeLocale(params.locale, { activeOnly: true });
  if (!locale || !isPublicLocaleRouteEnabled(locale, RELEASE4_FLAGS)) {
    const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
    setUnavailableHeaders(headers);
    return new Response("Sitemap not found", { status: 404, headers });
  }

  let sourceListings;
  try {
    sourceListings = await getLocalizedApprovedCars(locale);
  } catch {
    const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" });
    setUnavailableHeaders(headers);
    return new Response("Sitemap source temporarily unavailable", { status: 503, headers });
  }

  // Throws if a public locale was enabled without its complete SEO dictionary.
  getPublicPageMessages(locale);
  const cars = projectCatalogForLocale(sourceListings, locale)
    .filter((car, index, list) => isValidPublicCarSlug(car.slug) && list.findIndex((candidate) => candidate.slug === car.slug) === index);
  const siteUrl = SITE_URL || "https://automarket.sitecraft.agency";
  const staticPaths = PUBLIC_STATIC_PAGE_CODES.map((page) => `/${page}/`);
  const strictSeoRelease = isStrictSeoReleaseLocale(locale);
  const brandPaths = [...new Set(cars.map((car) => car.brand).filter(Boolean))]
    .map((brand) => `/cars/brand/${encodeURIComponent(brand)}/`);
  const modelPaths = [...new Set(cars.map((car) => `${car.brand}\u0000${car.model}`).filter((value) => !value.endsWith("\u0000")))]
    .map((value) => {
      const [brand, model] = value.split("\u0000");
      return `/cars/brand/${encodeURIComponent(brand)}/${encodeURIComponent(model)}/`;
    });
  const cityPaths = [...new Set(cars.map((car) => car.city).filter(Boolean))]
    .map((city) => `/cars/city/${encodeURIComponent(city)}/`);
  const indexablePagePaths = strictSeoRelease
    ? ["/", "/cars/", ...staticPaths, ...brandPaths, ...modelPaths, ...cityPaths]
    : staticPaths;

  const urls = [
    ...indexablePagePaths.map((path) => ({ loc: new URL(`/${locale}${path}`, siteUrl).toString(), lastmod: null })),
    ...cars.map((car) => ({
      loc: new URL(`/${locale}/cars/${encodeURIComponent(car.slug)}/`, siteUrl).toString(),
      lastmod: toIsoDate(car.translation_updated_at || car.updated_at || car.created_at),
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;
  const headers = new Headers({ "Content-Type": "application/xml; charset=utf-8", "X-SiteCraft-Query-Count": "1" });
  setPublicCacheHeaders(headers, "sitemap");
  return new Response(body, { headers });
};
