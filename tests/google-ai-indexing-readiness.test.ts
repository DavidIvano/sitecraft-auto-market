import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getDefaultLocalizedPath } from "../src/i18n/routes.ts";
import { SEO_SITEMAP_SEED_PATHS } from "../src/lib/seo/sitemapPolicy.ts";
import { renderUrlSet } from "../src/lib/seo/sitemapXml.ts";
import { normalizeBoundedSeoTaxonomyCountsPage } from "../src/lib/seo/taxonomyApi.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("x-default resolves to the stable default-locale canonical instead of a query/cookie route", () => {
  assert.equal(getDefaultLocalizedPath("/"), "/de/");
  assert.equal(getDefaultLocalizedPath("/en/cars/audi-a3-1/"), "/de/cars/audi-a3-1/");
  assert.equal(getDefaultLocalizedPath("/ru/cars/fuel/petrol/"), "/de/cars/fuel/petrol/");
});

test("sitemap XML normalizes epoch milliseconds and seed policy prioritizes catalogue discovery", () => {
  const xml = renderUrlSet([{ loc: "https://automarket.sitecraft.agency/de/cars/", lastmod: "1786831248000" }]);
  assert.match(xml, /<lastmod>2026-08-15T22:00:48\.000Z<\/lastmod>/);
  assert.deepEqual([...SEO_SITEMAP_SEED_PATHS], ["/", "/cars/"]);

  const route = read("src/pages/sitemaps/[locale].xml.ts");
  assert.match(route, /SEO_SITEMAP_SEED_PATHS/);
  assert.doesNotMatch(route, /PUBLIC_STATIC_PAGE_CODES/);
});

test("bounded taxonomy lastmod is normalized at the Xano boundary", () => {
  const result = normalizeBoundedSeoTaxonomyCountsPage({
    items: [{ type: "brand", slug: "audi", label: "Audi", count: 1, lastmod: 1786831248000 }],
    pagination: { page: 1, limit: 500, total: 1, total_pages: 1 },
  }, { locale: "de", requestedPage: 1 });
  assert.equal(result.facets[0]?.lastmod, "2026-08-15T22:00:48.000Z");
});

test("structured data identifies the publisher without creating a templated search crawl trap", () => {
  const layout = read("src/layouts/BaseLayout.astro");
  assert.match(layout, /publisherId/);
  assert.match(layout, /publisher: \{ "@id": publisherId \}/);
  assert.match(layout, /name: "SiteCraft Agency"/);
  assert.doesNotMatch(layout, /SearchAction|search_term_string/);
});

test("robots explicitly allows answer-engine search while excluding private application routes", () => {
  const robots = read("src/pages/robots.txt.ts");
  assert.match(robots, /privateRules = `[^`]*Disallow: \/admin\/[^`]*Disallow: \/dashboard\//s);
  assert.match(robots, /User-agent: OAI-SearchBot[\s\S]*Allow: \/[\s\S]*\$\{privateRules\}/);
  assert.match(robots, /User-agent: \*[\s\S]*\$\{privateRules\}/);
  assert.match(robots, /Sitemap:/);
});

test("localized shared navigation never leaks crawlable legacy public URLs", () => {
  const footer = read("src/components/Footer.astro");
  const cookie = read("src/components/CookieNotice.astro");
  assert.match(footer, /publicHref\("\/cars\/"\)/);
  assert.match(footer, /publicHref\("\/support\/"\)/);
  assert.doesNotMatch(footer, /\/admin\/moderation|href: "\/dashboard"/);
  assert.match(cookie, /getLocalizedPath\("\/privacy\/", locale\)/);
});
