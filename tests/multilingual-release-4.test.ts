import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_LOCALE, localeDefinitions, publicLocaleDefinitions, validateLocaleDefinitions } from "../src/i18n/config.ts";
import { getRelease4ConfigErrors, isPublicLocaleRouteEnabled, readRelease4Flags } from "../src/i18n/release4.ts";
import { toPublicListingForLocale } from "../src/i18n/publicListing.ts";
import { applyListingTranslation } from "../src/lib/listingTranslation.ts";
import { buildLocalizedVehicleSeo } from "../src/lib/seo/vehicleSeo.ts";
import { normalizePublicCarListing } from "../src/lib/publicCar.ts";
import type { CarListing } from "../src/lib/types.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const enabledFlags = readRelease4Flags({ I18N_ENABLED: "true", I18N_API_READ_ENABLED: "true", I18N_PUBLIC_ROUTES_ENABLED: "true" });

test("Release 4 configures every official EU language plus existing additional locales", () => {
  const eu = ["bg", "hr", "cs", "da", "nl", "en", "et", "fi", "fr", "de", "el", "hu", "ga", "it", "lv", "lt", "mt", "pl", "pt", "ro", "sk", "sl", "es", "sv"];
  const codes = new Set(localeDefinitions.map((locale) => locale.code));
  for (const code of [...eu, "ru", "uk", "tr", "ar", "zh-Hans"]) assert.ok(codes.has(code), code);
  assert.equal(localeDefinitions.length, 29);
  assert.equal(DEFAULT_LOCALE, "de");
  assert.deepEqual(validateLocaleDefinitions(localeDefinitions), []);
  assert.deepEqual(publicLocaleDefinitions.map((locale) => locale.code), ["de", "en", "fr"]);
});

test("public route rollout uses global gates plus registry and complete dictionaries", () => {
  assert.deepEqual(getRelease4ConfigErrors(readRelease4Flags({ I18N_PUBLIC_ROUTES_ENABLED: "true" })).length, 1);
  assert.equal(isPublicLocaleRouteEnabled("de", enabledFlags), true);
  assert.equal(isPublicLocaleRouteEnabled("en", enabledFlags), true);
  assert.equal(isPublicLocaleRouteEnabled("fr", enabledFlags), true);
  assert.equal(isPublicLocaleRouteEnabled("unknown", enabledFlags), false);
});

test("locale pages are universal and copied locale route trees are absent", () => {
  for (const route of ["../src/pages/[locale]/index.astro", "../src/pages/[locale]/cars/index.astro", "../src/pages/[locale]/cars/[slug].astro"]) {
    assert.equal(existsSync(new URL(route, import.meta.url)), true);
    assert.match(read(route), /isPublicLocaleRouteEnabled/);
  }
  assert.equal(existsSync(new URL("../src/pages/de/index.astro", import.meta.url)), false);
});

test("localized public pages use server metadata and never depend on post-render translation", () => {
  const layout = read("../src/layouts/BaseLayout.astro");
  const middleware = read("../src/middleware.ts");
  assert.match(layout, /isLocalePrefixedRoute \? schemaItems/);
  assert.match(layout, /pageAlternates\.map/);
  assert.doesNotMatch(layout, /SUPPORTED_LOCALES\.map\(\(code\) => <link rel="alternate"/);
  assert.match(middleware, /if \(getLocaleFromPath\(context\.url\.pathname\)\) return next\(\)/);
  assert.match(middleware, /SAFE_LEGACY_REDIRECT_PATH/);
  assert.doesNotMatch(middleware, /SAFE_LEGACY_REDIRECT_PATH = [^\n]*cars/);
});

test("generic listing readiness rejects stale and fallback translations", () => {
  const source: CarListing = {
    id: 1, slug: "test-1", title: "Test", description: "Beschreibung", brand: "Test", model: "One",
    year: 2024, mileage: 1, price: 1, currency: "EUR", city: "Berlin", country: "DE",
    fuel_type: "electric", transmission: "automatic", status: "approved", source_locale: "ru",
    translation_version: 2, translations_ready: true,
    translation: { requested_locale: "de", resolved_locale: "de", source_locale: "ru", is_fallback: false, status: "reviewed", translation_version: 2 },
  };
  assert.ok(toPublicListingForLocale(source, "de"));
  assert.equal(toPublicListingForLocale({ ...source, translation_version: 3 }, "de"), null);
  assert.equal(toPublicListingForLocale({ ...source, translation: { ...source.translation!, resolved_locale: "ru", is_fallback: true } }, "de"), null);
});

test("published Xano completed translation contract normalizes into a ready locale listing", () => {
  const normalized = normalizePublicCarListing({
    id: 96,
    slug: "audi-80-2026-75",
    title: "Audi 80 2026",
    description: "Исходное описание",
    brand: "Audi",
    model: "80",
    year: 2026,
    mileage: 1000,
    price: 10000,
    currency: "EUR",
    city: "Berlin",
    country: "DE",
    fuel_type: "petrol",
    transmission: "manual",
    status: "approved",
    moderation_status: "approved",
    source_locale: "ru",
    translation_version: 1,
    translations_ready: true,
    available_locales: ["de"],
    translation: {
      locale: "de",
      requested_locale: "de",
      resolved_locale: "de",
      source_locale: "ru",
      source_hash: "source-v1",
      resolved_source_hash: "source-v1",
      status: "completed",
      translation_status: "translated",
      readiness: "ready",
      translation_version: 1,
      is_fallback: false,
      content: { title: "Audi 80 Baujahr 2026", description: "Geprüfte deutsche Beschreibung." },
    },
  });
  assert.ok(normalized);
  const projected = toPublicListingForLocale(applyListingTranslation(normalized, "de"), "de");
  assert.ok(projected);
  assert.equal(projected.title, "Audi 80 Baujahr 2026");
  const seo = buildLocalizedVehicleSeo(projected, "de");
  assert.equal(seo.heading, "Audi 80 Baujahr 2026");
  assert.equal(seo.vehicle.name, "Audi 80 Baujahr 2026");
  assert.deepEqual(projected.available_locales, ["de"]);
});

test("sitemap is an index and each locale sitemap performs one bounded Xano read", () => {
  const index = read("../src/pages/sitemap.xml.ts");
  const localized = read("../src/pages/sitemaps/[locale].xml.ts");
  assert.match(index, /<sitemapindex/);
  assert.equal((localized.match(/getLocalizedApprovedCars\(/g) || []).length, 1);
  assert.match(localized, /projectCatalogForLocale/);
  assert.match(localized, /translation_updated_at/);
});
