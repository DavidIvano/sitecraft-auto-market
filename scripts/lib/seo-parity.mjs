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

export function buildSeoParityDiff(expected, localized, sitemap) {
  const expectedSet = new Set(expected);
  const localizedSet = new Set(localized);
  const sitemapSet = new Set(sitemap);
  const difference = (left, right) => uniqueSorted([...left].filter((value) => !right.has(value)));
  return {
    missing_in_localized_xano: difference(expectedSet, localizedSet),
    unexpected_in_localized_xano: difference(localizedSet, expectedSet),
    missing_in_sitemap: difference(expectedSet, sitemapSet),
    unexpected_in_sitemap: difference(sitemapSet, expectedSet),
  };
}

export function parityIsReady(diff) {
  return Object.values(diff).every((values) => values.length === 0);
}
