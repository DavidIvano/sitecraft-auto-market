import assert from "node:assert/strict";

const DEFAULT_CANONICAL_ORIGIN = "https://automarket.sitecraft.agency";
const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = new URL(readArg("--base-url", "http://127.0.0.1:4349"));
const canonicalOrigin = new URL(readArg("--canonical-origin", DEFAULT_CANONICAL_ORIGIN));
const requestedLocale = readArg("--locale", "de");
const strictSeoReleaseLocales = ["en", "fr"];
const strictSeoRelease = strictSeoReleaseLocales.includes(requestedLocale);
const requireEdgeCache = args.includes("--require-edge-cache");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const decodeXml = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", "\"")
  .replaceAll("&apos;", "'");
const stripTags = (value) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function request(path, expectedStatus = 200) {
  const url = new URL(path, baseUrl);
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, { headers: { Accept: "text/html,application/xml;q=0.9" }, redirect: "follow" });
    if (![429, 502, 503, 504].includes(response.status) || attempt === 2) break;
    await response.arrayBuffer();
    await sleep(700 * (attempt + 1));
  }
  assert.ok(response, `No response for ${url}`);
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${url.pathname} returned ${response.status}: ${body.slice(0, 180)}`);
  await sleep(450);
  return { response, body, url };
}

async function assertDeviceLocalePage(acceptLanguage, expectedLocale) {
  const url = new URL("/", baseUrl);
  const response = await fetch(url, {
    headers: { Accept: "text/html", "Accept-Language": acceptLanguage },
    redirect: "manual",
  });
  const body = await response.text();
  assert.equal(response.status, 200, `Device locale ${acceptLanguage} did not keep the complete homepage available`);
  assert.equal(response.headers.has("location"), false, `Device locale ${acceptLanguage} unexpectedly redirected`);
  assert.match(body, new RegExp(`<html[^>]+lang=["']${expectedLocale}["']`, "i"));
  assert.match(body, /data-locale-switcher/);
  assert.match(body, /<option value="(?:de|en|ru|uk|ar|tr|fr)"/);
}

async function assertLegacyInventoryPreserved(path) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    headers: { Accept: "text/html", "Accept-Language": "de-DE,de;q=0.9" },
    redirect: "manual",
  });
  assert.equal(response.status, 200, `Legacy inventory route ${path} must stay available until its redirect target is ready`);
  assert.equal(response.headers.has("location"), false, `Legacy inventory route ${path} redirected before readiness`);
  await response.arrayBuffer();
}

function assertPublicCacheHeaders(result) {
  assert.match(result.response.headers.get("cache-control") || "", /private, max-age=0, must-revalidate/i);
  const cloudflareCacheControl = result.response.headers.get("cloudflare-cdn-cache-control");
  if (cloudflareCacheControl) assert.match(cloudflareCacheControl, /public, max-age=\d+/i);
}

async function assertEdgeCacheHit(path) {
  let lastStatus = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(new URL(path, baseUrl), { headers: { Accept: "application/xml" } });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    lastStatus = response.headers.get("cf-cache-status") || "";
    if (["HIT", "STALE", "REVALIDATED"].includes(lastStatus.toUpperCase())) return;
    await sleep(700);
  }
  assert.fail(`Cloudflare edge cache did not serve ${path}; last status: ${lastStatus || "missing"}`);
}

function assertIndexableHtml(result, canonicalPath, type = "CollectionPage") {
  assert.match(result.response.headers.get("content-type") || "", /text\/html/i);
  assert.match(result.response.headers.get("x-robots-tag") || "", /index, follow/i);
  assert.doesNotMatch(result.body, /<meta[^>]+name=["']robots["'][^>]+noindex/i);
  const canonical = new URL(canonicalPath, canonicalOrigin).toString();
  assert.ok(result.body.includes(`<link rel="canonical" href="${canonical}">`), `Missing canonical ${canonical}`);
  const heading = result.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  assert.ok(stripTags(heading?.[1] || ""), `Missing H1 on ${canonicalPath}`);
  assert.ok(result.body.includes(`"@type":"${type}"`), `Missing ${type} JSON-LD on ${canonicalPath}`);
  assert.match(result.body, new RegExp(`<html[^>]+lang=["']${requestedLocale}["'][^>]+dir=["']ltr["']`, "i"));
  assertPublicCacheHeaders(result);
}

function assertInclusiveCatalogHtml(result, canonicalPath) {
  assert.match(result.response.headers.get("content-type") || "", /text\/html/i);
  assert.match(result.response.headers.get("x-robots-tag") || "", /noindex/i);
  assert.match(result.body, /<meta[^>]+name=["']robots["'][^>]+noindex/i);
  const canonical = new URL(canonicalPath, canonicalOrigin).toString();
  assert.ok(result.body.includes(`<link rel="canonical" href="${canonical}">`), `Missing canonical ${canonical}`);
  const cards = result.body.match(/<article class="[^"]*public-car-card/g) || [];
  assert.ok(cards.length > 1, `${canonicalPath} did not expose the complete multi-listing catalog`);
  assert.match(result.body, /data-favorite-card/);
  assert.match(result.response.headers.get("cache-control") || "", /private, no-store/i);
  const cloudflareCacheControl = result.response.headers.get("cloudflare-cdn-cache-control");
  if (cloudflareCacheControl) assert.match(cloudflareCacheControl, /no-store/i);
  if (requireEdgeCache) {
    assert.match(
      result.response.headers.get("cf-cache-status") || "",
      /^(?:BYPASS|DYNAMIC)$/i,
      `${canonicalPath} must bypass Cloudflare edge caching`,
    );
  }
}

function assertStrictCatalogHtml(result, canonicalPath, type) {
  assertIndexableHtml(result, canonicalPath, type);
  const cards = result.body.match(/<article class="[^"]*public-car-card/g) || [];
  assert.ok(cards.length > 1, `${canonicalPath} did not expose the complete translated catalog`);
  assert.match(result.body, /data-favorite-card/);
}

await assertDeviceLocalePage("de-DE,de;q=0.9,en;q=0.8", "de");
await assertDeviceLocalePage("fr-FR,fr;q=0.9,en;q=0.8", "fr");
await assertDeviceLocalePage("ar-SA,ar;q=0.9", "ar");
await assertDeviceLocalePage("hi-IN,hi;q=0.9", "en");
await assertLegacyInventoryPreserved("/cars/");

const sitemapIndex = await request("/sitemap.xml");
assert.match(sitemapIndex.response.headers.get("content-type") || "", /application\/xml/i);
assert.match(sitemapIndex.body, /<sitemapindex/);
const sitemapLocations = [...sitemapIndex.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1]));
const localeSitemapLocation = sitemapLocations.find((value) => new URL(value).pathname === `/sitemaps/${requestedLocale}.xml`);
assert.ok(localeSitemapLocation, `Sitemap index has no ${requestedLocale} sitemap`);

const sitemapResult = await request(new URL(localeSitemapLocation).pathname);
assert.match(sitemapResult.response.headers.get("content-type") || "", /application\/xml/i);
assert.match(sitemapResult.body, /<urlset/);
const sitemapUrls = [...sitemapResult.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1]));
assert.ok(sitemapUrls.length > 0, "Sitemap has no URLs");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "Sitemap contains duplicate URLs");
assert.equal(sitemapUrls.some((value) => new URL(value).search), false, "Sitemap contains query URLs");
assert.equal(sitemapUrls.every((value) => new URL(value).origin === canonicalOrigin.origin), true, "Sitemap contains a non-canonical origin");

const paths = sitemapUrls.map((value) => new URL(value).pathname);
const localePrefix = `/${requestedLocale}`;
const vehiclePath = paths.find((path) => new RegExp(`^/${requestedLocale}/cars/[^/]+/$`).test(path));

const homePath = `${localePrefix}/`;
const catalogPath = `${localePrefix}/cars/`;
const home = await request(homePath);
if (strictSeoRelease) assertStrictCatalogHtml(home, homePath, "WebPage");
else assertInclusiveCatalogHtml(home, homePath);
const catalog = await request(catalogPath);
if (strictSeoRelease) assertStrictCatalogHtml(catalog, catalogPath, "CollectionPage");
else assertInclusiveCatalogHtml(catalog, catalogPath);

if (strictSeoRelease) {
  for (const result of [home, catalog]) {
    for (const locale of ["de", ...strictSeoReleaseLocales]) {
      assert.ok(result.body.includes(`hreflang="${locale}"`), `${result.url.pathname} has no ${locale} hreflang`);
    }
    assert.ok(result.body.includes('hreflang="x-default"'), `${result.url.pathname} has no x-default hreflang`);
  }
  const reciprocalGermanHome = await request("/de/");
  for (const locale of strictSeoReleaseLocales) {
    assert.ok(reciprocalGermanHome.body.includes(`hreflang="${locale}"`), `German home has no reciprocal ${locale} hreflang`);
  }
  const reciprocalStrictHome = await request(`/${requestedLocale === "en" ? "fr" : "en"}/`);
  assert.ok(reciprocalStrictHome.body.includes(`hreflang="${requestedLocale}"`), "Strict locale homes are not reciprocal");
}

const checked = ["/sitemap.xml", new URL(localeSitemapLocation).pathname, homePath, catalogPath];

if (vehiclePath) {
  const vehicle = await request(vehiclePath);
  assertIndexableHtml(vehicle, vehiclePath, "Vehicle");
  assert.equal(vehicle.response.headers.get("x-sitecraft-query-count"), "1");
  assert.ok(stripTags(vehicle.body).length > 100, "Vehicle page has no localized content");
  assert.ok(vehicle.body.includes(`hreflang="${requestedLocale}"`), "Vehicle page has no self hreflang");
  assert.ok(vehicle.body.includes('hreflang="x-default"'), "Vehicle page has no x-default hreflang");
  if (!strictSeoRelease) assert.doesNotMatch(vehicle.body, /hreflang=["'](?:en|ru|uk|tr|ar|fr)["']/i);
  await assertLegacyInventoryPreserved(vehiclePath.replace(`/${requestedLocale}/`, "/"));
  checked.push(vehiclePath);
}

if (strictSeoRelease) {
  for (const path of paths.filter((candidate) => !checked.includes(candidate))) {
    const result = await request(path);
    const type = new RegExp(`^/${requestedLocale}/cars/[^/]+/$`).test(path)
      ? "Vehicle"
      : path === `/${requestedLocale}/` || /^\/(?:en|fr)\/(?:sell|pricing|support|privacy|impressum)\/$/.test(path)
        ? "WebPage"
        : "CollectionPage";
    assertIndexableHtml(result, path, type);
    assert.ok(result.body.includes(`hreflang="${requestedLocale}"`), `${path} has no self hreflang`);
    for (const locale of strictSeoReleaseLocales) {
      assert.ok(result.body.includes(`hreflang="${locale}"`), `${path} has no reciprocal ${locale} hreflang`);
    }
    assert.ok(result.body.includes('hreflang="x-default"'), `${path} has no x-default hreflang`);
    checked.push(path);
  }
  assert.equal(paths.every((path) => checked.includes(path)), true, "Not every sitemap URL passed the HTML readiness smoke test");
}

const unpublishedLocaleCode = "tr";
const unpublishedLocale = await request(`/${unpublishedLocaleCode}/`, 404);
assert.match(unpublishedLocale.response.headers.get("x-robots-tag") || "", /noindex/i);
assert.match(unpublishedLocale.response.headers.get("cache-control") || "", /no-store/i);
checked.push(unpublishedLocale.url.pathname);

if (requireEdgeCache) await assertEdgeCacheHit("/sitemap.xml");

console.log(JSON.stringify({
  ok: true,
  baseUrl: baseUrl.origin,
  locale: requestedLocale,
  checked,
  inventoryRoutesChecked: { inclusiveHome: !strictSeoRelease, inclusiveCatalog: !strictSeoRelease, strictSeoRelease, vehicle: Boolean(vehiclePath) },
  deviceLocalePagesChecked: ["de-DE", "fr-FR", "ar-SA", "hi-IN"],
  edgeCacheChecked: requireEdgeCache,
  legacyInventoryPreserved: true,
  requestAuthentication: "none",
}, null, 2));
