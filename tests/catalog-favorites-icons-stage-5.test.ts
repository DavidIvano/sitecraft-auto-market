import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderPublicCarCardMarkup } from "../src/lib/publicCarCard.ts";
import type { CarListing } from "../src/lib/types.ts";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const car = (views_total: number): CarListing => ({
  id: 95,
  slug: "bmw-520-2004-95",
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
  views_total,
});

test("homepage, catalog and dynamic results share the public card renderer", async () => {
  const component = await read("../src/components/CarCard.astro");
  const homepage = await read("../src/pages/index.astro");
  const catalog = await read("../src/pages/cars/index.astro");
  const favorites = await read("../src/pages/dashboard/favorites.astro");

  assert.match(component, /renderPublicCarCardMarkup/);
  assert.match(homepage, /<CarCard car=\{car\}/);
  assert.match(homepage, /renderPublicCarCardMarkup/);
  assert.match(catalog, /<CarCard car=\{car\}/);
  assert.match(catalog, /renderPublicCarCardMarkup/);
  assert.match(favorites, /renderPublicCarCardMarkup/);
});

test("card is a crawlable link with an independent accessible heart and exact views", () => {
  for (const value of [0, 7]) {
    const html = renderPublicCarCardMarkup(car(value));
    const linkEnd = html.indexOf("</a>");
    const heart = html.indexOf("data-car-favourite=\"95\"");
    assert.match(html, /<a class="car-card-link" href="\/cars\/bmw-520-2004-95\/\?lang=ru"/);
    assert.match(html, /data-lucide="eye"/);
    assert.match(html, /data-lucide="heart"/);
    assert.match(html, new RegExp(`<span>${value}<\\/span>`));
    assert.match(html, /aria-pressed="false"/);
    assert.ok(heart > linkEnd, "heart must remain outside the main link");
    assert.doesNotMatch(html, />Новое<\/span>/);
  }
});

test("favorite client uses fresh auth, one status batch, optimistic rollback and one listener", async () => {
  const client = await read("../src/lib/publicCarCardsClient.ts");
  assert.match(client, /getInitializedAuthToken\(\)/);
  assert.match(client, /API_ROUTES\.favoriteStatuses/);
  assert.match(client, /listing_ids: ids\.map\(Number\)/);
  assert.match(client, /method: nextSaved \? "POST" : "DELETE"/);
  assert.match(client, /setFavoriteState\(id, nextSaved\)/);
  assert.match(client, /setFavoriteState\(id, wasSaved\)/);
  assert.match(client, /response\.status === 401/);
  assert.match(client, /isSessionConfirmedExpired/);
  assert.match(client, /dataset\.publicCarCardsInstalled/);
  assert.match(client, /refreshPublicCarCardIcons/);
  assert.match(client, /CustomEvent\("car-favorite-changed"/);
  assert.doesNotMatch(client, /localStorage/);
});

test("favorites page retries GET, trusts server total and removes cards in place", async () => {
  const page = await read("../src/pages/dashboard/favorites.astro");
  assert.match(page, /fetchWithRetry/);
  assert.match(page, /payload\?\.total/);
  assert.match(page, /is_saved: true/);
  assert.match(page, /card\?\.remove\(\)/);
  assert.match(page, /renderEmpty\(\)/);
  assert.match(page, /data-favorites-retry/);
  assert.match(page, /redirectToLogin\("\/dashboard\/favorites\/"\)/);
  assert.match(page, /refreshPublicCarCardIcons/);
});

test("Lucide registry and dashboard addition actions use SVG icons", async () => {
  const icons = await read("../src/lib/appIcons.ts");
  const layout = await read("../src/layouts/BaseLayout.astro");
  const dashboard = await read("../src/pages/dashboard/index.astro");
  const listings = await read("../src/pages/dashboard/listings.astro");
  for (const name of ["Eye", "Heart", "Plus", "CarFront", "MoreHorizontal", "Pencil", "Trash2"]) {
    assert.match(icons, new RegExp(`\\b${name}\\b`));
  }
  assert.match(layout, /installAppIcons\(document\)/);
  assert.match(layout, /icon: "plus"/);
  assert.match(dashboard, /data-lucide="(heart|settings|radar)"/);
  assert.match(listings, /data-lucide="plus"/);
});

test("tile cards have content height and no legacy 548px rule", async () => {
  const css = await read("../src/styles/global.css");
  assert.doesNotMatch(css, /min-height:\s*548px/);
  assert.match(css, /#live-cars-grid\.catalog-grid:not\(\.catalog-grid-list\)[\s\S]*?align-items:\s*start/);
  assert.match(css, /\.public-car-card[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*0/);
  assert.match(css, /\.car-card-footer-meta[\s\S]*?white-space:\s*nowrap/);
});

test("favorite and secondary public card endpoints expose views without N+1", async () => {
  const favorites = await read("../docs/xano/public-favorites-contacts/endpoints.xs");
  const related = await read("../docs/xano-endpoint-get-cars-slug-related.xs");
  const seller = await read("../docs/xano-endpoint-get-cars-slug-seller-listings.xs");
  for (const source of [favorites, related, seller]) {
    assert.match(source, /db\.query listing_views/);
    assert.match(source, /views_total\s*:/);
    assert.match(source, /try_catch[\s\S]*catch/);
  }
  assert.doesNotMatch(favorites.slice(favorites.indexOf("foreach ($favorites.items)", favorites.indexOf("var $items"))), /db\.query listing_views/);
  assert.doesNotMatch(related.slice(related.indexOf("var $related")), /db\.query listing_views/);
  assert.doesNotMatch(seller.slice(seller.indexOf("var $public_cars")), /db\.query listing_views/);
});
