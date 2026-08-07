import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createLocaleCacheKey } from "../src/i18n/cache.ts";
import {
  projectGermanCatalog,
  resolvePublicListingLocale,
  toGermanPublicListing,
} from "../src/i18n/publicListing.ts";
import {
  getRelease3ConfigErrors,
  isGermanPublicRouteEnabled,
  readRelease3Flags,
  type Release3Flags,
} from "../src/i18n/release3.ts";
import { buildGermanVehicleSeo } from "../src/lib/seo/germanVehicleSeo.ts";
import { normalizeLocale } from "../src/i18n/locale.ts";
import { isValidPublicCarSlug } from "../src/lib/publicCar.ts";
import type { CarListing } from "../src/lib/types.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const disabledFlags: Release3Flags = {
  I18N_ENABLED: false,
  I18N_API_READ_ENABLED: false,
  I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED: false,
  I18N_DUAL_WRITE_ENABLED: false,
  I18N_PUBLIC_ROUTES_ENABLED: false,
  I18N_AI_TRANSLATION_ENABLED: false,
  I18N_LOCALE_DE_ENABLED: false,
  I18N_LOCALE_EN_ENABLED: false,
  I18N_LOCALE_UK_ENABLED: false,
  I18N_LOCALE_ZH_HANS_ENABLED: false,
};

const germanPreviewFlags: Release3Flags = {
  ...disabledFlags,
  I18N_ENABLED: true,
  I18N_API_READ_ENABLED: true,
  I18N_PUBLIC_ROUTES_ENABLED: true,
  I18N_LOCALE_DE_ENABLED: true,
};

const listing = (overrides: Partial<CarListing> = {}): CarListing => ({
  id: 94,
  slug: "synthetic-hatchback-94",
  title: "Synthetischer Kompaktwagen",
  description: "Geprüftes synthetisches Fahrzeug ohne personenbezogene Daten.",
  brand: "Testmarke",
  model: "Kompakt",
  year: 2024,
  mileage: 1000,
  price: 25000,
  currency: "EUR",
  city: "Berlin",
  country: "DE",
  fuel_type: "electric",
  transmission: "automatic",
  body_type: "hatchback",
  status: "approved",
  moderation_status: "approved",
  source_locale: "de",
  translation_version: 1,
  translations_ready: false,
  translation: {
    requested_locale: "de",
    resolved_locale: "de",
    source_locale: "de",
    is_fallback: false,
    status: "original",
    translation_version: 1,
  },
  ...overrides,
});

test("all Release 3 locale flags default to false", () => {
  assert.deepEqual(readRelease3Flags({}), disabledFlags);
  const env = read("../.env.example");
  for (const flag of Object.keys(disabledFlags)) {
    assert.match(env, new RegExp(`^${flag}=false$`, "m"));
  }
  assert.equal(isGermanPublicRouteEnabled(disabledFlags), false);
});

test("German public enablement rejects every incomplete or forbidden dependency combination", () => {
  assert.ok(getRelease3ConfigErrors({ ...disabledFlags, I18N_LOCALE_DE_ENABLED: true }).length >= 3);
  assert.match(
    getRelease3ConfigErrors({ ...germanPreviewFlags, I18N_PUBLIC_ROUTES_ENABLED: false }).join(" "),
    /I18N_PUBLIC_ROUTES_ENABLED/,
  );
  assert.match(
    getRelease3ConfigErrors({ ...germanPreviewFlags, I18N_API_READ_ENABLED: false }).join(" "),
    /I18N_API_READ_ENABLED/,
  );
  assert.match(
    getRelease3ConfigErrors({ ...germanPreviewFlags, I18N_AI_TRANSLATION_ENABLED: true }).join(" "),
    /cannot depend on I18N_AI_TRANSLATION_ENABLED/,
  );
  assert.match(
    getRelease3ConfigErrors({ ...disabledFlags, I18N_LOCALE_EN_ENABLED: true }).join(" "),
    /outside the Release 3 scope/,
  );
  assert.deepEqual(getRelease3ConfigErrors(germanPreviewFlags), []);
  assert.equal(isGermanPublicRouteEnabled(germanPreviewFlags), true);
});

test("German routes are server-gated and non-German Release 3 routes do not exist", () => {
  for (const path of ["../src/pages/de/index.astro", "../src/pages/de/cars/index.astro", "../src/pages/de/cars/[slug].astro"]) {
    const route = read(path);
    assert.match(route, /if \(!GERMAN_PUBLIC_ROUTES_ENABLED\)/);
    assert.match(route, /Astro\.response\.status = 404/);
    assert.match(route, /Astro\.rewrite\("\/404"\)/);
  }
  for (const locale of ["en", "uk", "zh-Hans"]) {
    assert.equal(existsSync(new URL(`../src/pages/${locale}/index.astro`, import.meta.url)), false);
  }
  const worker = read("../scripts/prepare-cloudflare-pages.mjs");
  assert.match(worker, /localeRoute !== "de"/);
  assert.match(worker, /localeRoute === "de" && !enabled\(env\.I18N_API_READ_ENABLED\)/);
  assert.match(worker, /localeRoute === "de" && enabled\(env\.I18N_AI_TRANSLATION_ENABLED\)/);
});

test("malformed locales and traversal-like slugs are rejected", () => {
  for (const value of ["../de", "%2Fde", "de/../ru", "de?locale=ru", "unknown", "zh-Hans%00"]) {
    assert.equal(normalizeLocale(value, { activeOnly: true }), null);
  }
  for (const value of ["../secret", "%2Fsecret", "de/cars", "slug?locale=ru", "slug#fragment", ""]) {
    assert.equal(isValidPublicCarSlug(value), false);
  }
});

test("locale resolution distinguishes source, translated, unavailable, stale, pending and failed", () => {
  assert.equal(resolvePublicListingLocale(listing()).translation_status, "source");

  const translated = listing({
    source_locale: "ru",
    translations_ready: true,
    translation_version: 2,
    translation: {
      requested_locale: "de",
      resolved_locale: "de",
      source_locale: "ru",
      is_fallback: false,
      status: "reviewed",
      translation_version: 2,
    },
  });
  assert.equal(resolvePublicListingLocale(translated).translation_status, "translated");
  assert.ok(toGermanPublicListing(translated));

  for (const [status, expected] of [
    ["missing", "unavailable"],
    ["pending", "pending"],
    ["failed", "failed"],
  ] as const) {
    const candidate = listing({
      source_locale: "ru",
      translations_ready: false,
      translation: {
        requested_locale: "de",
        resolved_locale: "de",
        source_locale: "ru",
        is_fallback: false,
        status,
        translation_version: 1,
      },
    });
    assert.equal(resolvePublicListingLocale(candidate).translation_status, expected);
    assert.equal(toGermanPublicListing(candidate), null);
  }

  const stale = listing({
    source_locale: "ru",
    translations_ready: true,
    translation_version: 2,
    translation: {
      requested_locale: "de",
      resolved_locale: "de",
      source_locale: "ru",
      is_fallback: false,
      status: "reviewed",
      translation_version: 1,
    },
  });
  assert.equal(resolvePublicListingLocale(stale).translation_status, "stale");
  assert.equal(toGermanPublicListing(stale), null);
});

test("German projection refuses silent fallback, empty content, and private fields", () => {
  const fallback = listing({
    source_locale: "ru",
    translation: {
      requested_locale: "de",
      resolved_locale: "ru",
      source_locale: "ru",
      is_fallback: true,
      status: "original",
      translation_version: 1,
    },
  });
  const fallbackResolution = resolvePublicListingLocale(fallback);
  assert.equal(fallbackResolution.fallback_used, true);
  assert.equal(toGermanPublicListing(fallback), null);
  assert.equal(toGermanPublicListing(listing({ description: "" })), null);

  const projected = toGermanPublicListing(listing({
    user_id: 777,
    seller_email: "private@example.invalid",
    seller_phone: "+49123456789",
  }));
  assert.ok(projected);
  assert.doesNotMatch(
    JSON.stringify(projected),
    /"(?:user_id|seller_email|seller_phone|email|phone|token|role|credits|translation_source_hash|prompt|provider_request_id)"/i,
  );
  assert.equal(projectGermanCatalog([listing(), fallback]).length, 1);
});

test("German SEO uses a German canonical and complete structured data", () => {
  const projected = toGermanPublicListing(listing());
  assert.ok(projected);
  const seo = buildGermanVehicleSeo(projected);
  assert.equal(seo.canonicalUrl, "https://automarket.sitecraft.agency/de/cars/synthetic-hatchback-94/");
  assert.match(seo.title, /kaufen/);
  assert.match(seo.description, /25\.000/);
  assert.equal(seo.vehicle["@type"], "Vehicle");
  assert.equal(seo.offer["@type"], "Offer");
  assert.equal(seo.breadcrumb["@type"], "BreadcrumbList");

  const layout = read("../src/layouts/BaseLayout.astro");
  assert.match(layout, /hreflang=\{alternate\.locale\}/);
  assert.match(layout, /hreflang="x-default"/);
  const sitemap = read("../src/pages/sitemap.xml.ts");
  assert.match(sitemap, /GERMAN_PUBLIC_ROUTES_ENABLED \? \[/);
  assert.match(sitemap, /projectGermanCatalog/);
});

test("cache keys isolate locale, version, flags, and actor scope", () => {
  const base = {
    route: "/cars/:slug",
    listingIdentity: 94,
    requestedLocale: "de",
    resolvedLocale: "de",
    translationVersion: 1,
    actorScope: "public" as const,
    flags: germanPreviewFlags,
  };
  const key = createLocaleCacheKey(base);
  assert.notEqual(key, createLocaleCacheKey({ ...base, requestedLocale: "ru", resolvedLocale: "ru" }));
  assert.notEqual(key, createLocaleCacheKey({ ...base, translationVersion: 2 }));
  assert.notEqual(key, createLocaleCacheKey({ ...base, actorScope: "admin-test" }));
  assert.notEqual(key, createLocaleCacheKey({ ...base, flags: { ...germanPreviewFlags, I18N_LOCALE_DE_ENABLED: false } }));
});

test("German catalog and detail reads are bounded and never call a translation provider", () => {
  const catalog = read("../src/pages/de/cars/index.astro");
  const detail = read("../src/pages/de/cars/[slug].astro");
  assert.equal((catalog.match(/getApprovedCars\(/g) || []).length, 1);
  assert.equal((detail.match(/getCarBySlug\(/g) || []).length, 1);
  assert.match(catalog, /X-SiteCraft-Query-Count", "1"/);
  assert.match(detail, /X-SiteCraft-Query-Count", "1"/);
  assert.doesNotMatch(`${catalog}\n${detail}`, /OpenAI|generateTranslation|translation provider/i);
});

test("candidate Xano locale reads are additive, bounded, fail-closed, and privacy-minimized", () => {
  const routes = read("../src/lib/apiRoutes.ts");
  const client = read("../src/lib/xano.ts");
  const catalog = read("../docs/xano/multilingual-stage-10/release-3/GET_public_locale_cars.xs");
  const detail = read("../docs/xano/multilingual-stage-10/release-3/GET_public_locale_cars_slug.xs");
  assert.match(routes, /localizedCars: "\/public\/locale\/cars"/);
  assert.match(routes, /localizedCarBySlug/);
  assert.match(client, /API_ROUTES\.localizedCars/);
  assert.match(client, /API_ROUTES\.localizedCarBySlug/);

  for (const source of [catalog, detail]) {
    assert.match(source, /\$input\.locale == "de"/);
    assert.match(source, /source_hash == \$car\.translation_source_hash/);
    assert.match(source, /translation_status == "reviewed"/);
    assert.match(source, /is_fallback\s+: false/);
    assert.doesNotMatch(source, /translation_jobs|OPENAI|prompt|provider_request|auth token/i);
    assert.doesNotMatch(source, /seller_phone|seller_email|contact_phone|contact_email|password|oauth|credits/i);
  }
  assert.equal((catalog.match(/db\.query car_listings/g) || []).length, 1);
  assert.equal((catalog.match(/db\.query car_listing_translations/g) || []).length, 1);
  assert.equal((detail.match(/db\.get car_listings/g) || []).length, 1);
  assert.equal((detail.match(/db\.query car_listing_translations/g) || []).length, 1);
  assert.equal((detail.match(/db\.query car_listing_images/g) || []).length, 1);
});
