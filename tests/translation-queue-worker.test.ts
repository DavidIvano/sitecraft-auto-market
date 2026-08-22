import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { handleRequest, runTranslationBatch } from "../workers/translation-queue/src/index.ts";
import { normalizeTargetLocale, scheduledLocales } from "../workers/translation-queue/src/env.ts";
import type { TranslationWorkerEnv } from "../workers/translation-queue/src/types.ts";

const baseEnv = (overrides: Partial<TranslationWorkerEnv> = {}): TranslationWorkerEnv => ({
  XANO_API_BASE_URL: "https://xano.example/api:translation",
  XANO_TRANSLATION_WORKER_SECRET: "xano-secret",
  TRANSLATION_WORKER_TRIGGER_SECRET: "trigger-secret",
  TRANSLATION_QUEUE_ENABLED: "false",
  TRANSLATION_QUEUE_DRY_RUN: "true",
  TRANSLATION_QUEUE_SCHEDULED_ENABLED: "false",
  TRANSLATION_TARGET_LOCALE: "en",
  TRANSLATION_ALLOWED_LOCALES: "de,en,fr,tr,ar,uk,nl,da,sv,fi,es,pt,it,pl,cs,sk,sl,bg,hr,ro,hu,el,et,lv,lt,mt,ga",
  TRANSLATION_MAX_JOBS_PER_RUN: "2",
  TRANSLATION_SCHEDULED_LOCALES_PER_RUN: "3",
  TRANSLATION_HTTP_TIMEOUT_MS: "1000",
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const xanoWorkerDirectory = new URL("../docs/xano/multilingual/translation-worker/", import.meta.url);
const xanoWorkerSources = readdirSync(xanoWorkerDirectory)
  .filter((name) => name.endsWith(".xs"))
  .map((name) => readFileSync(new URL(name, xanoWorkerDirectory), "utf8"));

test("translation Xano endpoints are protected, bounded and use canonical source hashing", () => {
  assert.equal(xanoWorkerSources.length, 9);
  for (const source of xanoWorkerSources) {
    assert.match(source, /X-Translation-Worker-Secret/);
    assert.match(source, /__TRANSLATION_WORKER_SECRET_RAW__/);
    assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]+/);
  }
  const prepare = xanoWorkerSources.find((source) => source.includes('query "translations/internal/prepare"')) || "";
  const pending = xanoWorkerSources.find((source) => source.includes('query "translations/internal/jobs/pending"')) || "";
  assert.match(prepare, /status == "approved"/);
  assert.match(prepare, /json_encode\|sha256:false/);
  assert.match(prepare, /"\/\\\\r\\\\n\?\/"\|regex_replace:"\\n":\$car\.title/);
  assert.match(pending, /filters=min:1\|max:3/);
  assert.match(pending, /attempt_count < \$db\.translation_jobs\.max_attempts/);
  assert.match(prepare, /\$input\.target_locale == "de"/);
  assert.match(pending, /\$input\.target_locale == "de"/);
});

test("German is an explicit translation Worker target", () => {
  assert.equal(normalizeTargetLocale("de", baseEnv()), "de");
  assert.equal(normalizeTargetLocale("uk", baseEnv()), "uk");
  for (const locale of [
    "nl", "da", "sv", "fi", "es", "pt", "it",
    "pl", "cs", "sk", "sl", "bg", "hr", "ro", "hu", "el",
    "et", "lv", "lt", "mt", "ga",
  ] as const) {
    assert.equal(normalizeTargetLocale(locale, baseEnv()), locale);
  }
});

test("scheduled translation rotation is deterministic and bounded to three locales", () => {
  const first = scheduledLocales(baseEnv(), 0);
  const second = scheduledLocales(baseEnv(), 15 * 60 * 1_000);
  assert.deepEqual(first, ["de", "en", "fr"]);
  assert.deepEqual(second, ["tr", "ar", "uk"]);
  assert.equal(new Set([...first, ...second]).size, 6);
});

test("translation Worker health exposes flags but no secrets", async () => {
  const response = await handleRequest(new Request("https://worker.example/health"), baseEnv());
  const body = await response.json() as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.enabled, false);
  assert.equal(body.dry_run, true);
  assert.equal(body.scheduled_enabled, false);
  assert.doesNotMatch(JSON.stringify(body), /xano-secret|trigger-secret/);
});

test("translation Worker rejects an unauthorized run before network access", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({});
  };
  try {
    const response = await handleRequest(new Request("https://worker.example/run", { method: "POST" }), baseEnv());
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("dry-run prepares safely and previews a bounded batch without claiming", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    const body = JSON.parse(String(init?.body || "{}"));
    if (url.pathname.endsWith("/prepare")) {
      assert.equal(body.dry_run, true);
      return jsonResponse({ candidates: 10, created: 0 });
    }
    return jsonResponse({ jobs: [
      { id: 5, entity_id: 95, target_locale: "en" },
      { id: 8, entity_id: 94, target_locale: "en" },
      { id: 22, entity_id: 21, target_locale: "en" },
    ] });
  };
  try {
    const result = await runTranslationBatch(baseEnv(), { targetLocale: "en", limit: 99, dryRun: true, source: "manual" });
    assert.deepEqual(result.candidate_job_ids, [5, 8]);
    assert.equal(result.processed, 0);
    assert.deepEqual(paths, [
      "/api:translation/translations/internal/prepare",
      "/api:translation/translations/internal/jobs/pending",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("idempotent queue control retries an explicit Xano rate limit", async () => {
  const originalFetch = globalThis.fetch;
  let prepareCalls = 0;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/prepare")) {
      prepareCalls += 1;
      if (prepareCalls === 1) return jsonResponse({ code: "ERROR_CODE_TOO_MANY_REQUESTS" }, 429);
      return jsonResponse({ created: 0 });
    }
    return jsonResponse({ jobs: [] });
  };
  try {
    const result = await runTranslationBatch(baseEnv(), { targetLocale: "de", limit: 1, dryRun: true, source: "manual" });
    assert.equal(result.ok, true);
    assert.equal(prepareCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live batch processes jobs sequentially through claim, provider and complete", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path.endsWith("/prepare")) return jsonResponse({ created: 0 });
    if (path.endsWith("/pending")) return jsonResponse({ jobs: [
      { id: 5, entity_id: 95, target_locale: "en" },
      { id: 8, entity_id: 94, target_locale: "en" },
    ] });
    if (path.endsWith("/claim")) return jsonResponse({ should_translate: true, outcome: "claimed" });
    if (path.endsWith("/translate")) return jsonResponse({
      translation: { title: "English title", description: "English description" },
      model: "gpt-5.6-luna",
    });
    if (path.endsWith("/complete")) return jsonResponse({ outcome: "completed" });
    return jsonResponse({ code: "UNEXPECTED" }, 500);
  };
  try {
    const result = await runTranslationBatch(baseEnv({
      TRANSLATION_QUEUE_ENABLED: "true",
      TRANSLATION_QUEUE_DRY_RUN: "false",
    }), { targetLocale: "en", limit: 2, dryRun: false, source: "manual" });

    assert.equal(result.ok, true);
    assert.equal(result.processed, 2);
    assert.deepEqual(paths, [
      "/api:translation/translations/internal/prepare",
      "/api:translation/translations/internal/jobs/pending",
      "/api:translation/translations/internal/jobs/5/claim",
      "/api:translation/translations/internal/jobs/5/translate",
      "/api:translation/translations/internal/jobs/5/complete",
      "/api:translation/translations/internal/jobs/8/claim",
      "/api:translation/translations/internal/jobs/8/translate",
      "/api:translation/translations/internal/jobs/8/complete",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live processing exits before Xano when the kill switch is closed", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse({});
  };
  try {
    const result = await runTranslationBatch(baseEnv(), { targetLocale: "en", limit: 1, dryRun: false, source: "manual" });
    assert.equal(result.code, "LIVE_PROCESSING_DISABLED");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live batch stops after the first provider failure", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path.endsWith("/prepare")) return jsonResponse({ created: 0 });
    if (path.endsWith("/pending")) return jsonResponse({ jobs: [
      { id: 28, entity_id: 94, target_locale: "en" },
      { id: 29, entity_id: 95, target_locale: "en" },
    ] });
    if (path.endsWith("/claim")) return jsonResponse({ should_translate: true, outcome: "claimed" });
    if (path.endsWith("/translate")) return jsonResponse({ code: "ERROR_CODE_TOO_MANY_REQUESTS" }, 429);
    if (path.endsWith("/fail")) return jsonResponse({ status: "failed" });
    return jsonResponse({ code: "UNEXPECTED" }, 500);
  };
  try {
    const result = await runTranslationBatch(baseEnv({
      TRANSLATION_QUEUE_ENABLED: "true",
      TRANSLATION_QUEUE_DRY_RUN: "false",
    }), { targetLocale: "en", limit: 2, dryRun: false, source: "manual" });

    assert.equal(result.ok, false);
    assert.equal(result.processed, 1);
    assert.deepEqual(paths, [
      "/api:translation/translations/internal/prepare",
      "/api:translation/translations/internal/jobs/pending",
      "/api:translation/translations/internal/jobs/28/claim",
      "/api:translation/translations/internal/jobs/28/translate",
      "/api:translation/translations/internal/jobs/28/fail",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
