import assert from "node:assert/strict";
import test from "node:test";
import { buildVehicleSeo, sanitizeVehicleSeoText } from "../src/lib/seo/vehicleSeo.ts";
import type { CarListing } from "../src/lib/types.ts";

const listing = (overrides: Partial<CarListing> = {}): CarListing => ({
  id: 77,
  slug: "bmw-320d-2019-77",
  title: "BMW 320d",
  brand: "BMW",
  model: "320d",
  year: 2019,
  mileage: 84500,
  fuel_type: "Diesel",
  transmission: "Automatik",
  body_type: "Limousine",
  color: "Schwarz",
  price: 18900,
  currency: "EUR",
  city: "Berlin",
  country: "DE",
  description: "Ухоженный автомобиль.\nТелефон: +49 170 1234567\nemail owner@example.com\nVIN WBA12345678901234",
  status: "approved",
  moderation_status: "approved",
  main_image_url: "https://images.example.com/bmw.jpg",
  image_urls: ["https://images.example.com/bmw.jpg"],
  ...overrides,
});

test("vehicle SEO builds title, description, canonical and safe image metadata", () => {
  const seo = buildVehicleSeo(listing());
  assert.equal(seo.title, "BMW 320d 2019 купить в Berlin");
  assert.equal(seo.heading, "BMW 320d 2019");
  assert.equal(seo.canonicalUrl, "https://automarket.sitecraft.agency/cars/bmw-320d-2019-77");
  assert.equal(seo.imageUrl, "https://images.example.com/bmw.jpg");
  assert.equal(seo.imageAlt, "BMW 320d 2019, Berlin");
  for (const privateValue of ["+49 170", "owner@example.com", "WBA12345678901234"]) {
    assert.doesNotMatch(seo.description, new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(seo.description, /18[\s\u00a0]?900/);
  assert.match(seo.description, /84[\s\u00a0]?500/);
});

test("Product + Car, Offer and BreadcrumbList contain only real serializable values", () => {
  const seo = buildVehicleSeo(listing());
  assert.deepEqual(seo.vehicle["@type"], ["Product", "Car"]);
  assert.equal(seo.offer["@type"], "Offer");
  assert.equal(seo.breadcrumb["@type"], "BreadcrumbList");
  assert.equal(seo.offer.availability, "https://schema.org/InStock");
  assert.equal(seo.offer.price, 18900);
  assert.equal(seo.vehicle.offers["@id"], seo.offer["@id"]);
  assert.deepEqual(seo.offer.itemOffered, { "@id": seo.vehicle["@id"] });
  const json = JSON.stringify([seo.vehicle, seo.offer, seo.breadcrumb]);
  assert.doesNotMatch(json, /undefined|NaN|null|owner@example\.com|WBA12345678901234/);
});

test("sold inventory uses SoldOut and unsafe images fall back to the production origin", () => {
  const seo = buildVehicleSeo(listing({
    status: "sold",
    moderation_status: "sold",
    main_image_url: "javascript:alert(1)",
    image_urls: [],
  }));
  assert.equal(seo.offer.availability, "https://schema.org/SoldOut");
  assert.equal(seo.imageUrl, "https://automarket.sitecraft.agency/deal-finder-placeholder.svg");
});

test("SEO sanitizer removes inline email, phone and VIN", () => {
  assert.equal(
    sanitizeVehicleSeoText("Kontakt: +49 170 1234567 test@example.com WBA12345678901234 gepflegt"),
    "Kontakt: gepflegt",
  );
});
