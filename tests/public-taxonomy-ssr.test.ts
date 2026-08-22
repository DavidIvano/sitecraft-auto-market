import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setPublicNoStoreHeaders } from "../src/lib/publicCache.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("legacy brand and model routes normalize known facets and permanently redirect to localized canonicals", () => {
  for (const path of ["src/pages/cars/brand/[brand].astro", "src/pages/cars/brand/[brand]/[model].astro"]) {
    const page = readProjectFile(path);
    assert.match(page, /export const prerender = false/);
    assert.match(page, /getApprovedCars\(\{ requireConfigured: true \}\)/);
    assert.match(page, /isValidVehicleFacetSlug/);
    assert.match(page, /normalizeVehicleFacetSlug/);
    assert.match(page, /Astro\.response\.status = 404/);
    assert.match(page, /Astro\.response\.status = 503/);
    assert.match(page, /Astro\.redirect\([^;]+, 308\)/s);
    assert.match(page, /DEFAULT_LOCALE/);
    assert.doesNotMatch(page, /canonicalPath=|<CarCard|<BaseLayout/);
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
    assert.match(route, /loadLocalizedSeoTaxonomyPage/);
    assert.match(route, /X-SiteCraft-Taxonomy-Source/);
    assert.match(route, /resolution\.dataSource === "compatibility_catalog"/);
    assert.match(route, /setPublicNoStoreHeaders/);
    assert.match(route, /"noindex, follow"/);
    assert.match(route, /Astro\.response\.status = 404/);
    assert.match(route, /Astro\.response\.status = 503/);
  }
  assert.match(genericRoute, /isNewSeoTaxonomyType/);
  assert.match(pageResolver, /isSeoTaxonomyFacetIndexable/);
  assert.match(resolver, /getLocalizedSeoTaxonomyPagePayload/);
  assert.match(resolver, /normalizeBoundedSeoTaxonomyPage/);
  assert.match(resolver, /SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED/);
  assert.match(resolver, /getLocalizedApprovedCars\(locale\)/);
  assert.match(resolver, /getApprovedCars\(locale, \{ requireConfigured: true \}\)/);
  assert.match(sitemap, /getIndexableSeoTaxonomyFacets/);
  assert.match(sitemap, /getTaxonomyBasePath/);
  assert.match(sitemap, /indexablePagePaths/);
  assert.doesNotMatch(sitemap, /\/cars\?brand=/);
});

test("compatibility responses cannot poison the public edge cache", () => {
  const indexableHeaders = new Headers();
  setPublicNoStoreHeaders(indexableHeaders);
  assert.equal(indexableHeaders.get("cache-control"), "private, no-store");
  assert.equal(indexableHeaders.get("cloudflare-cdn-cache-control"), "no-store");
  assert.equal(indexableHeaders.get("x-robots-tag"), "index, follow");

  const filteredHeaders = new Headers();
  setPublicNoStoreHeaders(filteredHeaders, true, "noindex, follow");
  assert.equal(filteredHeaders.get("cloudflare-cdn-cache-control"), "no-store");
  assert.equal(filteredHeaders.get("x-robots-tag"), "noindex, follow");

  const catalog = readProjectFile("src/pages/[locale]/cars/index.astro");
  const rootSitemap = readProjectFile("src/pages/sitemap.xml.ts");
  const localeSitemap = readProjectFile("src/pages/sitemaps/[locale].xml.ts");
  assert.match(catalog, /resolution\.dataSource === "compatibility_catalog"/);
  assert.match(catalog, /setPublicNoStoreHeaders/);
  assert.match(rootSitemap, /if \(manifest\) setPublicCacheHeaders/);
  assert.match(rootSitemap, /else setPublicNoStoreHeaders/);
  assert.match(localeSitemap, /if \(shardedMode\) setPublicCacheHeaders/);
  assert.match(localeSitemap, /else setPublicNoStoreHeaders/);
});

test("HTTP integration harness is public-only and covers local runtime plus production smoke", () => {
  const harness = readProjectFile("scripts/http-public-seo-integration.mjs");
  const runner = readProjectFile("scripts/run-cloudflare-http-integration.mjs");
  const workflow = readProjectFile(".github/workflows/cloudflare-pages.yml");
  const packageJson = readProjectFile("package.json");
  assert.doesNotMatch(harness, /Authorization|Cookie|authToken|localStorage/);
  assert.match(harness, /\/sitemap\.xml/);
  assert.match(harness, /--deployment-cache-bust/);
  assert.match(harness, /--require-authoritative/);
  assert.match(harness, /xano_sharded/);
  assert.match(harness, /xano_pages_only/);
  assert.match(harness, /xano_slug_shard/);
  assert.match(harness, /xano_bounded/);
  assert.match(harness, /minimumRequestIntervalMs = requireAuthoritative \? 2_100 : 0/);
  assert.match(harness, /withDeploymentCacheBust/);
  assert.match(harness, /assertInclusiveCatalogHtml/);
  assert.match(harness, /deviceLocalePagesChecked/);
  assert.match(runner, /wrangler/);
  assert.match(runner, /pages", "dev"/);
  assert.match(workflow, /--deployment-cache-bust/);
  assert.match(workflow, /--require-authoritative/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.match(packageJson, /"test:http:local"/);
  assert.match(packageJson, /"test:http:production"/);
});
