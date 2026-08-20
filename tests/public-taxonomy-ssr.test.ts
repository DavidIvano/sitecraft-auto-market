import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("brand and model routes are on-demand SSR with canonical metadata and fail-closed states", () => {
  for (const path of ["src/pages/cars/brand/[brand].astro", "src/pages/cars/brand/[brand]/[model].astro"]) {
    const page = readProjectFile(path);
    assert.match(page, /export const prerender = false/);
    assert.match(page, /getApprovedCars\(\{ requireConfigured: true \}\)/);
    assert.match(page, /isValidVehicleFacetSlug/);
    assert.match(page, /Astro\.response\.status = 404/);
    assert.match(page, /Astro\.response\.status = 503/);
    assert.match(page, /X-Robots-Tag", "index, follow"/);
    assert.match(page, /canonicalPath=\{seo\.path\}/);
    assert.match(page, /jsonLd=\{\[seo\.collection, seo\.breadcrumb\]\}/);
    assert.match(page, /<h1>\{seo\.heading\}<\/h1>/);
    assert.match(page, /<CarCard/);
  }
});

test("localized taxonomy routes share one gate and one route resolver", () => {
  const brandRoute = readProjectFile("src/pages/[locale]/cars/brand/[brand].astro");
  const modelRoute = readProjectFile("src/pages/[locale]/cars/brand/[brand]/[model].astro");
  const cityRoute = readProjectFile("src/pages/[locale]/cars/city/[city].astro");
  const genericRoute = readProjectFile("src/pages/[locale]/cars/[taxonomy]/[slug].astro");
  const resolver = readProjectFile("src/lib/seo/taxonomyRoute.ts");
  const pageResolver = readProjectFile("src/lib/seo/taxonomyPage.ts");
  const sitemap = readProjectFile("src/pages/sitemaps/[locale].xml.ts");
  for (const route of [brandRoute, modelRoute, cityRoute, genericRoute]) {
    assert.match(route, /loadLocalizedSeoTaxonomyCatalog/);
    assert.match(route, /resolveSeoTaxonomyPage/);
    assert.match(route, /"noindex, follow"/);
    assert.match(route, /Astro\.response\.status = 404/);
    assert.match(route, /Astro\.response\.status = 503/);
  }
  assert.match(genericRoute, /isNewSeoTaxonomyType/);
  assert.match(pageResolver, /isSeoTaxonomyFacetIndexable/);
  assert.match(resolver, /getLocalizedApprovedCars\(locale\)/);
  assert.match(resolver, /getApprovedCars\(locale, \{ requireConfigured: true \}\)/);
  assert.match(sitemap, /getIndexableSeoTaxonomyFacets/);
  assert.match(sitemap, /getTaxonomyBasePath/);
  assert.match(sitemap, /indexablePagePaths/);
  assert.doesNotMatch(sitemap, /\/cars\?brand=/);
});

test("HTTP integration harness is public-only and covers local runtime plus production smoke", () => {
  const harness = readProjectFile("scripts/http-public-seo-integration.mjs");
  const runner = readProjectFile("scripts/run-cloudflare-http-integration.mjs");
  const packageJson = readProjectFile("package.json");
  assert.doesNotMatch(harness, /Authorization|Cookie|authToken|localStorage/);
  assert.match(harness, /\/sitemap\.xml/);
  assert.match(harness, /assertInclusiveCatalogHtml/);
  assert.match(harness, /deviceLocalePagesChecked/);
  assert.match(runner, /wrangler/);
  assert.match(runner, /pages", "dev"/);
  assert.match(packageJson, /"test:http:local"/);
  assert.match(packageJson, /"test:http:production"/);
});
