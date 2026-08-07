import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeInternalReturnTo } from "../src/lib/returnTo.ts";
import { renderPublicCarCardMarkup } from "../src/lib/publicCarCard.ts";
import type { CarListing } from "../src/lib/types.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const car: CarListing = { id: 7, slug: "renault-megane", title: "Renault Megane", brand: "Renault", model: "Megane", year: 2019, mileage: 72000, fuel_type: "Benzin", transmission: "Manuell", price: 11900, currency: "EUR", city: "Berlin", country: "DE", status: "published", is_saved: true };

test("public card has one native destination and independent saved control", () => {
  const html = renderPublicCarCardMarkup(car, { source: "seller_listings" });
  assert.match(html, /<a class="car-card-link" href="\/cars\/renault-megane\/"/);
  assert.match(html, /data-car-favourite="7"[\s\S]*aria-pressed="true"/);
  assert.match(html, /data-favorite-source="seller_listings"/);
  assert.doesNotMatch(html, /role="link"|data-car-card-href|data-lightbox-trigger/);
});

test("favorites and contact endpoints remain auth scoped and separate from Deal Finder", () => {
  const api = read("src/lib/apiRoutes.ts");
  const endpoints = read("docs/xano/public-favorites-contacts/endpoints.xs");
  const schema = read("docs/xano/public-favorites-contacts/schema.xs");
  assert.match(api, /favorites: "\/favorites"/);
  assert.match(api, /favoriteStatuses: "\/favorites\/status"/);
  assert.match(schema, /type: "btree\|unique"[\s\S]*user_id[\s\S]*car_listing_id/);
  for (const route of ["favorites verb=GET", '"favorites/status" verb=POST', '"favorites/{listing_id}" verb=POST', '"favorites/{listing_id}" verb=DELETE', '"me/contact-profile" verb=GET', '"me/contact-profile" verb=PATCH']) assert.ok(endpoints.includes(route));
  assert.match(endpoints, /auth = "automarket_users"/);
  assert.match(endpoints, /\$db\.car_listing_favorites\.user_id == \$auth\.id/);
  assert.match(endpoints, /\(\$input\.listing_ids\|count\) <= 100/);
  assert.doesNotMatch(endpoints, /deal_finder_listings|deal_finder_searches/);
});

test("favorite state is synchronized in one authenticated batch and never stored locally", () => {
  const client = read("src/lib/publicCarCardsClient.ts");
  assert.match(client, /API_ROUTES\.favoriteStatuses/);
  assert.match(client, /listing_ids: ids\.map/);
  assert.match(client, /slice\(0, 100\)/);
  assert.doesNotMatch(client, /localStorage|sitecraft-public-car-favourites/);
});

test("contact UI exposes only explicit public profile fields", () => {
  const detail = read("src/pages/cars/[slug].astro");
  const form = read("src/components/dashboard/ContactProfileForm.astro");
  const modal = read("src/components/ContactSellerModal.astro");
  assert.match(detail, /rawPhoneValue/);
  assert.match(detail, /`tel:\$\{phoneValue\}`/);
  assert.match(form, /show_phone/);
  assert.match(form, /show_email/);
  assert.match(form, /preferred_contact_method/);
  assert.doesNotMatch(form, /value="both"/);
  assert.match(modal, /data-contact-modal/);
  assert.match(modal, /addEventListener\("cancel"/);
  assert.match(modal, /addEventListener\("close", \(\) => lastTrigger\?\.focus\(\)\)/);
  assert.doesNotMatch(modal, /seller_email|login.*email/i);
});

test("returnTo accepts only internal paths", () => {
  assert.equal(normalizeInternalReturnTo("/cars/renault/?from=favorites"), "/cars/renault/?from=favorites");
  for (const unsafe of ["https://evil.example/", "//evil.example/", "/\\evil", "javascript:alert(1)"]) assert.equal(normalizeInternalReturnTo(unsafe), "/dashboard/");
});

test("Deal Finder feed uses shared semantic actions", () => {
  const component = read("src/components/deal-finder/DealFinderCard.astro");
  const client = read("src/lib/deal-finder/client.ts");
  assert.match(component, /ActionButton/);
  assert.match(client, /renderDealFinderAction/);
  for (const kind of ["source", "save", "viewed", "hide", "restore", "ai", "detail"]) assert.ok(`${component}\n${client}`.includes(`kind=\"${kind}\"`) || `${component}\n${client}`.includes(`kind: \"${kind}\"`));
  for (const variant of ["primary", "success", "warning", "neutral", "ai"]) assert.ok(`${component}\n${client}`.includes(`variant=\"${variant}\"`) || `${component}\n${client}`.includes(`variant: \"${variant}\"`));
});
