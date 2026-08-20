import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePublicCarListing } from "../src/lib/publicCar.ts";
import { getCanonicalSeoCity, getSeoRegionForLocation } from "../src/lib/seo/locationSeo.ts";
import {
  SEO_TAXONOMY_MIN_LISTINGS,
  buildListingSeoTaxonomyLinks,
  buildRelatedSeoTaxonomyGroups,
  buildSeoTaxonomyGraph,
  buildSeoTaxonomyMetadata,
  findSeoTaxonomyFacet,
  getIndexableSeoTaxonomyFacets,
  getTaxonomyCanonicalPath,
  hasSeoFilterQuery,
  isSeoTaxonomyFacetIndexable,
} from "../src/lib/seo/taxonomies.ts";
import { resolveSeoTaxonomyPage } from "../src/lib/seo/taxonomyPage.ts";
import {
  SeoTaxonomyContractError,
  normalizeBoundedSeoTaxonomyPage,
  normalizeBoundedSeoTaxonomyCountsPage,
  resolveBoundedSeoTaxonomyPage,
} from "../src/lib/seo/taxonomyApi.ts";
import type { CarListing } from "../src/lib/types.ts";

const projectRoot = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, projectRoot), "utf8");

const car = (id: number, overrides: Partial<CarListing> = {}): CarListing => ({
  id,
  slug: `audi-a3-${id}`,
  title: `Audi A3 ${id}`,
  description: "Reviewed public description",
  brand: "Audi",
  model: "A3",
  year: 2020,
  mileage: 80_000,
  fuel_type: "Benzin",
  body_type: "SUV",
  transmission: "Automatik",
  price: 4_500,
  currency: "EUR",
  city: "Peine",
  country: "DE",
  status: "approved",
  moderation_status: "approved",
  available_locales: ["de", "en", "ru"],
  updated_at: `2026-08-${String(10 + id).padStart(2, "0")}T10:00:00.000Z`,
  ...overrides,
});

test("taxonomy normalization collapses city case and consumes additive Xano identifiers", () => {
  assert.equal(getCanonicalSeoCity("Peine"), "Peine");
  assert.equal(getCanonicalSeoCity("peine"), "Peine");
  assert.equal(getCanonicalSeoCity("PEINE"), "Peine");
  assert.equal(getSeoRegionForLocation({ city: "PEINE" })?.slug, "niedersachsen");

  const normalized = normalizePublicCarListing({
    ...car(1),
    brand_slug: "audi",
    model_slug: "a3",
    city_slug: "peine",
    region_slug: "niedersachsen",
    region: "Niedersachsen",
  });
  assert.ok(normalized);
  assert.equal(normalized.brand_slug, "audi");
  assert.equal(normalized.region_slug, "niedersachsen");
});

test("one graph builds brand, model, city, region, fuel, body and fixed price facets", () => {
  const graph = buildSeoTaxonomyGraph([
    car(1, { city: "Peine" }),
    car(2, { city: "peine", brand: "AUDI" }),
    car(3, { city: "PEINE", fuel_type: "petrol", body_type: "suv" }),
  ]);
  assert.equal(graph.byType.brand.length, 1);
  assert.equal(graph.byType.model.length, 1);
  assert.equal(graph.byType.city.length, 1);
  assert.equal(graph.byType.city[0]?.slug, "peine");
  assert.equal(graph.byType.region[0]?.slug, "niedersachsen");
  assert.equal(graph.byType.fuel[0]?.slug, "petrol");
  assert.equal(graph.byType.body[0]?.slug, "suv");
  assert.ok(graph.byType.price.some((facet) => facet.slug === "under-5000"));
  assert.ok(graph.byType.price.some((facet) => facet.slug === "under-10000"));
});

test("central indexability gate keeps thin pages out while retaining brand and model", () => {
  const thinGraph = buildSeoTaxonomyGraph([car(1), car(2)]);
  const brand = findSeoTaxonomyFacet(thinGraph, "brand", "Audi");
  const city = findSeoTaxonomyFacet(thinGraph, "city", "PEINE");
  assert.ok(brand && city);
  assert.equal(SEO_TAXONOMY_MIN_LISTINGS.brand, 1);
  assert.equal(SEO_TAXONOMY_MIN_LISTINGS.city, 3);
  assert.equal(isSeoTaxonomyFacetIndexable(brand, "de", { strictSeoRelease: true }), true);
  assert.equal(isSeoTaxonomyFacetIndexable(city, "de", { strictSeoRelease: true }), false);

  const fullGraph = buildSeoTaxonomyGraph([car(1), car(2), car(3)]);
  const indexableTypes = new Set(getIndexableSeoTaxonomyFacets(fullGraph, "de").map((facet) => facet.type));
  for (const type of ["brand", "model", "city", "region", "fuel", "body", "price"]) assert.ok(indexableTypes.has(type as never), type);
});

test("route resolution returns canonical redirects, noindex thin/filter pages and real 404", () => {
  const cars = [car(1), car(2), car(3)];
  const graph = buildSeoTaxonomyGraph(cars);
  const catalog = { cars, graph, strictSeoRelease: true };
  const canonical = resolveSeoTaxonomyPage({ locale: "de", type: "region", slug: "niedersachsen", url: new URL("https://example.test/de/cars/region/niedersachsen/"), catalog, previewNoindex: false });
  assert.equal(canonical.status, "ok");
  if (canonical.status === "ok") {
    assert.equal(canonical.noindex, false);
    assert.equal(canonical.canonicalPath, "/de/cars/region/niedersachsen/");
    assert.match(canonical.heading, /Gebrauchtwagen in Niedersachsen/);
  }

  const redirect = resolveSeoTaxonomyPage({ locale: "de", type: "brand", slug: "Audi", url: new URL("https://example.test/de/cars/brand/Audi/"), catalog, previewNoindex: false });
  assert.deepEqual(redirect, { status: "redirect", location: "/de/cars/brand/audi/" });

  const filtered = resolveSeoTaxonomyPage({ locale: "de", type: "fuel", slug: "petrol", url: new URL("https://example.test/de/cars/fuel/petrol/?transmission=automatic"), catalog, previewNoindex: false });
  assert.equal(filtered.status, "ok");
  if (filtered.status === "ok") {
    assert.equal(filtered.noindex, true);
    assert.equal(filtered.canonicalPath, "/de/cars/fuel/petrol/");
  }

  const thinCars = [car(1), car(2)];
  const thin = resolveSeoTaxonomyPage({ locale: "de", type: "city", slug: "peine", url: new URL("https://example.test/de/cars/city/peine/"), catalog: { cars: thinCars, graph: buildSeoTaxonomyGraph(thinCars), strictSeoRelease: true }, previewNoindex: false });
  assert.equal(thin.status, "ok");
  if (thin.status === "ok") assert.equal(thin.noindex, true);

  const missing = resolveSeoTaxonomyPage({ locale: "de", type: "fuel", slug: "hydrogen", url: new URL("https://example.test/de/cars/fuel/hydrogen/"), catalog, previewNoindex: false });
  assert.deepEqual(missing, { status: "not_found" });
});

test("bounded taxonomy contract resolves SSR cards without loading the full catalog", () => {
  const payload = normalizeBoundedSeoTaxonomyPage({
    facet: {
      type: "city",
      slug: "peine",
      label: "Peine",
      region_slug: "niedersachsen",
      region_label: "Niedersachsen",
      total: 3,
      ready_locales: ["de", "en", "ru"],
      lastmod: "2026-08-20T12:00:00.000Z",
    },
    items: [car(1), car(2), car(3)],
    pagination: { page: 1, limit: 24, total: 3, total_pages: 1 },
    related_groups: [{
      type: "fuel",
      items: [{ type: "fuel", slug: "petrol", code: "petrol", label: "petrol", count: 3 }],
    }],
  }, { locale: "de", type: "city", requestedPage: 1 });
  assert.ok(payload);
  assert.equal(payload.items.length, 3);
  assert.equal(payload.facet.cars.length, 3);
  assert.equal(payload.facet.count, 3);

  const resolution = resolveBoundedSeoTaxonomyPage({
    locale: "de",
    type: "city",
    slug: "peine",
    url: new URL("https://example.test/de/cars/city/peine/"),
    payload,
    previewNoindex: false,
  });
  assert.equal(resolution.status, "ok");
  if (resolution.status === "ok") {
    assert.equal(resolution.dataSource, "xano_bounded");
    assert.equal(resolution.noindex, false);
    assert.equal(resolution.total, 3);
    assert.equal(resolution.cars.length, 3);
    assert.deepEqual(resolution.breadcrumbs.map((item) => item.label), [
      "Fahrzeuge sicher finden und verkaufen",
      "Fahrzeuge",
      "Niedersachsen",
      "Peine",
    ]);
    assert.ok(resolution.relatedGroups[0]?.links.some((link) => link.href === "/de/cars/fuel/petrol/"));
  }
});

test("bounded taxonomy contract fails closed for unbounded or inconsistent responses", () => {
  assert.throws(() => normalizeBoundedSeoTaxonomyPage({
    facet: { type: "fuel", slug: "petrol", label: "petrol", total: 100 },
    items: [car(1)],
    pagination: { page: 1, limit: 100, total: 100 },
  }, { locale: "de", type: "fuel", requestedPage: 1 }), SeoTaxonomyContractError);

  const empty = normalizeBoundedSeoTaxonomyPage({
    facet: { type: "fuel", slug: "hydrogen", label: "hydrogen", total: 0 },
    items: [],
    pagination: { page: 1, limit: 24, total: 0 },
  }, { locale: "de", type: "fuel", requestedPage: 1 });
  assert.equal(empty, null);
});

test("bounded counts contract supplies sitemap facets without listing rows", () => {
  const result = normalizeBoundedSeoTaxonomyCountsPage({
    locale: "de",
    items: [
      { type: "region", slug: "niedersachsen", label: "Niedersachsen", count: 3, indexable: true, lastmod: "2026-08-20T12:00:00.000Z" },
      { type: "city", slug: "ilsede", label: "Ilsede", count: 2, indexable: false },
    ],
    pagination: { page: 1, limit: 500, total: 2, total_pages: 1 },
  }, { locale: "de", requestedPage: 1 });
  assert.equal(result.facets.length, 1);
  assert.equal(result.facets[0]?.slug, "niedersachsen");
  assert.equal(result.facets[0]?.cars.length, 0);
  assert.equal(result.facets[0]?.count, 3);
});

test("listing and related links are SSR-ready and only target real indexable facets", () => {
  const cars = [car(1), car(2), car(3)];
  const links = buildListingSeoTaxonomyLinks(cars[0]!, "de");
  assert.deepEqual(new Set(links.map((link) => link.type)), new Set(["brand", "model", "city", "region", "fuel", "body", "price"]));
  assert.ok(links.some((link) => link.href === "/de/cars/fuel/petrol/" && link.label === "Benzin"));
  assert.ok(links.some((link) => link.href === "/de/cars/price/under-5000/"));

  const graph = buildSeoTaxonomyGraph(cars);
  const fuel = findSeoTaxonomyFacet(graph, "fuel", "petrol");
  assert.ok(fuel);
  const groups = buildRelatedSeoTaxonomyGroups(graph, fuel, "de");
  assert.ok(groups.flatMap((group) => group.links).every((link) => !link.href.includes("?")));
  assert.ok(groups.flatMap((group) => group.links).some((link) => link.href === "/de/cars/region/niedersachsen/"));
});

test("metadata, pagination canonical and filter safeguards are deterministic", () => {
  const graph = buildSeoTaxonomyGraph([car(1), car(2), car(3)]);
  const price = findSeoTaxonomyFacet(graph, "price", "under-5000");
  assert.ok(price);
  const metadata = buildSeoTaxonomyMetadata(price, "de");
  assert.equal(metadata.heading, "Gebrauchtwagen bis 5.000 €");
  assert.match(metadata.description, /3/);
  assert.equal(getTaxonomyCanonicalPath("de", price, 2), "/de/cars/price/under-5000/?page=2");
  assert.equal(hasSeoFilterQuery(new URLSearchParams("page=2&utm_source=test")), false);
  assert.equal(hasSeoFilterQuery(new URLSearchParams("brand=audi&fuel=diesel")), true);
});

test("route, component, detail and sitemap contracts contain the new SEO invariants", () => {
  const route = readProjectFile("src/pages/[locale]/cars/[taxonomy]/[slug].astro");
  const component = readProjectFile("src/components/catalog/LocalizedTaxonomyCatalog.astro");
  const detail = readProjectFile("src/pages/[locale]/cars/[slug].astro");
  const sitemap = readProjectFile("src/pages/sitemaps/[locale].xml.ts");
  assert.match(route, /isNewSeoTaxonomyType/);
  assert.match(route, /loadLocalizedSeoTaxonomyPage/);
  assert.match(route, /"noindex, follow"/);
  assert.match(component, /BreadcrumbList/);
  assert.match(component, /taxonomy-pagination/);
  assert.match(component, /SeoTaxonomyLinks/);
  assert.match(detail, /buildListingSeoTaxonomyLinks/);
  assert.match(sitemap, /getIndexableSeoTaxonomyFacets/);
  assert.match(sitemap, /loadLocalizedSeoTaxonomySitemapFacets/);
  assert.doesNotMatch(sitemap, /searchParams|price_max|transmission/);
});
