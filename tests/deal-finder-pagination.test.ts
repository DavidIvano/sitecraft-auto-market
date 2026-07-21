import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clampDealFinderPerPage,
  getDealFinderPageItems,
  getDealFinderResultRange,
  normalizeDealFinderPerPage,
  parseDealFinderUrlState,
  writeDealFinderUrlState,
} from "../src/lib/deal-finder/pagination.ts";
import { DEAL_FINDER_DEFAULT_PER_PAGE, DEAL_FINDER_MAX_PER_PAGE } from "../src/lib/deal-finder/constants.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("Deal Finder defaults to 100 results and never exceeds 100", () => {
  assert.equal(DEAL_FINDER_DEFAULT_PER_PAGE, 100);
  assert.equal(DEAL_FINDER_MAX_PER_PAGE, 100);
  assert.equal(normalizeDealFinderPerPage(undefined), 100);
  assert.equal(normalizeDealFinderPerPage(24), 24);
  assert.equal(normalizeDealFinderPerPage(48), 48);
  assert.equal(clampDealFinderPerPage(1000), 100);
});

test("Deal Finder ranges expose every result on the current page", () => {
  assert.equal(getDealFinderResultRange({ page: 1, per_page: 100, total: 40, total_pages: 1, has_next: false, has_previous: false }, 40), "Показано 1–40 из 40");
  assert.equal(getDealFinderResultRange({ page: 2, per_page: 100, total: 101, total_pages: 2, has_next: false, has_previous: true }, 1), "Показано 101–101 из 101");
  assert.deepEqual(getDealFinderPageItems(1, 2), [1, 2]);
  assert.equal(getDealFinderResultRange({ page: 2, per_page: 100, total: 243, total_pages: 3, has_next: true, has_previous: true }, 100), "Показано 101–200 из 243");
  assert.deepEqual(getDealFinderPageItems(5, 12), [1, "ellipsis", 4, 5, 6, "ellipsis", 12]);
});

test("URL state restores page, page size, sort and filters", () => {
  const restored = parseDealFinderUrlState(new URLSearchParams("page=2&per_page=48&sort=price_asc&search=golf&brand=Volkswagen&price_max=10000&deal_score_min=50"));
  assert.deepEqual(restored, {
    page: 2,
    per_page: 48,
    sort: "price_asc",
    search: "golf",
    brand: "Volkswagen",
    price_max: 10000,
    deal_score_min: 50,
  });

  const next = writeDealFinderUrlState(new URLSearchParams("keep=yes"), { ...restored, page: 1 });
  assert.equal(next.get("page"), "1");
  assert.equal(next.get("per_page"), "48");
  assert.equal(next.get("sort"), "price_asc");
  assert.equal(next.get("brand"), "Volkswagen");
  assert.equal(next.get("keep"), "yes");
});

test("pagination UI resets page for filters and page size without losing sort", () => {
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  assert.match(client, /page: 1,[\s\S]*per_page: normalizeDealFinderPerPage\(currentFilters\.per_page\)/);
  assert.match(client, /nextFilters = \{ \.\.\.currentFilters, page: 1, per_page:/);
  assert.match(client, /aria-label="Предыдущая страница"[\s\S]*pagination\.has_previous/);
  assert.match(client, /aria-label="Следующая страница"[\s\S]*pagination\.has_next/);
  assert.match(client, /aria-current="page"/);
  assert.match(client, /window\.addEventListener\("popstate"/);
});

test("filters and sorting happen before mock pagination and score paging uses the full server set", () => {
  const api = readProjectFile("src/lib/deal-finder/api.ts");
  const filterIndex = api.indexOf("const all = filterDealFinderMockListings(filters)");
  const sliceIndex = api.indexOf("all.slice((page - 1) * perPage");
  assert.ok(filterIndex >= 0 && sliceIndex > filterIndex);
  assert.match(api, /filters\.sort === "profit_desc"/);
  assert.match(api, /for \(let page = 2; page <= first\.pagination\.total_pages/);
  assert.match(api, /const matched = applyDealFinderScoreQuery\(all, filters\)/);
  assert.match(api, /matched\.slice\(start, start \+ requestedPerPage\)/);
});
