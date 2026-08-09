import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BACKEND_VALUE_CATALOG,
  getBackendValueOptions,
  normalizeBackendValue,
  toLegacyRussianValue,
  translateBackendValue,
} from "../src/i18n/backendValues.ts";
import { AR_TR_TRANSLATIONS } from "../src/i18n/arTrTranslations.ts";
import { getCatalogMessages } from "../src/i18n/catalogMessages.ts";
import { getDetailMessages } from "../src/i18n/detailMessages.ts";
import { getMessages, interpolate, UI_MESSAGES } from "../src/i18n/messages.ts";
import {
  EU_OFFICIAL_LOCALES,
  LOCALE_DIRECTIONS,
  SELECTABLE_LOCALES,
  resolveContentLocale,
  resolveLocale,
  resolveRequestLocale,
  SUPPORTED_LOCALES,
} from "../src/i18n/locales.ts";
import { formatOwnersCount, formatSellerType, formatTuvDetail } from "../src/lib/listingDisplay.ts";
import { applyListingTranslation, normalizeListingTranslation } from "../src/lib/listingTranslation.ts";
import { renderPublicCarCardMarkup } from "../src/lib/publicCarCard.ts";
import type { CarListing } from "../src/lib/types.ts";

test("the migration supports all six documented locales and Arabic RTL", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["de", "ru", "uk", "en", "ar", "tr"]);
  assert.equal(resolveLocale("de-DE"), "de");
  assert.equal(resolveLocale("uk-UA"), "uk");
  assert.equal(resolveLocale("ar-SA"), "ar");
  assert.equal(resolveLocale("tr-TR"), "tr");
  assert.equal(LOCALE_DIRECTIONS.ar, "rtl");
  assert.equal(LOCALE_DIRECTIONS.tr, "ltr");
  assert.equal(resolveLocale("unsupported"), "ru");
});

test("the language menu exposes every official EU language with a safe content fallback", () => {
  assert.equal(EU_OFFICIAL_LOCALES.length, 24);
  assert.equal(SELECTABLE_LOCALES.length, 28);
  for (const locale of EU_OFFICIAL_LOCALES) assert.ok(SELECTABLE_LOCALES.includes(locale));
  assert.equal(resolveContentLocale("fr"), "en");
  assert.equal(resolveContentLocale("pl"), "en");
  assert.equal(getMessages("fr"), getMessages("en"));
  assert.equal(getCatalogMessages("es"), getCatalogMessages("en"));
  assert.equal(getDetailMessages("it"), getDetailMessages("en"));
});

test("live Russian Xano values normalize to stable language-neutral codes", () => {
  assert.equal(normalizeBackendValue("fuel_type", "Бензин"), "petrol");
  assert.equal(normalizeBackendValue("transmission", "Автомат"), "automatic");
  assert.equal(normalizeBackendValue("body_type", "Седан"), "sedan");
  assert.equal(normalizeBackendValue("drivetrain", "Передний"), "front_wheel_drive");
  assert.equal(normalizeBackendValue("color", "Чёрный"), "black");
  assert.equal(normalizeBackendValue("seller_type", "Частное лицо"), "private");
  assert.equal(normalizeBackendValue("country", "Германия"), "DE");
});

test("canonical backend codes render in every supported page language", () => {
  assert.equal(translateBackendValue("fuel_type", "petrol", "de"), "Benzin");
  assert.equal(translateBackendValue("fuel_type", "petrol", "ru"), "Бензин");
  assert.equal(translateBackendValue("fuel_type", "petrol", "uk"), "Бензин");
  assert.equal(translateBackendValue("fuel_type", "petrol", "en"), "Petrol");
  assert.notEqual(translateBackendValue("fuel_type", "petrol", "ar"), "Бензин");
  assert.notEqual(translateBackendValue("fuel_type", "petrol", "tr"), "Бензин");
  assert.equal(translateBackendValue("country", "DE", "de"), "Deutschland");
  assert.equal(translateBackendValue("country", "DE", "en"), "Germany");
});

test("canonical options never use translated labels as submitted values", () => {
  for (const field of Object.keys(BACKEND_VALUE_CATALOG) as Array<keyof typeof BACKEND_VALUE_CATALOG>) {
    const options = getBackendValueOptions(field, "ru");
    assert.ok(options.length > 0);
    for (const option of options) {
      assert.match(option.value, /^[a-z0-9_]+$|^[A-Z]{2}$/);
      assert.notEqual(option.value, option.label);
    }
  }
});

test("legacy write adapter preserves production behavior during the Xano rollout", () => {
  assert.equal(toLegacyRussianValue("fuel_type", "petrol"), "Бензин");
  assert.equal(toLegacyRussianValue("transmission", "automatic"), "Автомат");
  assert.equal(toLegacyRussianValue("body_type", "Седан"), "Седан");
  assert.equal(toLegacyRussianValue("country", "DE"), "Германия");
});

test("unknown provider values remain visible instead of being silently erased", () => {
  assert.equal(normalizeBackendValue("fuel_type", "synthetic_fuel"), "synthetic_fuel");
  assert.equal(translateBackendValue("fuel_type", "synthetic_fuel", "de"), "synthetic_fuel");
});

test("query language wins over the saved cookie and unsupported device languages fall back to English", () => {
  assert.equal(resolveRequestLocale(new URL("https://example.test/?lang=de"), "uk"), "de");
  assert.equal(resolveRequestLocale(new URL("https://example.test/"), "uk"), "uk");
  assert.equal(resolveRequestLocale(new URL("https://example.test/?lang=invalid"), "en"), "en");
  assert.equal(resolveRequestLocale(new URL("https://example.test/"), undefined, "ar-SA,ar;q=0.9"), "ar");
  assert.equal(resolveRequestLocale(new URL("https://example.test/"), undefined, "fr-FR,fr;q=0.9"), "fr");
  assert.equal(resolveRequestLocale(new URL("https://example.test/"), undefined, "hi-IN,hi;q=0.9"), "en");
});

test("every supported language has a complete interface dictionary", () => {
  const russianKeys = Object.keys(UI_MESSAGES.ru).sort();
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(UI_MESSAGES[locale]).sort(), russianKeys);
    assert.ok(getMessages(locale).navCars.length > 0);
  }
  assert.equal(interpolate(getMessages("en").foundCars, { count: 12 }), "Listings found: 12.");
});

test("Arabic and Turkish generated UI dictionaries are complete and contain no Russian fallback", () => {
  assert.ok(Object.keys(AR_TR_TRANSLATIONS).length > 1_300);
  for (const translations of Object.values(AR_TR_TRANSLATIONS)) {
    assert.ok(translations.ar.length > 0);
    assert.ok(translations.tr.length > 0);
    assert.doesNotMatch(translations.ar, /[А-Яа-яЁё]/u);
    assert.doesNotMatch(translations.tr, /[А-Яа-яЁё]/u);
  }
});

test("the shared layout declares language direction for every page", () => {
  const layout = readFileSync(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
  assert.match(layout, /<html lang=\{documentLocale\} dir=\{getConfiguredLocale\(documentLocale\)\?\.direction \|\| "ltr"\} data-requested-locale=\{locale\}>/);
  assert.match(layout, /pageAlternates\.map\(\(alternate\) => <link rel="alternate" hreflang=\{alternate\.locale\}/);
  assert.doesNotMatch(layout, /SUPPORTED_LOCALES\.map\(\(code\) => <link rel="alternate"/);
});

test("catalog and vehicle detail dictionaries stay complete in every language", () => {
  const catalogKeys = Object.keys(getCatalogMessages("ru")).sort();
  const detailKeys = Object.keys(getDetailMessages("ru")).sort();

  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(getCatalogMessages(locale)).sort(), catalogKeys);
    assert.deepEqual(Object.keys(getDetailMessages(locale)).sort(), detailKeys);
  }

  assert.equal(getCatalogMessages("de").applyFree, "Kostenlos anwenden");
  assert.equal(getDetailMessages("uk").similarCars, "Схожі автомобілі");
  assert.notEqual(getCatalogMessages("ar").title, getCatalogMessages("ru").title);
  assert.notEqual(getDetailMessages("tr").contactSeller, getDetailMessages("ru").contactSeller);
});

test("dynamic listing values use the page language", () => {
  assert.equal(formatOwnersCount(2, "de"), "2 Fahrzeughalter");
  assert.equal(formatOwnersCount(2, "en"), "2 owners");
  assert.equal(formatSellerType("Частное лицо", "uk"), "Приватна особа");
  assert.equal(formatTuvDetail(true, "2027-09", "de"), "gültig bis 09/2027");
  assert.equal(formatTuvDetail(true, "2027-09", "en"), "valid until 09/2027");
});

test("public cards localize labels and legacy Xano values without changing the payload", () => {
  const car = {
    id: 42,
    slug: "audi-a4-42",
    title: "Audi A4",
    brand: "Audi",
    model: "A4",
    price: 19900,
    currency: "EUR",
    year: 2021,
    mileage: 45000,
    fuel_type: "Бензин",
    transmission: "Автомат",
    city: "Berlin",
    country: "Германия",
    status: "approved" as const,
  };
  const german = renderPublicCarCardMarkup(car, { locale: "de" });
  const english = renderPublicCarCardMarkup(car, { locale: "en" });

  assert.match(german, />Kraftstoff<\/dt><dd[^>]*>[\s\S]*?<span>Benzin<\/span>/);
  assert.match(german, />Getriebe<\/dt><dd[^>]*>[\s\S]*?<span>Automatik<\/span>/);
  assert.match(english, />Fuel<\/dt><dd[^>]*>[\s\S]*?<span>Petrol<\/span>/);
  assert.match(english, />Transmission<\/dt><dd[^>]*>[\s\S]*?<span>Automatic<\/span>/);
  assert.equal(car.fuel_type, "Бензин");
});

test("completed Xano free-text translations apply only to allowlisted listing fields", () => {
  const listing: CarListing = {
    id: 42, slug: "audi-a4-42", title: "Audi A4 чёрный", brand: "Audi", model: "A4",
    price: 19900, currency: "EUR", year: 2021, mileage: 45000, fuel_type: "Бензин",
    transmission: "Автомат", city: "Берлин", country: "Германия", status: "approved",
    description: "Исходное описание", source_locale: "ru",
    translation: normalizeListingTranslation({
      id: 7, locale: "de", source_locale: "ru", status: "completed", source_hash: "abc",
      content: {
        title: "Audi A4 schwarz", description: "Übersetzte Beschreibung", city: "Berlin",
        ai_highlights: ["Gepflegter Innenraum"],
      },
    }),
  };

  const localized = applyListingTranslation(listing, "de");
  assert.equal(localized.title, "Audi A4 schwarz");
  assert.equal(localized.description, "Übersetzte Beschreibung");
  assert.equal(localized.city, "Berlin");
  assert.deepEqual(localized.ai_highlights, ["Gepflegter Innenraum"]);
  assert.equal(localized.brand, "Audi");
  assert.equal(localized.original_content?.description, "Исходное описание");
  assert.equal(localized.translation_meta?.used_fallback, false);
  assert.equal(listing.title, "Audi A4 чёрный");
});

test("missing, processing, failed, stale and wrong-language translations retain the seller original", () => {
  const base: CarListing = {
    id: 8, slug: "bmw-8", title: "Исходный заголовок", brand: "BMW", model: "3",
    price: 5000, currency: "EUR", year: 2012, mileage: 120000, fuel_type: "Дизель",
    transmission: "Механика", city: "Ильзеде", country: "Германия", status: "approved",
    description: "Оригинал продавца", source_locale: "ru",
  };

  for (const translation of [
    null,
    { locale: "de", status: "processing", title: "In Arbeit" },
    { locale: "de", status: "failed", title: "Fehlgeschlagen" },
    { locale: "de", status: "stale", title: "Veraltet" },
    { locale: "en", status: "completed", title: "Wrong target" },
  ]) {
    const localized = applyListingTranslation({ ...base, translation: normalizeListingTranslation(translation) }, "de");
    assert.equal(localized.title, base.title);
    assert.equal(localized.description, base.description);
    assert.equal(localized.translation_meta?.used_fallback, true);
    assert.equal(localized.translation_meta?.content_locale, "ru");
  }
});

test("the public Xano contract is locale-aware, cache-safe and preserves originals", () => {
  const contract = JSON.parse(readFileSync(new URL("../docs/xano/multilingual/public-contract.json", import.meta.url), "utf8"));
  const resolver = readFileSync(new URL("../docs/xano/multilingual/public-listing-translation-resolver.xs", import.meta.url), "utf8");
  const localesEndpoint = readFileSync(new URL("../docs/xano/multilingual/GET_locales.xs", import.meta.url), "utf8");
  const taxonomiesEndpoint = readFileSync(new URL("../docs/xano/multilingual/GET_taxonomies.xs", import.meta.url), "utf8");
  const catalogEndpoint = readFileSync(new URL("../docs/xano/multilingual/GET_cars.draft.xs", import.meta.url), "utf8");
  const sellerListingsEndpoint = readFileSync(new URL("../docs/xano/multilingual/GET_cars_slug_seller-listings.draft.xs", import.meta.url), "utf8");
  const relatedEndpoint = readFileSync(new URL("../docs/xano/multilingual/GET_cars_slug_related.draft.xs", import.meta.url), "utf8");
  const xanoClient = readFileSync(new URL("../src/lib/xano.ts", import.meta.url), "utf8");

  assert.deepEqual(contract.supported_locales, ["de", "ru", "uk", "en", "ar", "tr"]);
  assert.deepEqual(contract.translation.cache_key, ["car_listing_id", "locale", "source_hash"]);
  assert.ok(contract.translation.immutable_fields.includes("price"));
  assert.match(resolver, /status == "completed"/);
  assert.match(resolver, /source_hash == \$source_hash/);
  assert.match(resolver, /locale_code == \$input\.lang/);
  assert.match(resolver, /translation_status == "completed"/);
  assert.doesNotMatch(resolver, /\$translation_row\.city/);
  assert.match(localesEndpoint, /english_name/);
  assert.match(localesEndpoint, /default_locale\s*: "ru"/);
  assert.match(localesEndpoint, /fallback_locale\s*: "de"/);
  assert.match(taxonomiesEndpoint, /value_code/);
  assert.match(taxonomiesEndpoint, /locale_code/);
  assert.match(catalogEndpoint, /text lang\?="ru"/);
  assert.match(catalogEndpoint, /car_listing_id in \$public_car_ids/);
  assert.match(catalogEndpoint, /locale_code == \$input\.lang/);
  assert.match(catalogEndpoint, /source_hash == \$source_hash/);
  assert.match(catalogEndpoint, /translation_status == "completed"/);
  assert.match(catalogEndpoint, /source_locale\s*: \$source_locale/);
  assert.match(catalogEndpoint, /translation\s*: \$translation/);
  assert.equal((catalogEndpoint.match(/db\.query car_listing_translations/g) || []).length, 1);
  for (const [endpoint, idVariable] of [
    [sellerListingsEndpoint, "seller_car_ids"],
    [relatedEndpoint, "candidate_ids"],
  ] as const) {
    assert.match(endpoint, /text lang\?="ru" filters=trim\|lower/);
    assert.match(endpoint, new RegExp(`car_listing_id in \\$${idVariable}`));
    assert.match(endpoint, /locale_code == \$input\.lang/);
    assert.match(endpoint, /source_locale == \$source_locale/);
    assert.match(endpoint, /source_hash == \$source_hash/);
    assert.match(endpoint, /translation_status == "completed"/);
    assert.match(endpoint, /source_locale\s*: \$source_locale/);
    assert.match(endpoint, /translation\s*: \$translation/);
    assert.equal((endpoint.match(/db\.query car_listing_translations/g) || []).length, 1);
  }
  assert.match(resolver, /Добавить в публичный DTO, не заменяя оригинальные поля/);
  assert.match(xanoClient, /withLocale\(API_ROUTES\.cars, locale\)/);
  assert.match(xanoClient, /applyListingTranslations\(normalizePublicCarList\(payload\), locale\)/);
  assert.match(xanoClient, /withLocale\(API_ROUTES\.carBySlug\(slug\), contentLocale\)/);
  assert.match(xanoClient, /applyListingTranslation\(listing, locale\)/);
  assert.match(xanoClient, /withLocale\(API_ROUTES\.carSellerListings\(slug\), contentLocale\)/);
  assert.match(xanoClient, /withLocale\(API_ROUTES\.carRelated\(slug\), contentLocale\)/);
  assert.match(xanoClient, /getRelatedCarsBySlug/);
});
