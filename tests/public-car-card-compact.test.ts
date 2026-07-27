import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderPublicCarCardMarkup } from "../src/lib/publicCarCard.ts";
import type { CarListing } from "../src/lib/types.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");
const car = (overrides: Partial<CarListing> = {}): CarListing => ({
  id: 12, slug: "vw-golf", title: "Volkswagen Golf Comfortline с очень длинным названием", brand: "Volkswagen", model: "Golf",
  year: 2020, mileage: 54000, fuel_type: "Diesel", transmission: "Automatik", price: 15900, currency: "EUR",
  city: "Berlin", country: "DE", status: "approved", moderation_status: "approved", published_at: "2026-07-20T10:00:00Z",
  main_image_url: "https://images.example.com/golf.jpg", image_urls: ["https://images.example.com/golf.jpg", "https://images.example.com/golf-2.jpg"],
  description: "This must never be rendered in a compact card", ...overrides,
});

test("compact public card has no details button or description and keeps required facts", () => {
  const html = renderPublicCarCardMarkup(car());
  assert.doesNotMatch(html, /Подробнее|This must never/);
  for (const value of ["Volkswagen Golf", "15", "2020", "54", "Diesel", "Automatik", "Berlin"]) assert.match(html, new RegExp(value));
  assert.match(html, /class="car-card-link" href="\/cars\/vw-golf\/"/);
  assert.doesNotMatch(html, /data-lightbox-trigger|car-card-image-button/);
});

test("premium is disclosed and unsafe card images are rejected", () => {
  const premium = renderPublicCarCardMarkup(car({ promotion: { status: "active", promotion_type: "premium", placement: "catalog_and_homepage", priority: 100, starts_at: "2026-07-20", ends_at: "2099-07-27" } }));
  assert.match(premium, /Premium/);
  assert.match(premium, /Продвигается/);
  const unsafe = renderPublicCarCardMarkup(car({ main_image_url: "javascript:alert(1)", image_urls: [] }));
  assert.doesNotMatch(unsafe, /javascript:/);
  assert.match(unsafe, /Фото пока не добавлено/);
});

test("card client keeps native navigation and Xano-backed favourite targets", () => {
  const client = readProjectFile("src/lib/publicCarCardsClient.ts");
  assert.match(client, /API_ROUTES\.favorite\(id\)/);
  assert.match(client, /method: nextSaved \? "POST" : "DELETE"/);
  assert.match(client, /redirectToLogin/);
  assert.doesNotMatch(client, /localStorage|FAVOURITES_KEY|window\.location\.assign/);
});

test("compact card CSS clamps titles, fixes media ratio and has responsive columns", () => {
  const css = readProjectFile("src/styles/global.css");
  assert.match(css, /\.public-car-card h3[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.match(css, /\.public-car-card \.car-card-media[\s\S]*?aspect-ratio:\s*16 \/ 10/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 599px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.car-card-favourite[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(css, /\.catalog-view-switch button[\s\S]*?min-height:\s*44px/);
});
