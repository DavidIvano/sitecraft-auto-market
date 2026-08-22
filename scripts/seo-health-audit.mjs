import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { publicLocaleDefinitions } from "../src/i18n/config.ts";
import { loadSearchConsoleSnapshot } from "../src/lib/server/googleSearchConsole.ts";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = new URL(arg("--base-url", "https://automarket.sitecraft.agency"));
const outputPath = resolve(arg("--output", "artifacts/seo-health/latest.json"));
const intervalMs = Number(arg("--request-interval-ms", "2100"));
const expectedLocales = publicLocaleDefinitions.map((locale) => locale.code);
const violations = [];
const localeReports = [];
let lastRequestStartedAt = 0;

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const decodeXml = (value) => value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
const xmlLocations = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => decodeXml(match[1] || ""));

async function request(url, accept) {
  const wait = Math.max(0, intervalMs - (Date.now() - lastRequestStartedAt));
  if (wait > 0) await sleep(wait);
  lastRequestStartedAt = Date.now();
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
      const body = await response.text();
      if (![429, 502, 503, 504].includes(response.status) || attempt === 3) return { response, body };
      await sleep(attempt * 1300);
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
      await sleep(attempt * 1300);
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

function check(condition, code, detail) {
  if (!condition) violations.push({ code, detail });
}

const startedAt = new Date().toISOString();
let sitemapIndex = null;
try {
  const result = await request(new URL("/sitemap.xml", baseUrl), "application/xml");
  sitemapIndex = result;
  check(result.response.status === 200, "SITEMAP_HTTP", `Root sitemap returned ${result.response.status}`);
  check(result.response.headers.get("x-sitecraft-sitemap-source") === "xano_sharded", "SITEMAP_SOURCE", "Root sitemap is not xano_sharded");
  check(/<sitemapindex/u.test(result.body), "SITEMAP_FORMAT", "Root sitemap is not a sitemap index");
} catch (error) {
  violations.push({ code: "SITEMAP_REQUEST", detail: error instanceof Error ? error.message : String(error) });
}

const locations = sitemapIndex ? xmlLocations(sitemapIndex.body) : [];
const generationSet = new Set();
for (const locale of expectedLocales) {
  const localeMap = locations.find((value) => new URL(value).pathname === `/sitemaps/${locale}.xml`);
  const shard = locations.find((value) => new RegExp(`^/sitemaps/${locale}/listings/([^/]+)/1\\.xml$`, "u").test(new URL(value).pathname));
  const report = { locale, locale_map: Boolean(localeMap), listing_shard: Boolean(shard), listing_urls: 0, detail_url: null, ok: false, violations: [] };
  const localeViolation = (code, detail) => {
    report.violations.push({ code, detail });
    violations.push({ code: `${locale}:${code}`, detail });
  };
  if (!localeMap) localeViolation("LOCALE_MAP_MISSING", `No /sitemaps/${locale}.xml entry`);
  if (!shard) localeViolation("LISTING_SHARD_MISSING", `No listing shard for ${locale}`);
  if (!localeMap || !shard) {
    localeReports.push(report);
    continue;
  }
  const shardMatch = new URL(shard).pathname.match(new RegExp(`^/sitemaps/${locale}/listings/([^/]+)/1\\.xml$`, "u"));
  if (shardMatch?.[1]) generationSet.add(shardMatch[1]);
  try {
    const localeResult = await request(localeMap, "application/xml");
    if (localeResult.response.status !== 200) localeViolation("LOCALE_MAP_HTTP", `HTTP ${localeResult.response.status}`);
    if (localeResult.response.headers.get("x-sitecraft-sitemap-source") !== "xano_pages_only") localeViolation("LOCALE_MAP_SOURCE", "Expected xano_pages_only");
    const localeUrls = xmlLocations(localeResult.body);
    if (!localeUrls.some((value) => new URL(value).pathname === `/${locale}/cars/`)) localeViolation("CATALOG_URL_MISSING", "Locale catalog is absent from page sitemap");

    const shardResult = await request(shard, "application/xml");
    if (shardResult.response.status !== 200) localeViolation("SHARD_HTTP", `HTTP ${shardResult.response.status}`);
    if (shardResult.response.headers.get("x-sitecraft-sitemap-source") !== "xano_slug_shard") localeViolation("SHARD_SOURCE", "Expected xano_slug_shard");
    const listingUrls = xmlLocations(shardResult.body);
    report.listing_urls = listingUrls.length;
    if (!listingUrls.length) localeViolation("SHARD_EMPTY", "Listing shard has no URLs");
    if (listingUrls.some((value) => !new RegExp(`^/${locale}/cars/[^/]+/$`, "u").test(new URL(value).pathname))) localeViolation("SHARD_PATH", "Listing shard contains a non-locale detail URL");

    const detailUrl = listingUrls[0];
    if (detailUrl) {
      report.detail_url = detailUrl;
      const detail = await request(detailUrl, "text/html");
      if (detail.response.status !== 200) localeViolation("DETAIL_HTTP", `HTTP ${detail.response.status}`);
      if (!detail.body.includes(`<link rel="canonical" href="${detailUrl}">`)) localeViolation("DETAIL_CANONICAL", "Canonical does not match sitemap URL");
      if (!detail.body.includes(`hreflang="${locale}"`)) localeViolation("DETAIL_HREFLANG", "Self hreflang missing");
      if (!/"@type":\["Product","Car"\]/u.test(detail.body)) localeViolation("DETAIL_SCHEMA", "Product + Car schema missing");
      if (!/"@type":"Offer"/u.test(detail.body)) localeViolation("DETAIL_OFFER", "Offer schema missing");
      if (!/"@type":"BreadcrumbList"/u.test(detail.body)) localeViolation("DETAIL_BREADCRUMB", "BreadcrumbList schema missing");
      if (/name=["']robots["'][^>]+noindex/iu.test(detail.body)) localeViolation("DETAIL_NOINDEX", "Detail page is noindex");
    }
  } catch (error) {
    localeViolation("REQUEST_FAILED", error instanceof Error ? error.message : String(error));
  }
  report.ok = report.violations.length === 0;
  localeReports.push(report);
  console.log(JSON.stringify({ event: "locale_checked", locale, ok: report.ok, listing_urls: report.listing_urls, violations: report.violations.length }));
}

check(expectedLocales.length === 28, "LOCALE_REGISTRY", `Expected 28 public locales, received ${expectedLocales.length}`);
check(generationSet.size === 1, "GENERATION_PARITY", `Observed ${generationSet.size} listing generations`);

const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
const searchConsole = await loadSearchConsoleSnapshot(process.env, { sitemapUrl, timeoutMs: 20_000 });
const requireSearchConsole = process.env.SEO_HEALTH_REQUIRE_SEARCH_CONSOLE === "true";
if (requireSearchConsole) {
  check(searchConsole.status === "connected", "GSC_CONNECTION", `Search Console status: ${searchConsole.status}`);
  check(searchConsole.status === "connected" && searchConsole.sitemap.submitted, "GSC_SITEMAP", "Production sitemap is not registered in Search Console API");
  check(searchConsole.status === "connected" && searchConsole.sitemap.errors === 0, "GSC_SITEMAP_ERRORS", `Search Console sitemap errors: ${searchConsole.status === "connected" ? searchConsole.sitemap.errors : "unknown"}`);
}

const report = {
  ok: violations.length === 0,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  base_url: baseUrl.toString(),
  locales: { expected: expectedLocales.length, passed: localeReports.filter((item) => item.ok).length, items: localeReports },
  generations: [...generationSet],
  sitemap: { url: sitemapUrl, child_count: locations.length },
  search_console: searchConsole,
  violations,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: report.ok, output: outputPath, locales: report.locales, generations: report.generations, search_console: searchConsole.status, violations }, null, 2));
if (!report.ok) process.exitCode = 1;
