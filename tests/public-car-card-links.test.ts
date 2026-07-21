import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("public CarCard separates image zoom from detail navigation", () => {
  const source = readProjectFile("src/components/CarCard.astro");

  assert.match(source, /data-lightbox-trigger/);
  assert.match(source, /data-lightbox-sources=\{JSON\.stringify/);
  assert.match(source, /<h3>\{detailPath \? <a href=\{detailPath\}>/);
  assert.match(source, /class="button button-light car-card-details"/);
  assert.doesNotMatch(source, /<a class="car-card-link"/);
});

test("dynamic home and catalog cards use the same safe public-card contract", () => {
  const home = readProjectFile("src/pages/index.astro");
  const catalog = readProjectFile("src/pages/cars/index.astro");

  for (const source of [home, catalog]) {
    assert.match(source, /const rawSlug = String\(car\.slug/);
    assert.match(source, /const detailPath = rawSlug \? `\/cars\/\$\{encodeURIComponent\(rawSlug\)\}` : ""/);
    assert.match(source, /data-lightbox-trigger/);
    assert.match(source, /car-card-composite/);
    assert.match(source, /class="button button-light car-card-details"/);
    assert.match(source, /car-card-link-disabled/);
    assert.doesNotMatch(source, /href="\/cars\/\$\{slug\}"[^\n]*>Смотреть/);
  }
});

test("seller and similar public cards retain semantic detail links", () => {
  const detail = readProjectFile("src/pages/cars/[slug].astro");

  assert.match(detail, /sellerCars\.map\(\(sellerCar\) => <CarCard car=\{sellerCar\} \/>\)/);
  assert.match(detail, /<a class="similar-car-card"[\s\S]*?href=\{`\/cars\/\$\{similarCar\.slug\}`\}/);
  assert.match(detail, /aria-label=\{`Открыть объявление \$\{similarCar\.title\}`\}/);
});

test("public-card styles provide zoom, focus, list-view and touch-safe behavior", () => {
  const styles = readProjectFile("src/styles/global.css");

  assert.match(styles, /\.car-card-link\s*\{[\s\S]*?cursor:\s*pointer/);
  assert.match(styles, /\.vehicle-image-trigger:focus-visible[\s\S]*?outline/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.car-card:hover/);
  assert.match(styles, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?transform:\s*none/);
  assert.match(styles, /#live-cars-grid\.catalog-grid\.catalog-grid-list \.car-card-link\s*\{[\s\S]*?grid-template-columns/);
});

test("dashboard and moderation retain their explicit management actions", () => {
  const dashboard = readProjectFile("src/pages/dashboard/listings.astro");
  const moderation = readProjectFile("src/pages/admin/moderation.astro");

  assert.match(dashboard, /Редактировать/);
  assert.match(dashboard, /Удалить/);
  assert.match(moderation, /Одобрить/);
  assert.match(moderation, /Отклонить/);
});
