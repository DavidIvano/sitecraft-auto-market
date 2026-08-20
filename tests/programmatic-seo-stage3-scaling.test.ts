import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SeoCatalogContractError,
  buildCompatibilityLocalizedCatalogPage,
  normalizeBoundedLocalizedCatalogPage,
  resolveLocalizedCatalogPage,
} from "../src/lib/seo/catalogApi.ts";
import {
  SITEMAP_LISTING_SHARD_SIZE,
  SeoSitemapContractError,
  normalizeSeoListingSitemapShard,
  normalizeSeoSitemapManifest,
} from "../src/lib/seo/sitemapApi.ts";
import { renderSitemapIndex, renderUrlSet } from "../src/lib/seo/sitemapXml.ts";
import type { CarListing } from "../src/lib/types.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const car = (id: number): CarListing => ({
  id,
  slug: `catalog-car-${id}`,
  title: `Catalog car ${id}`,
  description: "Localized public listing",
  brand: "Audi",
  model: "A3",
  year: 2020,
  mileage: 80_000,
  fuel_type: "petrol",
  body_type: "suv",
  transmission: "automatic",
  price: 4_500,
  currency: "EUR",
  city: "Peine",
  country: "DE",
  status: "approved",
  moderation_status: "approved",
  available_locales: ["de", "en"],
  updated_at: `2026-08-${String((id % 20) + 1).padStart(2, "0")}T10:00:00.000Z`,
});

test("bounded localized catalogue validates exact pages and resolves self-canonical crawlable pagination", () => {
  const payload = normalizeBoundedLocalizedCatalogPage({
    items: [car(25)],
    pagination: { page: 2, limit: 24, total: 25, total_pages: 2 },
    ready_locales: ["de", "en"],
    related_groups: [{
      type: "fuel",
      items: [{ type: "fuel", slug: "petrol", code: "petrol", label: "Petrol", count: 25 }],
    }],
  }, { locale: "de", requestedPage: 2 });
  assert.equal(payload.items.length, 1);
  assert.equal(payload.dataSource, "xano_bounded");

  const resolved = resolveLocalizedCatalogPage({
    locale: "de",
    url: new URL("https://example.test/de/cars/?page=2"),
    catalog: payload,
    previewNoindex: false,
  });
  assert.equal(resolved.status, "ok");
  if (resolved.status === "ok") {
    assert.equal(resolved.canonicalPath, "/de/cars/?page=2");
    assert.equal(resolved.noindex, false);
    assert.equal(resolved.previousPath, "/de/cars/");
    assert.equal(resolved.nextPath, null);
    assert.ok(resolved.relatedGroups.some((group) => group.links.some((link) => link.href === "/de/cars/fuel/petrol/")));
  }
});

test("catalogue page one duplicate redirects while filters are noindex with an unfiltered canonical", () => {
  const catalogue = normalizeBoundedLocalizedCatalogPage({
    items: [car(1), car(2), car(3)],
    pagination: { page: 1, limit: 24, total: 3, total_pages: 1 },
    ready_locales: ["de"],
    related_groups: [],
  }, { locale: "de", requestedPage: 1 });
  assert.deepEqual(resolveLocalizedCatalogPage({
    locale: "de",
    url: new URL("https://example.test/de/cars/?page=1"),
    catalog: catalogue,
  }), { status: "redirect", location: "/de/cars/" });

  const filtered = resolveLocalizedCatalogPage({
    locale: "de",
    url: new URL("https://example.test/de/cars/?brand=audi&fuel=diesel"),
    catalog: catalogue,
    previewNoindex: false,
  });
  assert.equal(filtered.status, "ok");
  if (filtered.status === "ok") {
    assert.equal(filtered.noindex, true);
    assert.equal(filtered.filteredQuery, true);
    assert.equal(filtered.canonicalPath, "/de/cars/");
  }
});

test("catalogue contract fails closed on oversized, incomplete or locale-stale payloads", () => {
  assert.throws(() => normalizeBoundedLocalizedCatalogPage({
    items: [car(1)],
    pagination: { page: 1, limit: 25, total: 1, total_pages: 1 },
    ready_locales: ["de"],
  }, { locale: "de", requestedPage: 1 }), SeoCatalogContractError);

  assert.throws(() => normalizeBoundedLocalizedCatalogPage({
    items: [car(1)],
    pagination: { page: 1, limit: 24, total: 2, total_pages: 1 },
    ready_locales: ["de"],
  }, { locale: "de", requestedPage: 1 }), SeoCatalogContractError);

  assert.throws(() => normalizeBoundedLocalizedCatalogPage({
    items: [car(1)],
    pagination: { page: 1, limit: 24, total: 1, total_pages: 1 },
    ready_locales: ["en"],
  }, { locale: "de", requestedPage: 1 }), SeoCatalogContractError);
});

test("compatibility catalogue is sliced to the same 24-card SSR contract", () => {
  const cars = Array.from({ length: 25 }, (_, index) => car(index + 1));
  const first = buildCompatibilityLocalizedCatalogPage(cars, { locale: "de", page: 1 });
  const second = buildCompatibilityLocalizedCatalogPage(cars, { locale: "de", page: 2 });
  assert.equal(first?.items.length, 24);
  assert.equal(second?.items.length, 1);
  assert.equal(second?.total, 25);
  assert.equal(buildCompatibilityLocalizedCatalogPage(cars, { locale: "de", page: 3 }), null);
});

test("sitemap manifest requires every expected locale, exact shard math and one bounded root index", () => {
  const manifest = normalizeSeoSitemapManifest({
    generated_at: "2026-08-20T12:00:00.000Z",
    locales: [
      { locale: "de", generation: "g-20260820", listing_total: 10_001, shard_size: 10_000, shard_count: 2, lastmod: "2026-08-20T10:00:00Z" },
      { locale: "en", generation: "g-20260820", listing_total: 0, shard_size: 10_000, shard_count: 0, lastmod: null },
    ],
  }, ["de", "en"]);
  assert.equal(manifest.locales[0]?.shardCount, 2);
  assert.equal(manifest.locales[1]?.shardCount, 0);

  assert.throws(() => normalizeSeoSitemapManifest({ locales: [
    { locale: "de", generation: "g1", listing_total: 10_001, shard_size: 10_000, shard_count: 1 },
  ] }, ["de"]), SeoSitemapContractError);
  assert.throws(() => normalizeSeoSitemapManifest({ locales: [
    { locale: "de", generation: "g1", listing_total: 1, shard_size: 10_000, shard_count: 1 },
  ] }, ["de", "en"]), SeoSitemapContractError);

  const tooLarge = Array.from({ length: 5 }, (_, index) => ({
    locale: `l${index}`,
    generation: "g1",
    listing_total: 100_000_000,
    shard_size: 10_000,
    shard_count: 10_000,
  }));
  assert.throws(() => normalizeSeoSitemapManifest({ locales: tooLarge }, tooLarge.map((item) => item.locale)), /sitemap index limit/);
});

test("immutable listing shards accept only exact 10,000-sized pagination and unique public slugs", () => {
  const shard = normalizeSeoListingSitemapShard({
    locale: "de",
    generation: "g-20260820",
    items: [{ slug: "catalog-car-10001", lastmod: "2026-08-20T10:00:00Z" }],
    pagination: { page: 2, limit: SITEMAP_LISTING_SHARD_SIZE, total: 10_001, total_pages: 2 },
  }, { locale: "de", generation: "g-20260820", requestedPage: 2 });
  assert.equal(shard?.items[0]?.slug, "catalog-car-10001");

  assert.throws(() => normalizeSeoListingSitemapShard({
    locale: "de",
    generation: "g-20260820",
    items: [{ slug: "same-slug" }, { slug: "same-slug" }],
    pagination: { page: 1, limit: 10_000, total: 2, total_pages: 1 },
  }, { locale: "de", generation: "g-20260820", requestedPage: 1 }), SeoSitemapContractError);

  assert.throws(() => normalizeSeoListingSitemapShard({
    locale: "de",
    generation: "wrong",
    items: [],
    pagination: { page: 1, limit: 10_000, total: 0, total_pages: 1 },
  }, { locale: "de", generation: "g-20260820", requestedPage: 1 }), SeoSitemapContractError);
});

test("sitemap XML renderers escape canonical URLs and never emit nested indexes", () => {
  const index = renderSitemapIndex([{ loc: "https://example.test/sitemaps/de.xml?a=1&b=2", lastmod: null }]);
  assert.match(index, /<sitemapindex/);
  assert.match(index, /a=1&amp;b=2/);
  assert.doesNotMatch(index, /<urlset/);

  const set = renderUrlSet([{ loc: "https://example.test/de/cars/a&b/", lastmod: "2026-08-20T10:00:00Z" }]);
  assert.match(set, /<urlset/);
  assert.match(set, /a&amp;b/);
});

test("Stage 3 routes, flags and Xano drafts stay bounded, additive and privacy-minimized", () => {
  const routes = read("src/lib/apiRoutes.ts");
  const config = read("src/lib/config.ts");
  const client = read("src/lib/xano.ts");
  const catalogRoute = read("src/lib/seo/catalogRoute.ts");
  const rootSitemap = read("src/pages/sitemap.xml.ts");
  const localeSitemap = read("src/pages/sitemaps/[locale].xml.ts");
  const shardRoute = read("src/pages/sitemaps/[locale]/listings/[generation]/[page].xml.ts");
  const schema = read("docs/xano/programmatic-seo-stage-3/01_additive_schema.xs");
  const catalogueDraft = read("docs/xano/programmatic-seo-stage-3/GET_public_locale_catalog.draft.xs");
  const shardDraft = read("docs/xano/programmatic-seo-stage-3/GET_public_locale_sitemap_listings.draft.xs");

  assert.match(routes, /\/public\/locale\/catalog/);
  assert.match(routes, /\/public\/seo\/sitemap\/manifest/);
  assert.match(routes, /\/public\/locale\/sitemap\/listings/);
  assert.match(config, /PUBLIC_SEO_CATALOG_API_ENABLED === "true"/);
  assert.match(config, /PUBLIC_SEO_SITEMAP_SHARDS_ENABLED === "true"/);
  assert.match(client, /Math\.min\(24/);
  assert.match(client, /Math\.min\(10_000/);
  assert.match(catalogRoute, /loadCompatibilityCatalog/);
  assert.match(rootSitemap, /listings\/\$\{localeManifest\.generation\}/);
  assert.match(rootSitemap, /renderSitemapIndex/);
  assert.match(localeSitemap, /shardedMode \? "xano_pages_only"/);
  assert.match(shardRoute, /renderUrlSet/);
  assert.match(shardRoute, /X-SiteCraft-Sitemap-Generation/);
  assert.match(schema, /table seo_listing_locale_index/);
  assert.match(schema, /table seo_sitemap_locale_generations/);
  assert.match(catalogueDraft, /int\? limit\?=24 filters=min:1\|max:24/);
  assert.match(shardDraft, /int\? limit\?=10000 filters=min:10000\|max:10000/);
  assert.doesNotMatch(shardDraft, /seller_email|seller_phone|description|image_url|OpenAI/i);
  JSON.parse(read("docs/xano/programmatic-seo-stage-3/public-contract.json"));
});

test("production defaults stay off after the verified Stage 3 endpoint release", () => {
  const env = read(".env.example");
  const manifest = read("docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md");
  for (const name of [
    "PUBLIC_SEO_CATALOG_API_ENABLED",
    "PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED",
    "PUBLIC_SEO_SITEMAP_SHARDS_ENABLED",
    "PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED",
  ]) assert.match(env, new RegExp(`${name}=false`));
  assert.match(manifest, /4020327[\s\S]*public\/locale\/catalog/);
  assert.match(manifest, /4020328[\s\S]*public\/locale\/sitemap\/listings/);
  assert.match(manifest, /4020329[\s\S]*public\/seo\/sitemap\/manifest/);
  assert.match(manifest, /g20260820canary1/);
});
