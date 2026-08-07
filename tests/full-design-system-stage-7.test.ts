import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("public and workspace shells are structurally separated", async () => {
  const layout = await read("../src/layouts/BaseLayout.astro");
  assert.match(layout, /type LayoutVariant = "public" \| "workspace" \| "legal" \| "auth"/);
  assert.match(layout, /layoutVariant === "workspace" && <aside/);
  assert.match(layout, /layoutVariant !== "workspace" && <Footer/);
});

test("tokens expose the canonical compact geometry and semantic palette", async () => {
  const tokens = await read("../src/styles/tokens.css");
  for (const token of [
    "--space-1: 4px", "--space-16: 64px", "--radius-control: 10px",
    "--radius-card: 16px", "--radius-panel: 20px", "--radius-window: 24px",
    "--control-md: 44px", "--container-max: 1440px", "--page-bg: #0b0d12",
  ]) assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("active design system is modular and legacy CSS is isolated", async () => {
  const layout = await read("../src/layouts/BaseLayout.astro");
  const legacy = await read("../src/styles/global.css");
  for (const file of ["tokens.css", "base.css", "layout.css", "components/header.css", "components/car-card.css", "components/catalog.css", "components/dashboard.css"]) {
    assert.match(layout, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(legacy, /^@layer legacy \{/);
  assert.doesNotMatch(layout, /design-system\.css/);
});

test("public cards are unified, equal-height and use four compact facts", async () => {
  const renderer = await read("../src/lib/publicCarCard.ts");
  const cardCss = await read("../src/styles/components/car-card.css");
  assert.match(renderer, /class="car-card-title"/);
  for (const icon of ["calendar", "gauge", "fuel", "settings-2", "eye"]) assert.match(renderer, new RegExp(`data-lucide="${icon}"`));
  assert.match(renderer, /car-card-location/);
  assert.match(renderer, /listing-status-badge/);
  assert.match(cardCss, /min-height: 0/);
  assert.match(cardCss, /--public-card-height: 430px/);
  assert.match(cardCss, /--public-card-media-height: 210px/);
  assert.match(cardCss, /object-fit: cover/);
  assert.match(cardCss, /--mobile-media-width: 44%/);
  assert.doesNotMatch(cardCss, /548px|height:\s*360px/);
});

test("catalog uses desktop sidebar, compact grid and mobile drawer", async () => {
  const page = await read("../src/pages/cars/index.astro");
  const css = await read("../src/styles/components/catalog.css");
  assert.match(page, /class="container catalog-layout"/);
  assert.match(page, /catalog-mobile-filter-button/);
  assert.match(page, /setFilterDrawerOpen/);
  assert.match(css, /grid-template-columns: 304px minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test("header drawer uses Lucide controls, body lock, backdrop and focus return", async () => {
  const header = await read("../src/components/Header.astro");
  assert.match(header, /data-lucide="menu"/);
  assert.match(header, /data-lucide="x"/);
  assert.match(header, /header-backdrop/);
  assert.match(header, /is-drawer-open/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /menuToggle\.focus\(\)/);
});
