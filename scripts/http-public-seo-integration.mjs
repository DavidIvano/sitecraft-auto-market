import assert from "node:assert/strict";

const DEFAULT_CANONICAL_ORIGIN = "https://automarket.sitecraft.agency";
const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = new URL(readArg("--base-url", "http://127.0.0.1:4349"));
const canonicalOrigin = new URL(readArg("--canonical-origin", DEFAULT_CANONICAL_ORIGIN));

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

function assertIndexableHtml(result, canonicalPath, type = "CollectionPage") {
  assert.match(result.response.headers.get("content-type") || "", /text\/html/i);
  assert.match(result.response.headers.get("x-robots-tag") || "", /index, follow/i);
  assert.doesNotMatch(result.body, /<meta[^>]+name=["']robots["'][^>]+noindex/i);
  const canonical = new URL(canonicalPath, canonicalOrigin).toString();
  assert.ok(result.body.includes(`<link rel="canonical" href="${canonical}">`), `Missing canonical ${canonical}`);
  const heading = result.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  assert.ok(stripTags(heading?.[1] || ""), `Missing H1 on ${canonicalPath}`);
  assert.ok(result.body.includes(`"@type":"${type}"`), `Missing ${type} JSON-LD on ${canonicalPath}`);
}

const sitemapResult = await request("/sitemap.xml");
assert.match(sitemapResult.response.headers.get("content-type") || "", /application\/xml/i);
assert.match(sitemapResult.body, /^<\?xml version="1\.0"/);
const sitemapUrls = [...sitemapResult.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1]));
assert.ok(sitemapUrls.length > 0, "Sitemap has no URLs");
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "Sitemap contains duplicate URLs");
assert.equal(sitemapUrls.some((value) => new URL(value).search), false, "Sitemap contains query URLs");
assert.equal(sitemapUrls.every((value) => new URL(value).origin === canonicalOrigin.origin), true, "Sitemap contains a non-canonical origin");

const paths = sitemapUrls.map((value) => new URL(value).pathname);
const brandPath = paths.find((path) => path.split("/").filter(Boolean).length === 3 && path.startsWith("/cars/brand/"));
const modelPath = paths.find((path) => path.split("/").filter(Boolean).length === 4 && path.startsWith("/cars/brand/"));
const vehiclePath = paths.find((path) => /^\/cars\/[^/]+$/.test(path) && path !== "/cars");
assert.ok(brandPath, "Sitemap has no brand page");
assert.ok(modelPath, "Sitemap has no model page");
assert.ok(vehiclePath, "Sitemap has no vehicle page");

const catalog = await request("/cars");
assertIndexableHtml(catalog, "/cars");
assert.ok(catalog.body.includes(`href="${brandPath}"`), "Catalog has no crawlable link to the tested brand");

const brand = await request(brandPath);
assertIndexableHtml(brand, brandPath);
assert.ok(brand.body.includes(`href="${modelPath}"`), "Brand page has no crawlable model link");

const model = await request(modelPath);
assertIndexableHtml(model, modelPath);
assert.match(model.body, /class="[^"]*public-car-card/);

const vehicle = await request(vehiclePath);
assertIndexableHtml(vehicle, vehiclePath, "Vehicle");

const missingBrand = await request("/cars/brand/definitely-not-a-real-brand-zzzz", 404);
assert.match(missingBrand.response.headers.get("x-robots-tag") || "", /noindex/i);

console.log(JSON.stringify({
  ok: true,
  baseUrl: baseUrl.origin,
  checked: ["/sitemap.xml", "/cars", brandPath, modelPath, vehiclePath, missingBrand.url.pathname],
  requestAuthentication: "none",
}, null, 2));
