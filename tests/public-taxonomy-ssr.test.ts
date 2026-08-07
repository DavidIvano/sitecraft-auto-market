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

test("catalog exposes crawlable brand links and sitemap includes brand and model URLs", () => {
  const catalog = readProjectFile("src/pages/cars/index.astro");
  const sitemap = readProjectFile("src/pages/sitemap.xml.ts");
  assert.match(catalog, /buildVehicleTaxonomy\(cars\)/);
  assert.match(catalog, /href=\{`\/cars\/brand\/\$\{brand\.slug\}`\}/);
  assert.match(sitemap, /buildVehicleTaxonomy\(cars\)/);
  assert.match(sitemap, /`\/cars\/brand\/\$\{brand\.slug\}`/);
  assert.match(sitemap, /`\/cars\/brand\/\$\{brand\.slug\}\/\$\{model\.slug\}`/);
  assert.doesNotMatch(sitemap, /\/cars\?brand=/);
});

test("HTTP integration harness is public-only and covers local runtime plus production smoke", () => {
  const harness = readProjectFile("scripts/http-public-seo-integration.mjs");
  const runner = readProjectFile("scripts/run-cloudflare-http-integration.mjs");
  const packageJson = readProjectFile("package.json");
  assert.doesNotMatch(harness, /Authorization|Cookie|authToken|localStorage/);
  assert.match(harness, /\/sitemap\.xml/);
  assert.match(harness, /\/cars\/brand\//);
  assert.match(harness, /CollectionPage/);
  assert.match(runner, /wrangler/);
  assert.match(runner, /pages", "dev"/);
  assert.match(packageJson, /"test:http:local"/);
  assert.match(packageJson, /"test:http:production"/);
});
