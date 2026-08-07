import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatCompactPublicViewCount,
  formatPublicViewCount,
  normalizePublicViewCount,
  shouldShowPublicViewCount,
} from "../src/lib/listingViews.ts";
import { renderPublicCarCardMarkup } from "../src/lib/publicCarCard.ts";
import { normalizePublicCarListing } from "../src/lib/publicCar.ts";
import type { CarListing } from "../src/lib/types.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const normalizeSpacing = (value: string) => value.replaceAll("\u00a0", " ");
const car = (viewsTotal?: number): CarListing => ({
  id: 95,
  slug: "bmw-520-2004-73",
  title: "BMW 520 2004",
  brand: "BMW",
  model: "520",
  year: 2004,
  mileage: 175000,
  fuel_type: "Diesel",
  transmission: "Automatik",
  price: 4500,
  currency: "EUR",
  city: "Peine",
  country: "DE",
  status: "approved",
  moderation_status: "approved",
  views_total: viewsTotal,
});

test("public view counts normalize unsafe API values", () => {
  assert.equal(normalizePublicViewCount(undefined), 0);
  assert.equal(normalizePublicViewCount(null), 0);
  assert.equal(normalizePublicViewCount("10"), 10);
  assert.equal(normalizePublicViewCount(-1), 0);
  assert.equal(normalizePublicViewCount(Number.NaN), 0);
  assert.equal(normalizePublicViewCount("invalid"), 0);
  assert.equal(normalizePublicViewCount(12.9), 12);
});

test("public API normalization preserves the safe total for SSR", () => {
  const normalized = normalizePublicCarListing(car(128));
  assert.equal(normalized?.views_total, 128);

  const invalid = normalizePublicCarListing({ ...car(), views_total: "invalid" });
  assert.equal(invalid?.views_total, 0);
});

test("public view labels use correct Russian plural forms", () => {
  const cases = new Map([
    [0, "0 просмотров"],
    [1, "1 просмотр"],
    [2, "2 просмотра"],
    [4, "4 просмотра"],
    [5, "5 просмотров"],
    [11, "11 просмотров"],
    [21, "21 просмотр"],
    [22, "22 просмотра"],
    [25, "25 просмотров"],
  ]);

  for (const [value, expected] of cases) {
    assert.equal(formatPublicViewCount(value), expected);
  }
});

test("public card compact counts use Intl formatting", () => {
  assert.equal(normalizeSpacing(formatCompactPublicViewCount(999)), "999");
  assert.equal(normalizeSpacing(formatCompactPublicViewCount(1000)), "1 тыс.");
  assert.equal(normalizeSpacing(formatCompactPublicViewCount(1200)), "1,2 тыс.");
  assert.equal(normalizeSpacing(formatCompactPublicViewCount(1_000_000)), "1 млн");
});

test("public cards always render the exact SSR view count", () => {
  for (const value of [0, 4, 5, 128]) {
    const html = renderPublicCarCardMarkup(car(value));
    assert.match(html, new RegExp(`<span>${value}<\\/span>`));
    assert.match(html, new RegExp(`aria-label="${value} просмотр`));
    assert.doesNotMatch(html, />Новое<\/span>/);
    assert.doesNotMatch(html, /undefined|null|NaN|-\d+ просмотр/);
  }

  assert.equal(shouldShowPublicViewCount(4), false);
  assert.equal(shouldShowPublicViewCount(5), true);
});

test("public view metadata is accessible, non-interactive, and isolated per card", () => {
  const low = renderPublicCarCardMarkup(car(5));
  const high = renderPublicCarCardMarkup({ ...car(128), id: 94, slug: "mercedes-vito" });
  assert.match(low, /class="car-card-views" aria-label="5 просмотров"/);
  assert.match(high, /class="car-card-views" aria-label="128 просмотров"/);
  assert.doesNotMatch(low, /<button[^>]*car-card-views/);
  assert.doesNotMatch(high, /aria-label="5 просмотров"/);

  const related = renderPublicCarCardMarkup(car(128), { source: "similar_cars" });
  assert.match(related, /class="car-card-views" aria-label="128 просмотров"/);
});

test("catalog and detail public APIs expose only total views without view N+1", async () => {
  const catalog = await read("../docs/xano-endpoint-get-cars.xs");
  const detail = await read("../docs/xano-endpoint-get-cars-slug.xs");

  assert.match(catalog, /listing_views\.car_id in \$public_car_ids/);
  assert.match(catalog, /views_total\s*:\s*\$car_views\|count/);
  assert.match(catalog, /try_catch[\s\S]*?catch[\s\S]*?value = \[\]/);
  assert.match(detail, /listing_views\.car_id == \$car\.id/);
  assert.match(detail, /views_total\s*:\s*\$views_total/);
  assert.match(detail, /catch[\s\S]*?value = 0/);

  const publicCarLoop = catalog.slice(catalog.indexOf("foreach ($cars) {", catalog.indexOf("foreach ($cars) {") + 1));
  assert.doesNotMatch(publicCarLoop, /db\.query listing_views/);

  const catalogProjection = catalog.slice(catalog.indexOf("var $public_cars"), catalog.indexOf("response = $public_cars"));
  const detailProjection = detail.slice(detail.indexOf("var $model"), detail.indexOf("response = $model"));
  for (const projection of [catalogProjection, detailProjection]) {
    assert.doesNotMatch(projection, /views_unique|views_7d|last_viewed_at|session_id|traffic_source/);
  }
});

test("public view counts are part of SSR pages and never fetched per card", async () => {
  const renderer = await read("../src/lib/publicCarCard.ts");
  const cardClient = await read("../src/lib/publicCarCardsClient.ts");
  const iconRegistry = await read("../src/lib/appIcons.ts");
  const homepage = await read("../src/pages/index.astro");
  const catalog = await read("../src/pages/cars/index.astro");
  const detail = await read("../src/pages/cars/[slug].astro");
  const types = await read("../src/lib/types.ts");

  assert.match(renderer, /car\.views_total/);
  assert.match(renderer, /class=\"car-card-views\"/);
  assert.match(cardClient, /refreshAppIcons/);
  assert.match(iconRegistry, /\bEye\b/);
  assert.match(iconRegistry, /\bHeart\b/);
  assert.match(iconRegistry, /\bPlus\b/);
  assert.match(homepage, /<CarCard car=\{car\}/);
  assert.match(catalog, /<CarCard car=\{car\}/);
  assert.match(detail, /detail-public-views/);
  assert.match(detail, /formatPublicViewCount\(car\.views_total\)/);
  assert.match(types, /views_total\?: number/);
  for (const source of [renderer, homepage, catalog]) {
    assert.doesNotMatch(source, /\/cars\/[^"'`]+\/views/);
  }
});
