import {
  buildSeoParityDiff,
  listingSlugs,
  localeListingShardLocations,
  parityIsReady,
  sitemapLocations,
  sitemapVehicleSlugs,
} from "./lib/seo-parity.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const locale = arg("--locale", "de").trim().toLowerCase();
const cyrillicTaxonomyLocales = new Set(["ru", "uk", "bg"]);
const site = new URL(arg("--base-url", "https://automarket.sitecraft.agency"));
const xano = new URL(arg("--xano-url", "https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u"));
const allowNotReady = args.includes("--allow-not-ready");
const requireAuthoritative = args.includes("--require-authoritative");
const pageLimit = Math.max(1, Number(arg("--limit", "100")) || 100);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, init = {}) {
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch(url, { redirect: "follow", ...init });
    if (![429, 502, 503, 504].includes(response.status) || attempt === 5) return response;
    await response.arrayBuffer();
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(30_000, retryAfter * 1_000)
      : 2_500 * (attempt + 1));
  }
  return response;
}

async function json(url) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url.pathname} returned ${response.status}: ${text.slice(0, 180)}`);
  return JSON.parse(text);
}

async function loadBoundedCatalogSlugs() {
  const slugs = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL("public/locale/catalog", `${xano.toString().replace(/\/+$/, "")}/`);
    url.searchParams.set("lang", locale);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "24");
    const payload = await json(url);
    slugs.push(...listingSlugs(payload));
    totalPages = Math.max(1, Number(payload?.pagination?.total_pages || 1));
    if (!Number.isSafeInteger(totalPages) || totalPages > 1_000) throw new Error("Bounded catalog pagination is invalid");
    page += 1;
  } while (page <= totalPages);
  return [...new Set(slugs)].sort((left, right) => left.localeCompare(right));
}

const schemaItems = (html) => [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1]);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });

async function inspectVehicle(slug) {
  const path = `/${locale}/cars/${encodeURIComponent(slug)}/`;
  const url = new URL(path, site);
  const response = await fetchWithRetry(url, { headers: { Accept: "text/html" } });
  const html = await response.text();
  const canonical = new URL(path, site).toString();
  const schemas = schemaItems(html);
  const byType = (type) => schemas.find((item) => item?.["@type"] === type);
  const vehicle = byType("Vehicle");
  const offer = byType("Offer");
  const breadcrumb = byType("BreadcrumbList");
  const violations = [];

  if (response.status !== 200) violations.push(`HTTP ${response.status}`);
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) violations.push("canonical");
  if (/noindex/i.test(response.headers.get("x-robots-tag") || "")) violations.push("x-robots-tag");
  if (!vehicle) violations.push("Vehicle");
  if (!offer) violations.push("Offer");
  if (!breadcrumb) violations.push("BreadcrumbList");
  if (vehicle && offer && offer.itemOffered?.["@id"] !== vehicle["@id"]) violations.push("Offer.itemOffered");
  const contextLinks = html.match(/<nav[^>]+class=["'][^"']*vehicle-context-links[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1] || "";
  if (vehicle) {
    const taxonomy = [vehicle.fuelType, vehicle.vehicleTransmission, vehicle.bodyType, vehicle.color].filter(Boolean).join(" ");
    if (!cyrillicTaxonomyLocales.has(locale) && /[А-Яа-яЁёІіЇїЄє]/u.test(taxonomy)) violations.push("untranslated taxonomy");
    if (vehicle.brand?.name && !new RegExp(`href=["']/${locale}/cars/brand/[^/]+/["']`).test(contextLinks)) violations.push("brand link");
    if (vehicle.model && vehicle.brand?.name && !new RegExp(`href=["']/${locale}/cars/brand/[^/]+/[^/]+/["']`).test(contextLinks)) violations.push("model link");
    if (vehicle.fuelType && !new RegExp(`href=["']/${locale}/cars/fuel/[^/]+/["']`).test(contextLinks)) violations.push("fuel link");
    if (vehicle.bodyType && !new RegExp(`href=["']/${locale}/cars/body/[^/]+/["']`).test(contextLinks)) violations.push("body link");
  }
  const city = offer?.availableAtOrFrom?.address?.addressLocality;
  if (city && !new RegExp(`href=["']/${locale}/cars/city/[^/]+/["']`).test(contextLinks)) violations.push("city link");
  if (!new RegExp(`href=["']/${locale}/cars/price/[^/]+/["']`).test(contextLinks)) violations.push("price link");

  const imageUrl = Array.isArray(vehicle?.image) ? vehicle.image[0] : vehicle?.image;
  if (imageUrl) {
    let imageResponse = await fetchWithRetry(new URL(imageUrl, site), { method: "HEAD" });
    if (!imageResponse.ok) imageResponse = await fetchWithRetry(new URL(imageUrl, site), { headers: { Range: "bytes=0-0" } });
    if (!imageResponse.ok) violations.push(`image HTTP ${imageResponse.status}`);
    await imageResponse.body?.cancel().catch(() => undefined);
  } else {
    violations.push("image");
  }

  return { slug, path, status: response.status, violations };
}

const localizedUrl = new URL("public/locale/cars", `${xano.toString().replace(/\/+$/, "")}/`);
localizedUrl.searchParams.set("lang", locale);
const sitemapIndexUrl = new URL("/sitemap.xml", site);
const productionCatalogUrl = new URL(`/${locale}/cars/`, site);
const legacySupportedLocales = new Set(["de", "ru", "uk", "en", "ar", "tr"]);
const legacyUrl = new URL("cars", `${xano.toString().replace(/\/+$/, "")}/`);
legacyUrl.searchParams.set("lang", locale);

const [legacyPayload, localizedPayload, boundedCatalogSlugs, sitemapIndexResponse, productionCatalogResponse] = await Promise.all([
  legacySupportedLocales.has(locale) ? json(legacyUrl) : null,
  json(localizedUrl),
  loadBoundedCatalogSlugs(),
  fetchWithRetry(sitemapIndexUrl, { headers: { Accept: "application/xml" } }),
  fetchWithRetry(productionCatalogUrl, { headers: { Accept: "text/html" } }),
]);
const sitemapIndexXml = await sitemapIndexResponse.text();
if (!sitemapIndexResponse.ok) throw new Error(`${sitemapIndexUrl.pathname} returned ${sitemapIndexResponse.status}`);
if (!productionCatalogResponse.ok) throw new Error(`${productionCatalogUrl.pathname} returned ${productionCatalogResponse.status}`);
await productionCatalogResponse.arrayBuffer();
const rootLocations = sitemapLocations(sitemapIndexXml);
const localeSitemapLocation = rootLocations.find((value) => new URL(value).pathname === `/sitemaps/${locale}.xml`);
if (!localeSitemapLocation) throw new Error(`Sitemap index has no ${locale} locale sitemap`);
const shardLocations = localeListingShardLocations(sitemapIndexXml, locale);
const sitemapUrl = new URL(localeSitemapLocation);
const sitemapResponse = await fetchWithRetry(sitemapUrl, { headers: { Accept: "application/xml" } });
const sitemapXml = await sitemapResponse.text();
if (!sitemapResponse.ok) throw new Error(`${sitemapUrl.pathname} returned ${sitemapResponse.status}`);
const shardResponses = [];
for (const location of shardLocations) {
  const response = await fetchWithRetry(new URL(location), { headers: { Accept: "application/xml" } });
  const xml = await response.text();
  if (!response.ok) throw new Error(`${new URL(location).pathname} returned ${response.status}`);
  shardResponses.push({ response, xml });
}

const localizedSlugs = listingSlugs(localizedPayload);
const publicSlugs = legacyPayload ? listingSlugs(legacyPayload) : localizedSlugs;
const sitemapSlugs = shardResponses.length
  ? [...new Set(shardResponses.flatMap(({ xml }) => sitemapVehicleSlugs(xml, locale)))].sort((left, right) => left.localeCompare(right))
  : sitemapVehicleSlugs(sitemapXml, locale);
// Strict localized readiness is the SEO source of truth. The legacy endpoint
// intentionally keeps source-language fallbacks visible and may therefore
// contain more cars than an indexable locale.
const diff = buildSeoParityDiff(localizedSlugs, localizedSlugs, sitemapSlugs, boundedCatalogSlugs);
const localizedSet = new Set(localizedSlugs);
const legacyInventoryOnly = publicSlugs.filter((slug) => !localizedSet.has(slug));
const sources = {
  sitemap_index: sitemapIndexResponse.headers.get("x-sitecraft-sitemap-source") || "",
  locale_sitemap: sitemapResponse.headers.get("x-sitecraft-sitemap-source") || "",
  listing_shards: shardResponses.map(({ response }) => response.headers.get("x-sitecraft-sitemap-source") || ""),
  catalog: productionCatalogResponse.headers.get("x-sitecraft-catalog-source") || "",
};
const sourceViolations = requireAuthoritative
  ? [
      sources.sitemap_index === "xano_sharded" ? "" : "sitemap index is not authoritative",
      sources.locale_sitemap === "xano_pages_only" ? "" : "locale sitemap is not authoritative",
      shardResponses.length > 0 && sources.listing_shards.every((source) => source === "xano_slug_shard") ? "" : "listing shards are not authoritative",
      sources.catalog === "xano_bounded" ? "" : "catalog is not authoritative",
    ].filter(Boolean)
  : [];
const inspected = [];
for (const slug of sitemapSlugs.slice(0, pageLimit)) inspected.push(await inspectVehicle(slug));
const pageViolations = inspected.filter((item) => item.violations.length > 0);
const ready = localizedSlugs.length > 0 && parityIsReady(diff) && pageViolations.length === 0 && sourceViolations.length === 0;
const report = {
  ok: ready,
  locale,
  counts: { xano_public: legacyPayload ? publicSlugs.length : null, xano_localized: localizedSlugs.length, xano_bounded_catalog: boundedCatalogSlugs.length, sitemap: sitemapSlugs.length, inspected: inspected.length },
  diff,
  legacy_inventory_only_non_indexable: legacyInventoryOnly,
  page_violations: pageViolations,
  authoritative_sources: { required: requireAuthoritative, ...sources, violations: sourceViolations },
  sitemap_architecture: { locale_map: sitemapUrl.toString(), listing_shards: shardLocations.length },
  search_console: {
    sitemap: sitemapIndexUrl.toString(),
    sample_urls: sitemapSlugs.slice(0, 10).map((slug) => new URL(`/${locale}/cars/${encodeURIComponent(slug)}/`, site).toString()),
    note: "Coverage and impressions require a connected Google Search Console property; this audit verifies the crawlable inputs.",
  },
};
console.log(JSON.stringify(report, null, 2));
if (!ready && !allowNotReady) process.exitCode = 1;
