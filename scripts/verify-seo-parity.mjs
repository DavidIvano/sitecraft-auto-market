import { buildSeoParityDiff, listingSlugs, parityIsReady, sitemapVehicleSlugs } from "./lib/seo-parity.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const locale = arg("--locale", "de").trim().toLowerCase();
const site = new URL(arg("--base-url", "https://automarket.sitecraft.agency"));
const xano = new URL(arg("--xano-url", "https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u"));
const allowNotReady = args.includes("--allow-not-ready");
const pageLimit = Math.max(1, Number(arg("--limit", "100")) || 100);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, init = {}) {
  let response;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(url, { redirect: "follow", ...init });
    if (![429, 502, 503, 504].includes(response.status) || attempt === 3) return response;
    await response.arrayBuffer();
    await sleep(500 * (attempt + 1));
  }
  return response;
}

async function json(url) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url.pathname} returned ${response.status}: ${text.slice(0, 180)}`);
  return JSON.parse(text);
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
  if (vehicle) {
    const taxonomy = [vehicle.fuelType, vehicle.vehicleTransmission, vehicle.bodyType, vehicle.color].filter(Boolean).join(" ");
    if (/[А-Яа-яЁёІіЇїЄє]/u.test(taxonomy)) violations.push("untranslated taxonomy");
    if (vehicle.brand?.name && !html.includes(`/cars/brand/${encodeURIComponent(vehicle.brand.name)}/`)) violations.push("brand link");
    if (vehicle.model && vehicle.brand?.name && !html.includes(`/cars/brand/${encodeURIComponent(vehicle.brand.name)}/${encodeURIComponent(vehicle.model)}/`)) violations.push("model link");
  }
  const city = offer?.availableAtOrFrom?.address?.addressLocality;
  if (city && !html.includes(`/cars/city/${encodeURIComponent(city)}/`)) violations.push("city link");

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

const legacyUrl = new URL("cars", `${xano.toString().replace(/\/+$/, "")}/`);
legacyUrl.searchParams.set("lang", locale);
const localizedUrl = new URL("public/locale/cars", `${xano.toString().replace(/\/+$/, "")}/`);
localizedUrl.searchParams.set("lang", locale);
const sitemapUrl = new URL(`/sitemaps/${locale}.xml`, site);

const [legacyPayload, localizedPayload, sitemapResponse] = await Promise.all([
  json(legacyUrl),
  json(localizedUrl),
  fetchWithRetry(sitemapUrl, { headers: { Accept: "application/xml" } }),
]);
const sitemapXml = await sitemapResponse.text();
if (!sitemapResponse.ok) throw new Error(`${sitemapUrl.pathname} returned ${sitemapResponse.status}`);

const publicSlugs = listingSlugs(legacyPayload);
const localizedSlugs = listingSlugs(localizedPayload);
const sitemapSlugs = sitemapVehicleSlugs(sitemapXml, locale);
const diff = buildSeoParityDiff(publicSlugs, localizedSlugs, sitemapSlugs);
const inspected = [];
for (const slug of sitemapSlugs.slice(0, pageLimit)) inspected.push(await inspectVehicle(slug));
const pageViolations = inspected.filter((item) => item.violations.length > 0);
const ready = publicSlugs.length > 0 && parityIsReady(diff) && pageViolations.length === 0;
const report = {
  ok: ready,
  locale,
  counts: { xano_public: publicSlugs.length, xano_localized: localizedSlugs.length, sitemap: sitemapSlugs.length, inspected: inspected.length },
  diff,
  page_violations: pageViolations,
  search_console: {
    sitemap: sitemapUrl.toString(),
    sample_urls: sitemapSlugs.slice(0, 10).map((slug) => new URL(`/${locale}/cars/${encodeURIComponent(slug)}/`, site).toString()),
    note: "Coverage and impressions require a connected Google Search Console property; this audit verifies the crawlable inputs.",
  },
};
console.log(JSON.stringify(report, null, 2));
if (!ready && !allowNotReady) process.exitCode = 1;
