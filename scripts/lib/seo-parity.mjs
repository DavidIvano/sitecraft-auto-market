export const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

export function listingArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["items", "data", "result", "cars"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

export function listingSlugs(payload) {
  return uniqueSorted(listingArray(payload).map((item) => String(item?.slug || "").trim()));
}

export function sitemapVehicleSlugs(xml, locale) {
  const expression = new RegExp(`<loc>[^<]*/${locale}/cars/([^/]+)/</loc>`, "g");
  return uniqueSorted([...xml.matchAll(expression)].map((match) => decodeURIComponent(match[1])));
}

const decodeXml = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", "\"")
  .replaceAll("&apos;", "'");

export function sitemapLocations(xml) {
  return uniqueSorted([...String(xml || "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1])));
}

export function localeListingShardLocations(xml, locale) {
  const expression = new RegExp(`^/sitemaps/${locale}/listings/[A-Za-z0-9][A-Za-z0-9_-]{0,79}/[1-9]\\d*\\.xml$`);
  return sitemapLocations(xml).filter((value) => {
    try {
      return expression.test(new URL(value).pathname);
    } catch {
      return false;
    }
  });
}

/**
 * @param {string[]} expected
 * @param {string[]} localized
 * @param {string[]} sitemap
 * @param {string[] | null} [boundedCatalog]
 * @returns {Record<string, string[]>}
 */
export function buildSeoParityDiff(expected, localized, sitemap, boundedCatalog = null) {
  const expectedSet = new Set(expected);
  const localizedSet = new Set(localized);
  const sitemapSet = new Set(sitemap);
  const difference = (left, right) => uniqueSorted([...left].filter((value) => !right.has(value)));
  /** @type {Record<string, string[]>} */
  const diff = {
    missing_in_localized_xano: difference(expectedSet, localizedSet),
    unexpected_in_localized_xano: difference(localizedSet, expectedSet),
    missing_in_sitemap: difference(expectedSet, sitemapSet),
    unexpected_in_sitemap: difference(sitemapSet, expectedSet),
  };
  if (boundedCatalog) {
    const catalogSet = new Set(boundedCatalog);
    diff.missing_in_bounded_catalog = difference(expectedSet, catalogSet);
    diff.unexpected_in_bounded_catalog = difference(catalogSet, expectedSet);
  }
  return diff;
}

export function parityIsReady(diff) {
  return Object.values(diff).every((values) => values.length === 0);
}
