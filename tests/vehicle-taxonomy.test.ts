import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVehicleTaxonomy,
  buildVehicleTaxonomySeo,
  findVehicleBrandFacet,
  findVehicleModelFacet,
  isValidVehicleFacetSlug,
  normalizeVehicleFacetSlug,
} from "../src/lib/seo/vehicleTaxonomy.ts";
import type { CarListing } from "../src/lib/types.ts";

const car = (overrides: Partial<CarListing> = {}): CarListing => ({
  id: 1,
  slug: "bmw-320d-1",
  title: "BMW 320d",
  brand: "BMW",
  model: "320d",
  year: 2019,
  mileage: 80000,
  fuel_type: "Diesel",
  transmission: "Automatik",
  price: 18000,
  currency: "EUR",
  city: "Berlin",
  country: "DE",
  status: "approved",
  moderation_status: "approved",
  updated_at: "2026-07-20T12:00:00.000Z",
  ...overrides,
});

test("vehicle facet slugs normalize German, accented and Cyrillic names", () => {
  assert.equal(normalizeVehicleFacetSlug("Mercedes-Benz"), "mercedes-benz");
  assert.equal(normalizeVehicleFacetSlug("Škoda"), "skoda");
  assert.equal(normalizeVehicleFacetSlug("MÜNCHEN Auto"), "muenchen-auto");
  assert.equal(normalizeVehicleFacetSlug("Лада Веста"), "lada-vesta");
  assert.equal(isValidVehicleFacetSlug("bmw-3-series"), true);
  assert.equal(isValidVehicleFacetSlug("BMW 3"), false);
  assert.equal(isValidVehicleFacetSlug("../admin"), false);
});

test("taxonomy groups case-insensitively and produces deterministic collision-safe slugs", () => {
  const taxonomy = buildVehicleTaxonomy([
    car(),
    car({ id: 2, slug: "bmw-x3-2", brand: "bmw", model: "X3" }),
    car({ id: 3, slug: "ab-one-3", brand: "A B", model: "One" }),
    car({ id: 4, slug: "ab-two-4", brand: "A-B", model: "Two" }),
  ]);
  const bmw = taxonomy.find((brand) => brand.slug === "bmw");
  assert.ok(bmw);
  assert.equal(bmw.cars.length, 2);
  assert.deepEqual(bmw.models.map((model) => model.slug), ["320d", "x3"]);
  const collisionSlugs = taxonomy.filter((brand) => brand.name.startsWith("A")).map((brand) => brand.slug);
  assert.deepEqual(collisionSlugs, ["a-b", "a-b-2"]);
  assert.deepEqual(buildVehicleTaxonomy(taxonomy.flatMap((brand) => brand.cars)).map((brand) => brand.slug), taxonomy.map((brand) => brand.slug));
});

test("brand and model metadata are unique, canonical and privacy-safe", () => {
  const taxonomy = buildVehicleTaxonomy([
    car({ description: "owner@example.com +49 170 1234567" }),
    car({ id: 2, slug: "bmw-x3-2", model: "X3", price: 24000, year: 2021, city: "Hamburg" }),
  ]);
  const brand = findVehicleBrandFacet(taxonomy, "bmw");
  assert.ok(brand);
  const model = findVehicleModelFacet(brand, "320d");
  assert.ok(model);
  const brandSeo = buildVehicleTaxonomySeo({ brand });
  const modelSeo = buildVehicleTaxonomySeo({ brand, model });
  assert.equal(brandSeo.canonicalUrl, "https://automarket.sitecraft.agency/cars/brand/bmw");
  assert.equal(modelSeo.canonicalUrl, "https://automarket.sitecraft.agency/cars/brand/bmw/320d");
  assert.notEqual(brandSeo.title, modelSeo.title);
  assert.notEqual(brandSeo.description, modelSeo.description);
  assert.equal(brandSeo.collection["@type"], "CollectionPage");
  assert.equal(modelSeo.breadcrumb["@type"], "BreadcrumbList");
  assert.doesNotMatch(JSON.stringify([brandSeo, modelSeo]), /owner@example\.com|1234567/);
});

test("taxonomy lastmod is stable and uses the newest listing update", () => {
  const [brand] = buildVehicleTaxonomy([
    car({ updated_at: "2026-07-20T12:00:00.000Z" }),
    car({ id: 2, slug: "bmw-x3-2", model: "X3", updated_at: "2026-07-25T09:30:00.000Z" }),
  ]);
  assert.equal(brand?.lastmod, "2026-07-25T09:30:00.000Z");
});
