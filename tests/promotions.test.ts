import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PROMOTION_PRODUCTS,
  calculatePromotionEndDate,
  getActivePromotionProducts,
  getHomepagePromotedCars,
  getPromotionEligibilityMessage,
  parseApiDate,
  sortCarsByActivePromotion,
} from "../src/lib/promotions/model.ts";
import type { CarListing } from "../src/lib/types.ts";

const now = Date.parse("2026-07-22T10:00:00Z");
const base = { brand: "VW", model: "Golf", year: 2020, mileage: 10, fuel_type: "Diesel", transmission: "Auto", price: 1, currency: "EUR", city: "Berlin", country: "DE", status: "approved" as const };

test("promotion products use one credit config", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(PROMOTION_PRODUCTS).map(([slug, item]) => [slug, [item.credits, item.durationDays]])), {
    boost_7_days: [5, 7],
    featured_14_days: [12, 14],
    homepage_premium_7_days: [20, 7],
  });
});

test("parseApiDate normalizes milliseconds, seconds, numeric strings and ISO", () => {
  assert.equal(parseApiDate(1721660000000)?.getTime(), 1721660000000);
  assert.equal(parseApiDate(1721660000)?.getTime(), 1721660000000);
  assert.equal(parseApiDate("1721660000000")?.getTime(), 1721660000000);
  assert.equal(parseApiDate("2026-07-22T18:00:00Z")?.toISOString(), "2026-07-22T18:00:00.000Z");
  assert.equal(parseApiDate(null), null);
  assert.equal(parseApiDate("invalid"), null);
});

test("active promotion extension starts from current expiry or now", () => {
  const activeUntil = now + 5 * 86_400_000;
  assert.equal(calculatePromotionEndDate(activeUntil, 7, now).getTime(), now + 12 * 86_400_000);
  assert.equal(calculatePromotionEndDate(now - 1, 7, now).getTime(), now + 7 * 86_400_000);
});

test("public ordering is homepage, featured, boosted, ordinary and ignores expired", () => {
  const cars = [
    { ...base, id: 1, slug: "ordinary", title: "Ordinary", created_at: now + 4000 },
    { ...base, id: 2, slug: "boost", title: "Boost", boosted_until: now + 50_000, last_promoted_at: now + 1000 },
    { ...base, id: 3, slug: "featured", title: "Featured", featured_until: now + 50_000, last_promoted_at: now + 2000 },
    { ...base, id: 4, slug: "premium", title: "Premium", homepage_until: now + 50_000, last_promoted_at: now + 3000 },
    { ...base, id: 5, slug: "expired", title: "Expired", homepage_until: now - 1, created_at: now - 1 },
  ] as CarListing[];
  assert.deepEqual(sortCarsByActivePromotion(cars, { now }).map((car) => car.id), [4, 3, 2, 1, 5]);
  assert.deepEqual(getHomepagePromotedCars(cars, now).map((car) => car.id), [4]);
  assert.equal(getActivePromotionProducts(cars[4], now).length, 0);
});

test("listing promotion availability explains every non-public state", () => {
  assert.equal(getPromotionEligibilityMessage("approved"), "");
  assert.match(getPromotionEligibilityMessage("draft"), /после публикации/);
  assert.match(getPromotionEligibilityMessage("pending_review"), /после одобрения/);
  assert.match(getPromotionEligibilityMessage("rejected"), /Исправьте/);
  assert.match(getPromotionEligibilityMessage("blocked"), /недоступно/);
});

test("production frontend uses real credit endpoints and no checkout or test storage", () => {
  const promote = readFileSync(new URL("../src/pages/dashboard/cars/promote.astro", import.meta.url), "utf8");
  const listings = readFileSync(new URL("../src/pages/dashboard/listings.astro", import.meta.url), "utf8");
  for (const marker of ["dashboardListingPromote", "idempotency_key", "promotion-confirm-dialog", "INSUFFICIENT_CREDITS", "aria-live", "crypto.randomUUID"]) assert.match(promote, new RegExp(marker));
  assert.doesNotMatch(promote, /purchaseCreate|checkout_url|alert\(|sessionStorage|PUBLIC_PROMOTION_TEST_MODE/);
  assert.doesNotMatch(listings, /PUBLIC_PROMOTION_TEST_MODE|PromotionTestStore/);
  assert.match(listings, /sitecraft-dashboard-listings-v1:\$\{getAuthUser\(\)\?\.id/);
});

test("Xano implementation is transactional, owner scoped, locked and idempotent", () => {
  const endpoints = readFileSync(new URL("../docs/xano/promotion-endpoints.xs", import.meta.url), "utf8");
  const ledger = readFileSync(new URL("../docs/xano/promotions-credit-transactions-table.xs", import.meta.url), "utf8");
  for (const marker of ["db.transaction", "lock = true", "listing.user_id == $auth.id", "DUPLICATE_OPERATION", "INSUFFICIENT_CREDITS", "0 - $credits_required", "add_secs_to_timestamp:$duration_seconds", "HTTP/1.1 409 Conflict", "HTTP/1.1 422 Unprocessable Entity"]) assert.match(endpoints, new RegExp(marker.replaceAll("$", "\\$")));
  assert.match(endpoints, /duration_seconds\s*\{[\s\S]*duration_days \* 86400/);
  assert.doesNotMatch(endpoints, /\|add_days:/);
  assert.match(endpoints, /listing\.moderation_status == "blocked"/);
  assert.match(endpoints, /listing\.status != "published"/);
  assert.match(endpoints, /value = \{code: "LISTING_BLOCKED", message: "LISTING_BLOCKED"\}/);
  assert.match(endpoints, /value = \{code: "LISTING_NOT_PUBLISHED", message: "LISTING_NOT_PUBLISHED"\}/);
  assert.match(ledger, /btree\|unique[\s\S]*user_id[\s\S]*idempotency_key/);
  assert.doesNotMatch(endpoints, /Stripe|PayPal|price_cents|input\.credits/);
});

test("public normalization preserves only the timestamps needed for promotion rendering", () => {
  const source = readFileSync(new URL("../src/lib/publicCar.ts", import.meta.url), "utf8");
  const publicEndpoint = readFileSync(new URL("../docs/xano-endpoint-get-cars.xs", import.meta.url), "utf8");
  for (const field of ["boosted_at", "boosted_until", "featured_at", "featured_until", "homepage_at", "homepage_until", "last_promoted_at"]) {
    assert.match(source, new RegExp(`${field}: toOptionalDate\\(source\\.${field}\\)`));
    assert.match(publicEndpoint, new RegExp(`${field}\\s*: \\$car\\.${field}`));
  }
  assert.doesNotMatch(publicEndpoint, /user_id\s*:|seller_email\s*:|seller_phone\s*:|vin\s*:/);
});

test("active homepage premium promotion decorates the complete vehicle page", () => {
  const detail = readFileSync(new URL("../src/pages/cars/[slug].astro", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles/promotions.css", import.meta.url), "utf8");
  for (const marker of [
    'const isPremiumDetail = activePromotion?.promotion_type === "premium"',
    "vehicle-detail-page-premium",
    "car-detail-premium-banner",
    'data-lucide="crown"',
    'data-lucide="gem"',
  ]) assert.match(detail, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of [
    "--premium-detail-gold",
    "premium-detail-enter",
    "premium-detail-sheen",
    "detail-contact-jump",
    "prefers-reduced-motion: reduce",
  ]) assert.match(css, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(css, /animation:\s*[^;]*(infinite|linear infinite)/);
});
