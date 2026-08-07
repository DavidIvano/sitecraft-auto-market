import assert from "node:assert/strict";
import test from "node:test";

import {
  auditLegacyListingValues,
  buildTranslationJobs,
  createTranslationSourceHash,
} from "../scripts/i18n/translation-migration.ts";

test("legacy audit reports unknown placeholders without rejecting known Russian aliases", () => {
  const unknown = auditLegacyListingValues([
    { id: 1, fuel_type: "Бензин", transmission: "Автомат", country: "Германия", description: "Кузов: Седан\nЦвет: Чёрный" },
    { id: 2, fuel_type: "Не указано", transmission: "Не указано" },
  ]);

  assert.deepEqual(unknown, [
    { field: "fuel_type", value: "Не указано", listing_ids: [2], sources: ["column"] },
    { field: "transmission", value: "Не указано", listing_ids: [2], sources: ["column"] },
  ]);
});

test("translation source hash is deterministic and sensitive to source text", () => {
  const first = createTranslationSourceHash({ title: "Audi 80", description: "Строка 1\r\nСтрока 2" });
  const normalized = createTranslationSourceHash({ title: " Audi 80 ", description: "Строка 1\nСтрока 2" });
  const changed = createTranslationSourceHash({ title: "Audi 80", description: "Изменено" });
  assert.equal(first, normalized);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, changed);
});

test("first controlled batch is idempotent and skips completed translations", () => {
  const listings = [
    { id: 96, status: "approved", source_locale: "ru", translation_source_hash: "a".repeat(64) },
    { id: 95, status: "approved", source_locale: "ru", translation_source_hash: "b".repeat(64) },
    { id: 48, status: "deleted", source_locale: "ru", translation_source_hash: "c".repeat(64) },
  ];
  const translations = [{
    car_listing_id: 96,
    locale_code: "de",
    source_locale: "ru",
    source_hash: "a".repeat(64),
    translation_status: "completed",
  }];
  const jobs = buildTranslationJobs({ listings, translations });
  assert.equal(jobs.length, 9);
  assert.ok(jobs.some((job) => job.target_locale === "ar"));
  assert.ok(jobs.some((job) => job.target_locale === "tr"));
  assert.ok(jobs.every((job) => job.status === "queued" && job.model === "gpt-5.6-luna"));
  assert.equal(buildTranslationJobs({ listings, translations, existingJobs: jobs }).length, 0);
});
