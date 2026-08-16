import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasCompleteVehicleTaxonomy } from "../src/domain/vehicleTaxonomy.ts";
import {
  STAGE3_EU_RELEASE_BATCHES,
  STAGE3_PRIMARY_RELEASE_ORDER,
  evaluateLocaleRelease,
  getStaticLocaleReleaseReadiness,
  isStrictSeoReleaseLocale,
} from "../src/i18n/releaseStage3.ts";
import { hasPublicStaticPageDictionary } from "../src/i18n/staticPages.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("stage 3 release order is explicit and released static assets are complete", () => {
  assert.deepEqual(STAGE3_PRIMARY_RELEASE_ORDER, ["en", "fr", "tr", "ar", "ru", "uk"]);
  assert.deepEqual(getStaticLocaleReleaseReadiness("en"), {
    configured: true,
    uiReady: true,
    publicPagesReady: true,
    staticPagesReady: true,
    taxonomyReady: true,
  });
  assert.equal(hasPublicStaticPageDictionary("en"), true);
  assert.equal(hasCompleteVehicleTaxonomy("en"), true);
  assert.equal(isStrictSeoReleaseLocale("en"), true);
  assert.deepEqual(getStaticLocaleReleaseReadiness("fr"), {
    configured: true,
    uiReady: true,
    publicPagesReady: true,
    staticPagesReady: true,
    taxonomyReady: true,
  });
  assert.equal(hasPublicStaticPageDictionary("fr"), true);
  assert.equal(hasCompleteVehicleTaxonomy("fr"), true);
  assert.equal(isStrictSeoReleaseLocale("fr"), true);
  assert.equal(isStrictSeoReleaseLocale("de"), true);
  assert.equal(isStrictSeoReleaseLocale("tr"), true);
  assert.equal(isStrictSeoReleaseLocale("ar"), true);
  assert.equal(isStrictSeoReleaseLocale("ru"), true);
  assert.equal(isStrictSeoReleaseLocale("uk"), true);
  for (const locale of [
    "tr", "ar", "ru", "uk", "nl", "da", "sv", "fi", "es", "pt", "it",
    "pl", "cs", "sk", "sl", "bg", "hr", "ro", "hu", "el", "et", "lv", "lt", "mt", "ga",
  ] as const) {
    assert.deepEqual(getStaticLocaleReleaseReadiness(locale), {
      configured: true,
      uiReady: true,
      publicPagesReady: true,
      staticPagesReady: true,
      taxonomyReady: true,
    });
    assert.equal(hasPublicStaticPageDictionary(locale), true);
    assert.equal(hasCompleteVehicleTaxonomy(locale), true);
  }
});

test("a locale cannot pass without full listing, sitemap, canonical, hreflang and smoke evidence", () => {
  const incomplete = evaluateLocaleRelease("en", {
    publicListingCount: 10,
    readyListingCount: 9,
    sitemapReady: true,
    canonicalReady: true,
    reciprocalHreflangReady: false,
    smokeReady: false,
  });
  assert.equal(incomplete.ready, false);
  assert.deepEqual(incomplete.blockers, ["listingTranslationsReady", "reciprocalHreflangReady", "smokeReady"]);

  const complete = evaluateLocaleRelease("en", {
    publicListingCount: 10,
    readyListingCount: 10,
    sitemapReady: true,
    canonicalReady: true,
    reciprocalHreflangReady: true,
    smokeReady: true,
  });
  assert.equal(complete.ready, true);
  assert.deepEqual(complete.blockers, []);
});

test("strict SEO releases use translated inventory and index every canonical route", () => {
  for (const path of [
    "../src/pages/[locale]/index.astro",
    "../src/pages/[locale]/cars/index.astro",
    "../src/pages/[locale]/cars/brand/[brand].astro",
    "../src/pages/[locale]/cars/brand/[brand]/[model].astro",
    "../src/pages/[locale]/cars/city/[city].astro",
  ]) {
    const source = read(path);
    assert.match(source, /isStrictSeoReleaseLocale/);
    assert.match(source, /getLocalizedApprovedCars/);
  }
  const sitemap = read("../src/pages/sitemaps/[locale].xml.ts");
  assert.match(sitemap, /indexablePagePaths/);
  assert.match(sitemap, /brandPaths/);
  assert.match(sitemap, /modelPaths/);
  assert.match(sitemap, /cityPaths/);
  assert.match(sitemap, /isStrictSeoReleaseLocale/);
});

test("localized cards and x-default links point to their equivalent canonical routes", () => {
  const cards = read("../src/lib/publicCarCard.ts");
  const detail = read("../src/pages/[locale]/cars/[slug].astro");
  const catalog = read("../src/pages/[locale]/cars/index.astro");
  assert.match(cards, /startsWith\("localized_"\)/);
  assert.match(cards, /\`\/\$\{encodeURIComponent\(locale\)\}\/cars\/\$\{encodeURIComponent\(value\)\}\/\`/);
  assert.match(detail, /xDefaultPath=\{\`\/cars\/\$\{car\.slug\}\/\`\}/);
  assert.match(catalog, /xDefaultPath="\/cars\/"/);
});

test("Xano locale release is dry-run first and counts current per-locale translations", () => {
  const release = read("../docs/xano/multilingual/translation-worker/POST_translations_internal_locales_release.xs");
  const catalog = read("../docs/xano/multilingual-release-4/live/GET_public_locale_cars.xs");
  const detail = read("../docs/xano/multilingual-release-4/live/GET_public_locale_cars_slug.xs");
  assert.match(release, /bool\? dry_run\?=true/);
  assert.match(release, /ready_listing_count == \$public_listing_count/);
  assert.match(release, /source_hash == \$source_hash/);
  assert.match(release, /data = \{updated_at: now, is_public: true\}/);
  assert.doesNotMatch(catalog, /elseif \(\(\$car\.translations_ready/);
  assert.doesNotMatch(detail, /elseif \(\(\$car\.translations_ready/);
  assert.doesNotMatch(catalog, /\$car\.(?:seo_title|seo_description|image_alt_texts)/);
  assert.doesNotMatch(detail, /\$car\.(?:seo_title|seo_description|image_alt_texts)/);
});

test("HTTP release smoke covers every released strict locale and Arabic directionality", () => {
  const source = read("../scripts/http-public-seo-integration.mjs");
  for (const locale of ["de", "en", "fr", "tr", "ar", "ru", "uk", ...STAGE3_EU_RELEASE_BATCHES.flat()]) {
    assert.match(source, new RegExp(`"${locale}"`));
  }
  assert.match(source, /requestedLocale === "ar" \? "rtl" : "ltr"/);
  assert.match(source, /publicSitemapLocales/);
});
