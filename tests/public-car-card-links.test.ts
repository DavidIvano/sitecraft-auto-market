import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("public CarCard delegates to one compact safe renderer", () => {
  const source = readProjectFile("src/components/CarCard.astro");
  const renderer = readProjectFile("src/lib/publicCarCard.ts");
  assert.match(source, /renderPublicCarCardMarkup/);
  assert.match(renderer, /class=\"car-card-link\" href=/);
  assert.match(renderer, /data-car-card-link/);
  assert.doesNotMatch(renderer, /role=\"link\" tabindex=\"0\"/);
  assert.doesNotMatch(renderer, /Подробнее/);
});

test("public card links preserve the selected page language", () => {
  const renderer = readProjectFile("src/lib/publicCarCard.ts");

  assert.match(renderer, /const detailPath = safeSlugPath\(car\.slug, locale,/);
  assert.match(renderer, /startsWith\("localized_"\)/);
  assert.match(renderer, /\?lang=\$\{encodeURIComponent\(locale\)\}/);
});

test("dynamic home and catalog cards use the same safe public-card contract", () => {
  const home = readProjectFile("src/pages/index.astro");
  const catalog = readProjectFile("src/pages/cars/index.astro");

  for (const source of [home, catalog]) {
    assert.match(source, /renderPublicCarCardMarkup/);
    assert.match(source, /installPublicCarCardInteractions/);
    assert.doesNotMatch(source, /car-card-details[^\n]*Подробнее/);
  }
});

test("seller and similar public cards retain semantic detail links", () => {
  const detail = readProjectFile("src/pages/cars/[slug].astro");

  assert.match(detail, /sellerCars\.map\(\(sellerCar\) => <CarCard car=\{sellerCar\} source="seller_listings" locale=\{locale\} \/>\)/);
  assert.match(detail, /<CarCard car=\{similarCar\} source="similar_cars" locale=\{locale\} \/>/);
});

test("public-card styles provide zoom, focus, list-view and touch-safe behavior", () => {
  const styles = readProjectFile("src/styles/components/car-card.css");

  assert.match(styles, /\.public-car-card \{[\s\S]*?cursor:\s*default/);
  assert.match(styles, /\.public-car-card \.car-card-link/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.public-car-card:hover/);
  assert.match(styles, /\.catalog-grid-list \.public-car-card \.car-card-link[\s\S]*?grid-template-columns/);
});

test("dashboard and moderation retain their explicit management actions", () => {
  const dashboard = readProjectFile("src/pages/dashboard/listings.astro");
  const moderation = readProjectFile("src/pages/admin/moderation.astro");

  assert.match(dashboard, /Редактировать/);
  assert.match(dashboard, /Удалить/);
  assert.match(moderation, /Одобрить/);
  assert.match(moderation, /Отклонить/);
});
