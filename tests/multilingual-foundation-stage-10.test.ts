import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getLocaleFallbackChain,
  getLocaleFromAcceptLanguage,
  getLocaleFromCookie,
  getLocaleFromPath,
  normalizeLocale,
  resolveLocale,
} from "../src/i18n/locale.ts";
import { registerLocale } from "../src/i18n/config.ts";
import { formatCurrency, formatDate, formatMileage } from "../src/i18n/format.ts";
import { getLocalizedPath, withLocale } from "../src/i18n/routes.ts";
import { translate } from "../src/i18n/translate.ts";
import {
  fuelTypeCodes,
  getVehicleTaxonomyLabel,
  getVehicleTaxonomyOptions,
  isVehicleTaxonomyCode,
} from "../src/domain/vehicleTaxonomy.ts";
import { mapLegacyVehicleValue } from "../src/migrations/legacyVehicleValueMap.ts";
import { normalizePublicCarListing } from "../src/lib/publicCar.ts";

test("locale registry supports BCP 47 codes without a closed language union", () => {
  registerLocale({ code: "zh-Hant", baseLanguage: "zh", nativeName: "繁體中文", englishName: "Traditional Chinese", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: false, isDefault: false, sortOrder: 60 });
  registerLocale({ code: "pt-BR", baseLanguage: "pt", nativeName: "Português do Brasil", englishName: "Brazilian Portuguese", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: false, isDefault: false, sortOrder: 70 });
  registerLocale({ code: "fr", baseLanguage: "fr", nativeName: "Français", englishName: "French", direction: "ltr", fallbackLocale: "de", isActive: false, isPublic: false, isDefault: false, sortOrder: 80 });

  assert.equal(normalizeLocale("de"), "de");
  assert.equal(normalizeLocale("ZH_hans"), "zh-Hans");
  assert.equal(normalizeLocale("zh-Hant"), "zh-Hant");
  assert.equal(normalizeLocale("pt_BR"), "pt-BR");
  assert.equal(normalizeLocale("unknown"), null);
  assert.equal(normalizeLocale("fr", { activeOnly: true }), null);
});

test("locale resolution follows URL, user, cookie, Accept-Language and default priority", () => {
  assert.equal(getLocaleFromPath("/uk/cars/audi-a3"), "uk");
  assert.equal(getLocaleFromCookie("theme=dark; sitecraft-locale=zh-Hans"), "zh-Hans");
  assert.equal(getLocaleFromAcceptLanguage("fr;q=0.9, en-US;q=0.8, de;q=0.7"), "en");
  assert.equal(resolveLocale({ pathname: "/uk/cars", user: { preferred_locale: "en" }, cookieHeader: "sitecraft-locale=de" }), "uk");
  assert.equal(resolveLocale({ pathname: "/dashboard", user: { preferred_locale: "en" }, cookieHeader: "sitecraft-locale=de" }), "en");
  assert.equal(resolveLocale({ pathname: "/dashboard", cookieHeader: "sitecraft-locale=uk" }), "uk");
  assert.equal(resolveLocale({ pathname: "/dashboard", acceptLanguage: "zh-CN, en;q=0.8" }), "zh-Hans");
  assert.equal(resolveLocale({ pathname: "/dashboard" }), "de");
});

test("fallback chains are deterministic and never select an arbitrary translation", () => {
  assert.deepEqual(getLocaleFallbackChain("uk"), ["uk", "de"]);
  assert.deepEqual(getLocaleFallbackChain("zh-Hans"), ["zh-Hans", "en", "de"]);
  assert.equal(translate("uk", "cars.contactSeller"), "Зв’язатися з продавцем");
  assert.equal(translate("zh-Hans", "cars.contactSeller"), "联系卖家");
  assert.equal(translate("de", "missing.key"), "missing.key");
});

test("locale route and query helpers preserve existing query parameters", () => {
  assert.equal(withLocale("/cars?page=2", "zh-Hans"), "/cars?page=2&locale=zh-Hans");
  assert.equal(withLocale("/cars", "unknown"), "/cars");
  assert.equal(getLocalizedPath("/cars/audi-a3", "uk"), "/uk/cars/audi-a3");
  assert.equal(getLocalizedPath("/de/cars/audi-a3", "en"), "/en/cars/audi-a3");
});

test("formatters use requested locale rather than a global ru-RU locale", () => {
  assert.match(formatCurrency(5000, "EUR", "de"), /5\.000/);
  assert.match(formatMileage(220000, "en"), /220,000 km/);
  assert.match(formatDate("2026-07-30T12:00:00Z", "uk"), /2026/);
});

test("taxonomy stores stable codes and resolves labels per locale", () => {
  assert.ok(fuelTypeCodes.includes("diesel"));
  assert.equal(isVehicleTaxonomyCode("fuel_type", "diesel"), true);
  assert.equal(isVehicleTaxonomyCode("fuel_type", "Дизель"), false);
  assert.equal(getVehicleTaxonomyLabel("fuel_type", "diesel", "de"), "Diesel");
  assert.equal(getVehicleTaxonomyLabel("fuel_type", "diesel", "en"), "Diesel");
  assert.equal(getVehicleTaxonomyLabel("fuel_type", "diesel", "uk"), "Дизель");
  assert.equal(getVehicleTaxonomyLabel("fuel_type", "diesel", "zh-Hans"), "柴油");
  assert.deepEqual(getVehicleTaxonomyOptions("transmission", "en").map((option) => option.value), ["manual", "automatic", "automated_manual", "cvt"]);
});

test("legacy mapping normalizes case, whitespace, ё and multilingual aliases without guessing", () => {
  assert.deepEqual(mapLegacyVehicleValue("fuel_type", "  БЕНЗИН  "), { code: "petrol", migration_status: "mapped", legacy_value: "БЕНЗИН" });
  assert.equal(mapLegacyVehicleValue("color", "Жёлтый").code, "yellow");
  assert.equal(mapLegacyVehicleValue("transmission", "Automatik").code, "automatic");
  assert.equal(mapLegacyVehicleValue("fuel_type", "diesel").migration_status, "already_canonical");
  assert.deepEqual(mapLegacyVehicleValue("body_type", ""), { code: null, migration_status: "empty" });
  assert.deepEqual(mapLegacyVehicleValue("body_type", "Неизвестный кузов"), { code: null, migration_status: "needs_review", legacy_value: "Неизвестный кузов" });
});

test("public listing translation metadata is validated as one atomic locale resolution", () => {
  const listing = normalizePublicCarListing({
    id: 95,
    slug: "audi-a3-2018-95",
    title: "Audi A3 in gutem Zustand",
    brand: "Audi",
    model: "A3",
    year: 2018,
    mileage: 90000,
    fuel_type: "diesel",
    transmission: "automatic",
    price: 15000,
    currency: "EUR",
    city: "Berlin",
    country: "DE",
    status: "approved",
    moderation_status: "approved",
    locale: "uk",
    source_locale: "de",
    translation: { requested_locale: "uk", resolved_locale: "uk", source_locale: "de", is_fallback: false, status: "reviewed" },
  });
  assert.equal(listing?.locale, "uk");
  assert.deepEqual(listing?.translation, { requested_locale: "uk", resolved_locale: "uk", source_locale: "de", is_fallback: false, status: "reviewed" });

  const invalid = normalizePublicCarListing({ ...listing, translation: { requested_locale: "uk", resolved_locale: "zh-Hans" } });
  assert.equal(invalid?.translation, undefined);
});

test("Release 1 schema is additive and feature flags remain disabled", () => {
  const schema = readFileSync(new URL("../docs/xano/multilingual-stage-10/01_additive_schema.xs", import.meta.url), "utf8");
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const routes = JSON.parse(readFileSync(new URL("../public/_routes.json", import.meta.url), "utf8")) as { include: string[] };
  const pagesBuild = readFileSync(new URL("../scripts/prepare-cloudflare-pages.mjs", import.meta.url), "utf8");
  for (const table of ["locales", "taxonomy_translations", "car_listing_translations", "translation_jobs", "content_migration_logs"]) {
    assert.match(schema, new RegExp(`table ${table} \\{`));
  }
  assert.match(schema, /btree\|unique[^\n]+car_listing_id[^\n]+locale_code/);
  assert.match(schema, /btree\|unique[^\n]+idempotency_key/);
  for (const flag of ["I18N_ENABLED", "I18N_API_READ_ENABLED", "I18N_DUAL_WRITE_ENABLED", "I18N_PUBLIC_ROUTES_ENABLED", "I18N_AI_TRANSLATION_ENABLED"]) {
    assert.match(env, new RegExp(`${flag}=false`));
  }
  assert.deepEqual(routes.include, ["/*"]);
  assert.match(pagesBuild, /localeRoute && \(!enabled\(env\.I18N_ENABLED\)/);
  assert.match(pagesBuild, /status: 404/);
});
