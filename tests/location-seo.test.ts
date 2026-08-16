import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalSeoCity } from "../src/lib/seo/locationSeo.ts";

test("SEO city normalization collapses case and known localized duplicates", () => {
  assert.equal(getCanonicalSeoCity("ilsede"), "Ilsede");
  assert.equal(getCanonicalSeoCity("ILSEDE"), "Ilsede");
  assert.equal(getCanonicalSeoCity("Ильзеде"), "Ilsede");
  assert.equal(getCanonicalSeoCity("Braunschweig"), "Braunschweig");
});
