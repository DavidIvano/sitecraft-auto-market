import assert from "node:assert/strict";
import test from "node:test";
import { evaluateListingSeoQuality } from "../src/lib/seo/listingQuality.ts";
import type { CarListing } from "../src/lib/types.ts";

const validListing: CarListing = {
  id: 1,
  slug: "bmw-320d-2020-1",
  title: "BMW 320d 2020",
  description: "Ухоженный автомобиль с полной историей обслуживания, чистым салоном и готовностью к ежедневной эксплуатации.",
  brand: "BMW",
  model: "320d",
  year: 2020,
  mileage: 80_000,
  fuel_type: "diesel",
  transmission: "automatic",
  body_type: "sedan",
  price: 18_900,
  currency: "EUR",
  city: "Berlin",
  country: "DE",
  status: "approved",
  main_image_url: "https://images.example.com/bmw.webp",
};

test("SEO quality gate accepts complete listings and reports deterministic diagnostics", () => {
  const result = evaluateListingSeoQuality(validListing);
  assert.equal(result.eligible, true);
  assert.equal(result.failures.length, 0);
  assert.equal(result.imageCount, 1);
});

test("SEO quality gate blocks thin text and placeholder or unsafe photos", () => {
  const result = evaluateListingSeoQuality({
    ...validListing,
    description: "Коротко",
    main_image_url: "http://images.example.com/bmw.jpg",
  });
  assert.equal(result.eligible, false);
  assert.ok(result.failures.includes("description_too_short"));
  assert.ok(result.failures.includes("missing_https_photo"));
});
