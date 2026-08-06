import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { translateUiHtml, translateUiValue } from "../src/i18n/uiTranslator.ts";

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("universal UI translation covers titles, dynamic counters and shared options", () => {
  assert.equal(translateUiValue("Тарифы | SiteCraft Auto Market", "de"), "Tarife | SiteCraft Auto Market");
  assert.equal(translateUiValue("7 дней", "en"), "7 days");
  assert.equal(translateUiValue("До 50 активных объявлений", "de"), "Bis zu 50 aktive Anzeigen");
  assert.equal(translateUiValue("Частное лицо", "en"), "Private person");
});

test("server translation preserves marked backend and seller content", () => {
  const html = '<main><h1>Тарифы</h1><article data-i18n-skip><h2>Русский заголовок продавца</h2><p>Бензин</p></article><span>Бензин</span></main>';
  const translated = translateUiHtml(html, "de");
  assert.match(translated, /<h1>Tarife<\/h1>/);
  assert.match(translated, /<h2>Русский заголовок продавца<\/h2><p>Бензин<\/p>/);
  assert.match(translated, /<span>Benzin<\/span>/);
});

test("every Astro page uses the multilingual BaseLayout", () => {
  const pagesRoot = new URL("../src/pages/", import.meta.url);
  const pages: string[] = [];
  const visit = (directory: URL) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".astro")) pages.push(readFileSync(target, "utf8"));
    }
  };
  visit(pagesRoot);
  assert.ok(pages.length >= 35);
  for (const page of pages) assert.match(page, /<BaseLayout\b/);
});

test("client i18n waits for the body and preserves locale in internal links", () => {
  const layout = readProjectFile("src/layouts/BaseLayout.astro");
  assert.match(layout, /DOMContentLoaded/);
  assert.match(layout, /url\.searchParams\.set\("lang", activeLocale\)/);
  assert.match(layout, /MutationObserver/);
  assert.match(layout, /hreflang="x-default"/);
});

test("Cloudflare and compatibility redirects keep every page and locale reachable", () => {
  const routes = JSON.parse(readProjectFile("public/_routes.json"));
  assert.deepEqual(routes.include, ["/*"]);
  const redirect = readProjectFile("functions/dashboard/cars/[id]/promote.ts");
  assert.match(redirect, /const locale = url\.searchParams\.get\("lang"\)/);
  assert.match(redirect, /url\.searchParams\.set\("lang", locale\)/);
});
