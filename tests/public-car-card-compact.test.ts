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
  for (const value of ["Volkswagen Golf", "15", "2020", "54", "Дизель", "Автомат", "Berlin"]) assert.match(html, new RegExp(value));
  assert.match(html, /car-card-location[\s\S]*Berlin/);
  assert.match(html, /car-card-footer[\s\S]*car-card-location[\s\S]*Berlin/);
  assert.doesNotMatch(html.match(/<div class="car-card-media">[\s\S]*?<\/div>\s*<div class="car-card-body">/)?.[0] || "", /car-card-location/);
  assert.match(html, /listing-status-badge[\s\S]*В продаже/);
  assert.match(html, /car-card-media-views/);
  assert.match(html, /class="car-card-link" href="\/cars\/vw-golf\/\?lang=ru"/);
  assert.doesNotMatch(html, /data-lightbox-trigger|car-card-image-button/);
});

test("premium is disclosed and unsafe card images are rejected", () => {
  const premium = renderPublicCarCardMarkup(car({ promotion: { status: "active", promotion_type: "premium", placement: "catalog_and_homepage", priority: 100, starts_at: "2026-07-20", ends_at: "2099-07-27" } }));
  assert.match(premium, /Премиум/);
  assert.match(premium, /Продвигается/);
  assert.match(premium, /car-card-premium-banner[\s\S]*data-lucide="crown"/);
  assert.match(premium, /car-card-premium-marker[\s\S]*data-lucide="gem"/);
  const unsafe = renderPublicCarCardMarkup(car({ main_image_url: "javascript:alert(1)", image_urls: [] }));
  assert.doesNotMatch(unsafe, /javascript:/);
  assert.match(unsafe, /Фото пока не добавлено/);
});

test("homepage premium section is rendered before all regular cars", () => {
  const homepage = readProjectFile("src/pages/index.astro");
  const premiumSection = homepage.indexOf('id="homepage-promotions"');
  const regularSection = homepage.indexOf('class="section home-all-cars"');
  assert.ok(premiumSection >= 0, "premium section must exist");
  assert.ok(regularSection >= 0, "regular cars section must exist");
  assert.ok(premiumSection < regularSection, "premium cars must be above regular cars");
  assert.match(homepage, /homepagePromotedCars\.map[\s\S]*source="homepage_premium"/);
});

test("premium card modifier uses the shared card and gold visual language", () => {
  const css = readProjectFile("src/styles/promotions.css");
  const systemCss = readProjectFile("src/styles/premium-system.css");
  for (const marker of ["#e9b949", "#ffd978", "car-card-premium-banner", "car-card-premium-marker", "--premium-gold"]) {
    assert.match(css, new RegExp(marker));
  }
  assert.doesNotMatch(css, /#9a72e8|#8058d6/);
  assert.match(systemCss, /\.public-car-card:is\(\.car-card-premium, \.is-homepage-premium\) \.car-card-premium-marker[\s\S]*?bottom:\s*auto/);
  assert.match(systemCss, /\.public-car-card \.car-card-premium-banner \{[\s\S]*?left:\s*12px[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
  assert.match(systemCss, /@media \(max-width: 640px\)[\s\S]*?\.public-car-card \.car-card-premium-marker \{\s*display:\s*none/);
  assert.match(systemCss, /@media \(max-width: 640px\)[\s\S]*?\.public-car-card \.car-card-price-row \{[\s\S]*?flex-direction:\s*row[\s\S]*?justify-content:\s*space-between/);
  assert.match(systemCss, /\.public-car-card \{[\s\S]*?animation:\s*none/);
  assert.match(systemCss, /\.mac-main > :where\(\.detail-properties-section, \.detail-description-section\) \{[\s\S]*?content-visibility:\s*auto/);
  assert.doesNotMatch(systemCss, /\.mac-main > :where\([^)]*\.homepage-promotions[^)]*\) \{[\s\S]*?content-visibility:\s*auto/);
});

test("card client keeps native navigation and Xano-backed favourite targets", () => {
  const client = readProjectFile("src/lib/publicCarCardsClient.ts");
  assert.match(client, /API_ROUTES\.favorite\(id\)/);
  assert.match(client, /method: nextSaved \? "POST" : "DELETE"/);
  assert.match(client, /redirectToLogin/);
  assert.doesNotMatch(client, /localStorage|FAVOURITES_KEY|window\.location\.assign/);
});

test("compact card CSS clamps titles and fixes card and media dimensions", () => {
  const css = readProjectFile("src/styles/components/car-card.css") + readProjectFile("src/styles/components/public-pages.css") + readProjectFile("src/styles/components/catalog.css");
  assert.match(css, /\.public-car-card \.car-card-title[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.match(css, /--public-card-height:\s*430px/);
  assert.match(css, /--public-card-media-height:\s*210px/);
  assert.match(css, /height:\s*var\(--public-card-height\)/);
  assert.match(css, /\.public-car-card \.car-image[\s\S]*?object-fit:\s*cover/);
  assert.match(css, /\.catalog-grid-list \.public-car-card[\s\S]*?--public-card-height:\s*238px/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?--public-card-height:\s*222px/);
  assert.match(css, /\.public-car-card \.car-card-media-views \{ inset-block-end:\s*var\(--space-3\)/);
  assert.match(css, /\.public-car-card \.car-card-location \{[^}]*margin-inline-start:\s*auto/);
  assert.doesNotMatch(css, /\.public-car-card \.car-card-location \{[^}]*position:\s*absolute/);
  assert.match(css, /\.public-car-card \.car-card-overlay-badges \{[^}]*inset-block-start:\s*auto;[^}]*inset-block-end:\s*var\(--space-3\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.public-car-card \.car-card-media-views \{ inset-block-end:\s*10px/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.public-car-card \.car-card-overlay-badges \{ inset-block-end:\s*10px; inset-inline:\s*10px 60px/);
  assert.doesNotMatch(css, /car-card-overlay-badges \{ inset:\s*auto 10px 46px 10px/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns:\s*var\(--mobile-media-width\) minmax\(0, 1fr\)/);
  assert.match(css, /\.public-car-card \.favorite-button[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
  assert.match(css, /\.catalog-view-switch button[\s\S]*?width:\s*44px[\s\S]*?height:\s*40px/);
});
