import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBackfillPlan,
  detectListingSourceLocale,
  normalizeListingTaxonomy,
  parseBackfillArgs,
} from "../scripts/i18n-backfill.mjs";

const listing = {
  id: 123,
  title: "Audi A3 zu verkaufen",
  description: "Das Fahrzeug ist gepflegt und der TÜV ist gültig.",
  source_locale: "de",
  translation_version: 0,
  translation_source_hash: "",
  fuel_type: "Diesel",
  transmission: "Automatik",
  body_type: "Limousine",
  seller_type: "Privat",
};

test("backfill CLI defaults to dry-run and validates bounded controls", () => {
  assert.deepEqual(parseBackfillArgs(["--dry-run", "--limit=8", "--batch-size=5", "--resume-cursor=100", "--listing-ids=101,102"]), {
    apply: false,
    dryRun: true,
    limit: 8,
    batchSize: 5,
    resumeCursor: 100,
    listingIds: [101, 102],
  });
  assert.equal(parseBackfillArgs(["--apply"]).apply, true);
  assert.throws(() => parseBackfillArgs(["--limit=101"]));
});

test("source detection trusts stored locale and refuses ambiguous Cyrillic", () => {
  assert.deepEqual(detectListingSourceLocale(listing), {
    locale: "de",
    score: 1,
    method: "stored_source_locale",
    needsReview: false,
  });
  const ambiguous = detectListingSourceLocale({ title: "Автомобиль", description: "Хорошее состояние" });
  assert.equal(ambiguous.locale, null);
  assert.equal(ambiguous.needsReview, true);
});

test("legacy enums are normalized without guessing unknown values", () => {
  const result = normalizeListingTaxonomy({ ...listing, color: "Ультрамарин металлик" });
  const normalizedValues = result.normalizedValues as Record<string, string>;
  assert.equal(normalizedValues.fuel_type, "diesel");
  assert.equal(normalizedValues.transmission, "automatic");
  assert.equal(normalizedValues.body_type, "sedan");
  assert.equal(normalizedValues.seller_type, "private");
  assert.equal(normalizedValues.color, undefined);
  assert.deepEqual(result.warnings[0], {
    field: "color",
    legacy_value: "Ультрамарин металлик",
    code: "unknown_legacy_enum",
  });
});

test("backfill plan is idempotent for original translation and jobs", async () => {
  const initial = await buildBackfillPlan(listing, ["de", "en", "ru"]);
  const initialJobs = initial.jobActions as Array<{ action: string; idempotencyKey: string }>;
  assert.equal(initial.translationVersion, 1);
  assert.equal(initial.originalAction, "create");
  assert.deepEqual(initialJobs.map((job) => job.action), ["create", "create"]);

  const repeatListing = {
    ...listing,
    ...initial.normalizedValues,
    translation_source_hash: initial.sourceHash,
    translation_version: 1,
  };
  const repeat = await buildBackfillPlan(repeatListing, ["de", "en", "ru"], {
    translations: [{ car_listing_id: 123, locale_code: "de", source_hash: initial.sourceHash }],
    jobs: initialJobs.map((job, index) => ({ id: index + 1, idempotency_key: job.idempotencyKey })),
    log: { id: 1 },
  });
  assert.equal(repeat.translationVersion, 1);
  assert.equal(repeat.originalAction, "no_changes");
  assert.deepEqual((repeat.jobActions as Array<{ action: string }>).map((job) => job.action), ["no_changes", "no_changes"]);
  assert.equal(repeat.migrationStatus, "already_migrated");
});

test("operational changes preserve hash while description changes create a new version", async () => {
  const baseline = await buildBackfillPlan(listing, ["de", "en"]);
  const priceChange = await buildBackfillPlan({
    ...listing,
    price: 9999,
    mileage: 123456,
    translation_source_hash: baseline.sourceHash,
    translation_version: 1,
  }, ["de", "en"]);
  assert.equal(priceChange.sourceHash, baseline.sourceHash);
  assert.equal(priceChange.translationVersion, 1);

  const textChange = await buildBackfillPlan({
    ...listing,
    description: `${listing.description} Neu beschrieben.`,
    translation_source_hash: baseline.sourceHash,
    translation_version: 1,
  }, ["de", "en"]);
  assert.notEqual(textChange.sourceHash, baseline.sourceHash);
  assert.equal(textChange.translationVersion, 2);
});

test("taxonomy-only changes are applied and stale translations and jobs are retired", async () => {
  const baseline = await buildBackfillPlan(listing, ["de", "en"]);
  const plan = await buildBackfillPlan({
    ...listing,
    translation_source_hash: baseline.sourceHash,
    translation_version: 1,
  }, ["de", "en"], {
    translations: [
      { id: 1, car_listing_id: 123, locale_code: "de", source_hash: baseline.sourceHash },
      { id: 2, car_listing_id: 123, locale_code: "en", source_hash: "old-source" },
    ],
    jobs: [
      { id: 3, idempotency_key: "old-job", source_hash: "old-source", status: "pending" },
    ],
  });

  assert.equal(plan.hashChanged, false);
  assert.equal(plan.taxonomyChanged, true);
  assert.deepEqual(plan.staleTranslationIds, [2]);
  assert.deepEqual(plan.staleJobIds, [3]);
  assert.equal(plan.migrationStatus, "updated");
});
