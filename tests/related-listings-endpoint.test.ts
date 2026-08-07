import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("related listings endpoint is public, bounded and privacy-minimized", () => {
  const endpoint = readProjectFile("docs/xano-endpoint-get-cars-slug-related.xs");
  const pagedQueries = endpoint.match(/return = \{type: "list", paging: \{page: 1, per_page: 6\}\}/g) || [];

  assert.match(endpoint, /query "cars\/\{slug\}\/related" verb=GET/);
  assert.doesNotMatch(endpoint, /auth =/);
  assert.equal(pagedQueries.length, 5);
  assert.match(endpoint, /\(\$related\|count\) < 6/);
  assert.match(endpoint, /\$db\.car_listings\.id != \$car\.id/);
  assert.match(endpoint, /\$db\.car_listings\.user_id != \$car\.user_id/);
  assert.match(endpoint, /\$car\.status == "sold"/);
  assert.match(endpoint, /\$db\.car_listings\.status != "sold"/);

  for (const privateField of ["seller_email", "seller_phone", "vin", "admin_notes", "moderator_notes"]) {
    assert.doesNotMatch(endpoint, new RegExp(privateField));
  }
});

test("vehicle detail fetches only the bounded related endpoint", () => {
  const routes = readProjectFile("src/lib/apiRoutes.ts");
  const xano = readProjectFile("src/lib/xano.ts");
  const detail = readProjectFile("src/pages/cars/[slug].astro");

  assert.match(routes, /carRelatedListings: \(slug: string\) => `\/cars\/\$\{encodeURIComponent\(slug\)\}\/related`/);
  assert.match(xano, /export const getRelatedListingsBySlug = getRelatedCarsBySlug/);
  assert.match(xano, /fetchPublicJson\(withLocale\(API_ROUTES\.carRelated\(slug\), locale\)\)/);
  assert.match(xano, /normalizePublicCarList\(publicPayload\), locale\)\.slice\(0, 6\)/);
  assert.match(detail, /getRelatedListingsBySlug\(slug, locale\)/);
  assert.match(detail, /Promise\.allSettled/);
  assert.doesNotMatch(detail, /getApprovedCars/);
});

test("related endpoint failure remains optional for the primary listing", () => {
  const detail = readProjectFile("src/pages/cars/[slug].astro");

  assert.match(detail, /relatedResult\.status === "fulfilled" \? relatedResult\.value : \[\]/);
  assert.match(detail, /const relatedCars =/);
  assert.match(detail, /relatedCars[\s\S]*slice\(0, 6\)/);
});
