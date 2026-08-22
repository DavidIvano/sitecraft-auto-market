import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildMaterializerGeneration,
  evaluateMaterializerParity,
  handleRequest,
  resolveMaterializerCursor,
} from "../workers/seo-materializer/src/index.ts";
import { buildMaterializedRows, resolveLocalizedListings } from "../workers/seo-materializer/src/materialize.ts";
import type { MaterializerListing, SnapshotTranslation } from "../workers/seo-materializer/src/types.ts";

const source: MaterializerListing = {
  id: 91,
  slug: "audi-a4-2020-91",
  title: "Audi A4 2020",
  description: "Gepflegter Audi A4 mit nachvollziehbarer Wartung, sauberem Innenraum und vollständiger Ausstattung für den Alltag.",
  brand: "Audi",
  model: "A4",
  year: 2020,
  mileage: 72_000,
  fuel_type: "diesel",
  transmission: "automatic",
  body_type: "sedan",
  price: 22_000,
  currency: "EUR",
  city: "Berlin",
  country: "DE",
  status: "approved",
  moderation_status: "approved",
  main_image_url: "https://images.example.com/audi.webp",
  source_locale: "de",
  translation_source_hash: "hash-91",
  translation_version: 2,
  created_at: "2026-08-20T10:00:00Z",
  updated_at: "2026-08-21T10:00:00Z",
};
const translations: SnapshotTranslation[] = [{
  car_listing_id: 91,
  locale_code: "en",
  title: "Audi A4 2020",
  description: "Well maintained Audi A4 with documented service history, a clean interior and complete everyday equipment.",
  translation_status: "completed",
  source_locale: "de",
  source_hash: "hash-91",
  updated_at: "2026-08-21T11:00:00Z",
}];

test("materializer resolves strict source-hash translations and builds one immutable generation", () => {
  const localized = resolveLocalizedListings([source], translations, ["de", "en"]);
  const rows = buildMaterializedRows({ generation: "seo-test-generation", localized, now: Date.parse("2026-08-22T00:00:00Z") });
  assert.equal(rows.listing_index.length, 2);
  assert.equal(rows.manifests.length, 2);
  assert.equal(rows.quality.rejected, 0);
  assert.ok(rows.facets.some((facet) => facet.taxonomy_type === "brand" && facet.slug === "audi"));
  assert.ok(rows.edges.every((edge) => edge.generation === "seo-test-generation"));
  assert.ok(rows.stats.every((stat) => stat.generation === "seo-test-generation"));
  const relatedPerSource = new Map<string, number>();
  for (const row of rows.related) {
    const key = `${row.locale_code}:${row.source_facet_key}`;
    relatedPerSource.set(key, (relatedPerSource.get(key) || 0) + 1);
  }
  assert.ok([...relatedPerSource.values()].every((count) => count <= 3));
});

test("materializer omits stale translations instead of falling back", () => {
  const localized = resolveLocalizedListings([source], [{ ...translations[0]!, source_hash: "stale" }], ["de", "en"]);
  assert.equal(localized.get("de")?.length, 1);
  assert.equal(localized.get("en")?.length, 0);
});

test("materializer generation is deterministic for resumable staging", async () => {
  const snapshot = { listings: [source], translations, locales: ["de", "en"] };
  const first = await buildMaterializerGeneration(snapshot);
  const reordered = await buildMaterializerGeneration({ ...snapshot, locales: ["en", "de"] });
  assert.equal(first, reordered);
  assert.match(first, /^seo-[a-f0-9]{32}$/);
  assert.notEqual(first, await buildMaterializerGeneration({ ...snapshot, translations: [{ ...translations[0]!, description: `${translations[0]!.description} Updated.` }] }));
});

test("materializer release gate requires identical inventory in all 28 locales", () => {
  const locales = Array.from({ length: 28 }, (_, index) => `l${index}`);
  const complete = locales.map((locale_code) => ({ locale_code, car_listing_id: 91 }));
  assert.equal(evaluateMaterializerParity(locales, 1, complete).release_ready, true);
  assert.equal(evaluateMaterializerParity(locales, 1, complete.slice(1)).release_ready, false);
  assert.equal(evaluateMaterializerParity(locales.slice(1), 1, complete.slice(1)).release_ready, false);
});

test("materializer resumes only the same deterministic generation at the earliest shared checkpoint", () => {
  assert.equal(resolveMaterializerCursor([
    { materialization_generation: "seo-current", materialization_cursor: 36 },
    { materialization_generation: "seo-current", materialization_cursor: 67 },
  ], "seo-current"), 36);
  assert.equal(resolveMaterializerCursor([
    { materialization_generation: "seo-old", materialization_cursor: 36 },
  ], "seo-current"), 0);
  assert.equal(resolveMaterializerCursor([], "seo-current"), 0);
});

test("manual materializer endpoint uses constant-time protected trigger secret", async () => {
  const response = await handleRequest(new Request("https://worker.test/run", { method: "POST" }), {
    SEO_MATERIALIZER_TRIGGER_SECRET: "expected-secret",
  });
  assert.equal(response.status, 401);
});

test("queue lifecycle mutates only jobs claimed by the current worker", () => {
  const root = new URL("..", import.meta.url);
  for (const file of [
    "docs/xano/seo-materializer/14_POST_generation_activate.xs",
    "docs/xano/seo-materializer/15_POST_queue_fail.xs",
    "docs/xano/seo-materializer/17_POST_queue_checkpoint.xs",
  ]) {
    const source = readFileSync(new URL(file, root), "utf8");
    assert.match(source, /text worker_id/u);
    assert.match(source, /locked_by == \$input\.worker_id/u);
    assert.doesNotMatch(source, /foreach \(\$input\.job_ids\)/u);
  }
  const worker = readFileSync(new URL("workers/seo-materializer/src/index.ts", root), "utf8");
  assert.match(worker, /failJobs\(env, workerId,/u);
  assert.match(worker, /checkpointJobs\(env, workerId,/u);
  assert.match(worker, /worker_id: workerId/u);
});
