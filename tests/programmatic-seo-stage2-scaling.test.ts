import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("stage 2 routes use one bounded taxonomy contract with explicit rollout flags", () => {
  const routes = read("src/lib/apiRoutes.ts");
  const config = read("src/lib/config.ts");
  const client = read("src/lib/xano.ts");
  const loader = read("src/lib/seo/taxonomyRoute.ts");
  assert.match(routes, /\/public\/locale\/taxonomy\/\$\{encodeURIComponent\(type\)\}/);
  assert.match(routes, /\/public\/locale\/taxonomies\/counts/);
  assert.match(config, /PUBLIC_SEO_TAXONOMY_API_ENABLED === "true"/);
  assert.match(config, /PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED === "true"/);
  assert.match(client, /Math\.min\(24/);
  assert.match(client, /Math\.min\(500/);
  assert.match(loader, /if \(!SEO_TAXONOMY_API_ENABLED\)/);
  assert.match(loader, /dataSource: "xano_bounded"|resolveBoundedSeoTaxonomyPage/);
  assert.match(loader, /loadCompatibilityTaxonomyPage/);
});

test("bounded response validation fails closed before canonical or indexability decisions", () => {
  const contract = read("src/lib/seo/taxonomyApi.ts");
  assert.match(contract, /SeoTaxonomyContractError/);
  assert.match(contract, /limit > TAXONOMY_PAGE_SIZE/);
  assert.match(contract, /items\.length !== expectedItems/);
  assert.match(contract, /facetTotal !== total/);
  assert.match(contract, /omitted the requested ready locale/);
  assert.match(contract, /isSeoTaxonomyFacetIndexable/);
  assert.match(contract, /hasSeoFilterQuery/);
});

test("additive Xano design materializes canonical facets, locale counts and related edges", () => {
  const schema = read("docs/xano/programmatic-seo-stage-2/01_additive_schema.xs");
  const page = read("docs/xano/programmatic-seo-stage-2/GET_public_locale_taxonomy_type_slug.draft.xs");
  const counts = read("docs/xano/programmatic-seo-stage-2/GET_public_locale_taxonomies_counts.draft.xs");
  const related = read("docs/xano/programmatic-seo-stage-2/GET_public_locale_taxonomy_type_slug_related.draft.xs");
  const materializer = read("docs/xano/programmatic-seo-stage-2/MATERIALIZER_CONTRACT.md");
  for (const table of ["seo_taxonomy_facets", "seo_taxonomy_listing_edges", "seo_taxonomy_locale_stats", "seo_taxonomy_related"]) {
    assert.match(schema, new RegExp(`table ${table}`));
  }
  assert.match(page, /int\? limit\?=24 filters=min:1\|max:24/);
  assert.match(page, /paging: \{page: \$input\.page, per_page: \$input\.limit, totals: true\}/);
  assert.match(counts, /int\? limit\?=500 filters=min:1\|max:500/);
  assert.match(related, /int\? limit_per_group\?=8 filters=min:1\|max:8/);
  assert.match(related, /function\.run "seo_taxonomy\/related_groups"/);
  assert.match(materializer, /dry_run=true/);
  assert.match(materializer, /generation/);
  assert.doesNotMatch(`${page}\n${counts}\n${related}`, /seller_phone|seller_email|OpenAI|provider key/i);
});

test("production manifest records released Xano contracts with authoritative bounded defaults", () => {
  const manifest = read("docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md");
  const env = read(".env.example");
  assert.match(manifest, /4020380[\s\S]*public\/locale\/taxonomies\/counts/);
  assert.match(manifest, /4020381[\s\S]*public\/locale\/taxonomy\/\{type\}\/\{slug\}\/related/);
  assert.match(manifest, /4020382[\s\S]*public\/locale\/taxonomy\/\{type\}\/\{slug\}/);
  assert.doesNotMatch(manifest, /Programmatic SEO Stage 2[^\n]*Xano ID ещё не назначены/);
  assert.match(env, /PUBLIC_SEO_TAXONOMY_API_ENABLED=true/);
  assert.match(env, /PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED=false/);
});
