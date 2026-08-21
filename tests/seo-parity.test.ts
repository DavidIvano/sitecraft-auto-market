import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSeoParityDiff,
  listingSlugs,
  localeListingShardLocations,
  parityIsReady,
  sitemapLocations,
  sitemapVehicleSlugs,
} from "../scripts/lib/seo-parity.mjs";

test("SEO parity compares public Xano, localized Xano and sitemap slugs", () => {
  const expected = listingSlugs({ items: [{ slug: "bmw-1" }, { slug: "audi-2" }, { slug: "bmw-1" }] });
  const localized = listingSlugs([{ slug: "bmw-1" }]);
  const sitemap = sitemapVehicleSlugs("<urlset><url><loc>https://automarket.sitecraft.agency/de/cars/bmw-1/</loc></url></urlset>", "de");
  const diff = buildSeoParityDiff(expected, localized, sitemap);
  assert.deepEqual(diff.missing_in_localized_xano, ["audi-2"]);
  assert.deepEqual(diff.missing_in_sitemap, ["audi-2"]);
  assert.equal(parityIsReady(diff), false);
});

test("SEO parity is ready only for identical non-duplicated inventories", () => {
  const values = ["audi-2", "bmw-1"];
  assert.equal(parityIsReady(buildSeoParityDiff(values, values, values)), true);
});

test("SEO parity discovers listing shards and compares the bounded catalog", () => {
  const index = `<sitemapindex>
    <sitemap><loc>https://automarket.sitecraft.agency/sitemaps/de.xml</loc></sitemap>
    <sitemap><loc>https://automarket.sitecraft.agency/sitemaps/de/listings/generation-1/1.xml</loc></sitemap>
    <sitemap><loc>https://automarket.sitecraft.agency/sitemaps/en/listings/generation-1/1.xml</loc></sitemap>
  </sitemapindex>`;
  assert.equal(sitemapLocations(index).length, 3);
  assert.deepEqual(localeListingShardLocations(index, "de"), [
    "https://automarket.sitecraft.agency/sitemaps/de/listings/generation-1/1.xml",
  ]);
  const expected = ["audi-2", "bmw-1"];
  const diff = buildSeoParityDiff(expected, expected, expected, ["bmw-1"]);
  assert.deepEqual(diff.missing_in_bounded_catalog, ["audi-2"]);
  assert.equal(parityIsReady(diff), false);
});
