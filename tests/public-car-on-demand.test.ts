import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isValidPublicCarSlug,
  normalizePublicCarListing,
  normalizePublicCarList,
} from "../src/lib/publicCar.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

const approvedListing = (overrides: Record<string, unknown> = {}) => ({
  id: 91,
  slug: "new-approved-car-91",
  title: "Renault Megane",
  brand: "Renault",
  model: "Megane",
  status: "approved",
  moderation_status: "approved",
  description: null,
  price: "7490",
  year: "2014",
  mileage: "128000",
  currency: "EUR",
  vin: "VF1BZ0C0641234567",
  images: undefined,
  admin_notes: "private moderation note",
  rejection_internal_notes: "private rejection note",
  ...overrides,
});

test("approved Xano payload is normalized without optional values leaking", () => {
  const car = normalizePublicCarListing(approvedListing());
  assert.ok(car);
  assert.equal(car.description, "");
  assert.equal(car.price, 7490);
  assert.equal(car.vin, "");
  assert.notEqual(car.vin_masked, "VF1BZ0C0641234567");
  assert.equal("admin_notes" in car, false);
  assert.equal("rejection_internal_notes" in car, false);
});

test("public seller contact derives safe hrefs when Xano returns visible values without hrefs", () => {
  const car = normalizePublicCarListing(approvedListing({
    seller: {
      name: "Davyd",
      type: "private",
      active_listings_count: 9,
      contact: {
        phone: "+4916096556543",
        phone_href: null,
        email: "Seller@Example.com",
        email_href: null,
        preferred_method: "phone",
      },
    },
  }));

  assert.ok(car?.seller?.contact);
  assert.equal(car.seller.contact.phone, "+4916096556543");
  assert.equal(car.seller.contact.phone_href, "tel:+4916096556543");
  assert.equal(car.seller.contact.email, "seller@example.com");
  assert.equal(car.seller.contact.email_href, "mailto:seller@example.com");
});

test("public seller contact rejects unsafe values instead of creating links", () => {
  const car = normalizePublicCarListing(approvedListing({
    seller: {
      name: "Seller",
      contact: {
        phone: "javascript:alert(1)",
        email: "seller@example.com\r\nBcc:attacker@example.com",
        phone_href: null,
        email_href: null,
      },
    },
  }));

  assert.ok(car);
  assert.equal(car.seller?.contact, null);
});

test("all private or conflicting listing states fail closed", () => {
  for (const status of ["draft", "ai_draft", "pending_review", "needs_fix", "rejected", "blocked", "deleted", "archived"]) {
    assert.equal(normalizePublicCarListing(approvedListing({ status, moderation_status: status })), null, status);
  }
  assert.equal(normalizePublicCarListing(approvedListing({ status: "approved", moderation_status: "blocked" })), null);
});

test("image formats are normalized and unsafe URLs are discarded", () => {
  const car = normalizePublicCarListing(approvedListing({
    images: [
      "https://images.example.com/car-one.webp",
      { image_url: "https://images.example.com/car-two.jpg" },
      "http://images.example.com/insecure.jpg",
      "javascript:alert(1)",
    ],
  }));
  assert.ok(car);
  assert.deepEqual(car.image_urls, [
    "https://images.example.com/car-one.webp",
    "https://images.example.com/car-two.jpg",
  ]);
});

test("list wrappers are supported and private listings stay out", () => {
  const cars = normalizePublicCarList({ items: [approvedListing(), approvedListing({ slug: "private-car", status: "draft" })] });
  assert.deepEqual(cars.map((car) => car.slug), ["new-approved-car-91"]);
});

test("public slug validation rejects malformed and oversized paths", () => {
  assert.equal(isValidPublicCarSlug("renault-megane-2014-69"), true);
  assert.equal(isValidPublicCarSlug("undefined"), false);
  assert.equal(isValidPublicCarSlug("../admin"), false);
  assert.equal(isValidPublicCarSlug("car name"), false);
  assert.equal(isValidPublicCarSlug("a".repeat(121)), false);
});

test("car detail is on-demand and uses direct slug lookup with safe state routes", () => {
  const page = readProjectFile("src/pages/cars/[slug].astro");
  const xano = readProjectFile("src/lib/xano.ts");
  const notFound = readProjectFile("src/pages/404.astro");
  const unavailable = readProjectFile("src/pages/service-unavailable.astro");
  assert.match(page, /export const prerender = false/);
  assert.doesNotMatch(page, /getStaticPaths/);
  assert.match(page, /await getCarBySlug\(slug\)/);
  assert.match(page, /getRelatedListingsBySlug\(slug\)/);
  assert.doesNotMatch(page, /getApprovedCars\(\)/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /Astro\.response\.status = 404/);
  assert.match(page, /public, max-age=0, s-maxage=300, stale-while-revalidate=86400/);
  assert.match(page, /Astro\.response\.headers\.set\("Retry-After", "300"\)/);
  assert.match(page, /buildVehicleSeo\(car, siteUrl\)/);
  assert.match(page, /jsonLd=\{\[vehicleSeo\.vehicle, vehicleSeo\.offer, vehicleSeo\.breadcrumb\]\}/);
  assert.match(page, /<h1>\{vehicleSeo\.heading\}<\/h1>/);
  assert.match(page, /detailDescription[\s\S]*Продавец пока не добавил описание автомобиля/);
  assert.match(page, /\/deal-finder-placeholder\.svg/);
  assert.match(xano, /API_ROUTES\.carBySlug\(slug\)/);
  assert.match(xano, /API_ROUTES\.carRelatedListings\(slug\)/);
  assert.match(xano, /fetchWithRetry/);
  assert.match(xano, /attempts: 3/);
  assert.match(xano, /timeoutMs: PUBLIC_API_TIMEOUT_MS/);
  assert.match(xano, /dedupeKey: `xano-public:\$\{path\}`/);
  assert.match(notFound, /export const prerender = false/);
  assert.match(notFound, /Astro\.response\.status = 404/);
  assert.match(notFound, /Объявление не найдено/);
  assert.match(unavailable, /export const prerender = false/);
  assert.match(unavailable, /Astro\.response\.status = 503/);
});

test("catalog is on-demand SSR with crawlable server-rendered cards", () => {
  const catalog = readProjectFile("src/pages/cars/index.astro");
  const routes = readProjectFile("public/_routes.json");
  assert.match(catalog, /export const prerender = false/);
  assert.match(catalog, /getApprovedCars\(\{ requireConfigured: true \}\)/);
  assert.match(catalog, /cars\.map\(\(car, index\) => <CarCard/);
  assert.match(catalog, /public, max-age=0, s-maxage=120, stale-while-revalidate=3600/);
  assert.match(catalog, /Astro\.response\.status = 503/);
  assert.match(routes, /"\/cars"/);
});

test("homepage renders crawlable latest-car links before client enhancement", () => {
  const homepage = readProjectFile("src/pages/index.astro");
  assert.match(homepage, /await getApprovedCars\(\)/);
  assert.match(homepage, /latestCars\.map\(\(car, index\) => <CarCard/);
  assert.doesNotMatch(homepage, /your-xano-api-url\.com/);
});

test("sitemap is dynamic, edge cached and fails closed", () => {
  const sitemap = readProjectFile("src/pages/sitemap.xml.ts");
  const config = readProjectFile("src/lib/config.ts");
  assert.match(sitemap, /export const prerender = false/);
  assert.match(sitemap, /getApprovedCars\(\{ requireConfigured: true \}\)/);
  assert.match(sitemap, /isPublicListing/);
  assert.match(sitemap, /status: 503/);
  assert.match(sitemap, /"Retry-After": "300"/);
  assert.match(sitemap, /public, max-age=0, s-maxage=300, stale-while-revalidate=3600/);
  assert.doesNotMatch(sitemap, /lastmod: new Date\(\)\.toISOString\(\)/);
  assert.match(sitemap, /https:\/\/automarket\.sitecraft\.agency/);
  assert.match(config, /https:\/\/automarket\.sitecraft\.agency/);
});

test("Cloudflare workflow fails fast and deploys the advanced-mode bundle", () => {
  const workflow = readProjectFile(".github/workflows/cloudflare-pages.yml");
  const packager = readProjectFile("scripts/prepare-cloudflare-pages.mjs");
  const routes = readProjectFile("public/_routes.json");
  assert.match(workflow, /Validate deployment configuration/);
  assert.match(workflow, /Missing required GitHub Actions setting/);
  assert.doesNotMatch(workflow, /Skip deploy without Cloudflare token/);
  assert.match(workflow, /workingDirectory: dist\/client/);
  assert.match(workflow, /pages deploy \. --project-name sitecraft-auto-market --branch main/);
  assert.match(packager, /generatedWranglerDeployDir/);
  assert.match(packager, /rmSync\(generatedWranglerDeployDir/);
  assert.match(routes, /"\/cars\/\*"/);
  assert.match(routes, /"\/sitemap\.xml"/);
});
