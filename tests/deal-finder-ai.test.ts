import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderDealFinderAnalysis } from "../src/lib/deal-finder/analysis-view.ts";
import type { DealFinderAnalysis } from "../src/lib/deal-finder/types.ts";
import {
  DEAL_FINDER_CONFIDENCE_CAP_WITHOUT_COMPARABLES,
  buildOpenAiRequest,
  enforceNoComparablesPolicy,
  extractResponseOutputText,
  sanitizeAnalysisSnapshot,
  validateStructuredAnalysis,
  type StructuredAnalysis,
} from "../workers/deal-finder-sync/src/analysis.ts";
import { handleRequest } from "../workers/deal-finder-sync/src/index.ts";
import { analyzeDealFinderSnapshot, OpenAiAnalysisError } from "../workers/deal-finder-sync/src/openai-client.ts";
import { getDealFinderAiConfig } from "../workers/deal-finder-sync/src/env.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");
const snapshot = {
  id: 55, content_hash: "hash-55", title: "Volkswagen Golf 1.6 TDI", description: "Сохранённые данные.",
  price: 2900, currency: "EUR", brand: "Volkswagen", model: "Golf", variant: "1.6 TDI", year: 2011,
  mileage: 186000, fuel_type: "Diesel", transmission: "Schaltgetriebe", power_kw: 77, power_hp: 105,
  engine_volume: 1.6, body_type: "Kombi", city: "Braunschweig", postal_code: "38100",
  published_at: "2026-07-16T08:00:00Z", first_seen_at: "2026-07-16T09:00:00Z",
};
const structured: StructuredAnalysis = {
  deal_score: 74, risk_score: 31, liquidity_score: 68, data_quality_score: 82, confidence_score: 0.85,
  positive_signals: ["Основные поля заполнены"], negative_signals: ["Нет сравнительных объявлений"],
  missing_information: ["История обслуживания"], known_defects: [], recommended_questions: ["Есть ли сервисная книжка?"],
  recommendation: "REVIEW", ai_summary: "Нужна ручная проверка источника.",
};
const completedAnalysis = (overrides: Partial<DealFinderAnalysis> = {}): DealFinderAnalysis => ({
  id: 1, listing_id: 55, status: "completed", positive_signals: [], negative_signals: [], missing_information: [],
  known_defects: [], recommended_questions: [], deal_score: 74, risk_score: 31, liquidity_score: 68,
  data_quality_score: 82, confidence_score: 0.7, recommendation: "REVIEW", ai_summary: "Безопасное резюме.",
  model: "gpt-5.6-luna", completed_at: "2026-07-17T12:00:00Z", ...overrides,
});

test("analysis snapshot allows only the documented fields", () => {
  const safe = sanitizeAnalysisSnapshot({ ...snapshot, seller_phone: "secret", raw_data: { token: "secret" } });
  assert.ok(safe);
  assert.equal(Object.hasOwn(safe, "seller_phone"), false);
  assert.equal(Object.hasOwn(safe, "raw_data"), false);
  assert.equal(Object.keys(safe).length, 21);
});

test("analysis snapshot preserves valid ISO timestamps", () => {
  const safe = sanitizeAnalysisSnapshot(snapshot);
  assert.ok(safe);
  assert.equal(safe.published_at, snapshot.published_at);
  assert.equal(safe.first_seen_at, snapshot.first_seen_at);
});

test("analysis snapshot normalizes Unix timestamps in seconds", () => {
  const publishedAt = 1784192400;
  const firstSeenAt = 1784196000;
  const safe = sanitizeAnalysisSnapshot({ ...snapshot, published_at: publishedAt, first_seen_at: firstSeenAt });
  assert.ok(safe);
  assert.equal(safe.published_at, "2026-07-16T09:00:00.000Z");
  assert.equal(safe.first_seen_at, "2026-07-16T10:00:00.000Z");
  assert.notEqual(safe.published_at, publishedAt);
  assert.notEqual(safe.first_seen_at, firstSeenAt);
});

test("analysis snapshot normalizes Unix timestamps in milliseconds", () => {
  const publishedAt = 1784192400000;
  const firstSeenAt = 1784196000000;
  const safe = sanitizeAnalysisSnapshot({ ...snapshot, published_at: publishedAt, first_seen_at: firstSeenAt });
  assert.ok(safe);
  assert.equal(safe.published_at, "2026-07-16T09:00:00.000Z");
  assert.equal(safe.first_seen_at, "2026-07-16T10:00:00.000Z");
  assert.equal(typeof safe.published_at, "string");
  assert.equal(typeof safe.first_seen_at, "string");
});

test("analysis snapshot rejects invalid timestamps", () => {
  assert.equal(sanitizeAnalysisSnapshot({ ...snapshot, first_seen_at: Number.NaN }), null);
  assert.equal(sanitizeAnalysisSnapshot({ ...snapshot, first_seen_at: Number.POSITIVE_INFINITY }), null);
  assert.equal(sanitizeAnalysisSnapshot({ ...snapshot, first_seen_at: 1e20 }), null);
  assert.equal(sanitizeAnalysisSnapshot({ ...snapshot, first_seen_at: "not-a-date" }), null);
});

test("analysis snapshot allows null published_at and requires first_seen_at", () => {
  const safe = sanitizeAnalysisSnapshot({ ...snapshot, published_at: null });
  assert.ok(safe);
  assert.equal(safe.published_at, null);
  const { first_seen_at: _removed, ...withoutFirstSeen } = snapshot;
  assert.equal(sanitizeAnalysisSnapshot(withoutFirstSeen), null);
});

test("Deal Finder AI defaults to gpt-5.6-luna with one disabled dry-run job", () => {
  const config = getDealFinderAiConfig({});
  assert.equal(config.model, "gpt-5.6-luna");
  assert.equal(config.maxAnalysesPerRun, 1);
  assert.equal(config.enabled, false);
  assert.equal(config.dryRun, true);
});

test("strict schema accepts the exact structured output", () => assert.equal(validateStructuredAnalysis(structured), true));
test("strict schema rejects a missing required property", () => {
  const { known_defects: _removed, ...invalid } = structured;
  assert.equal(validateStructuredAnalysis(invalid), false);
});
test("strict schema rejects an extra property", () => assert.equal(validateStructuredAnalysis({ ...structured, profit: 1000 }), false));
test("strict schema rejects an invalid recommendation", () => assert.equal(validateStructuredAnalysis({ ...structured, recommendation: "BUY_NOW" }), false));
test("strict schema rejects scores outside 0-100", () => assert.equal(validateStructuredAnalysis({ ...structured, deal_score: 101 }), false));
test("strict schema rejects confidence outside 0-1", () => assert.equal(validateStructuredAnalysis({ ...structured, confidence_score: 1.1 }), false));
test("strict schema rejects HTML and oversized arrays", () => {
  assert.equal(validateStructuredAnalysis({ ...structured, ai_summary: "<b>unsafe</b>" }), false);
  assert.equal(validateStructuredAnalysis({ ...structured, positive_signals: Array.from({ length: 21 }, () => "x") }), false);
});
test("no-comparables policy caps confidence in application code", () => {
  assert.equal(enforceNoComparablesPolicy(structured).confidence_score, DEAL_FINDER_CONFIDENCE_CAP_WITHOUT_COMPARABLES);
});
test("Responses request uses the approved model, privacy controls and strict schema", () => {
  const request = buildOpenAiRequest("gpt-5.6-luna", snapshot);
  assert.equal(request.model, "gpt-5.6-luna");
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 1500);
  assert.equal(request.reasoning.effort, "low");
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.additionalProperties, false);
  assert.equal(Object.hasOwn(request, "tools"), false);
  const serialized = JSON.stringify(request);
  for (const forbidden of ["source_url", "seller_phone", "seller_email", "raw_data", "OPENAI_API_KEY", "XANO_DEAL_FINDER_INGEST_SECRET", "image_url"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not be sent to OpenAI`);
  }
});
test("Responses REST output text is extracted from output content", () => {
  assert.equal(extractResponseOutputText({ output: [{ content: [{ type: "output_text", text: "{}" }] }] }), "{}");
  assert.equal(extractResponseOutputText({ output_text: "unsupported shortcut" }), null);
});

test("frontend renders all queue states without fake scores", () => {
  assert.match(renderDealFinderAnalysis(null), /в течение двух минут/);
  assert.match(renderDealFinderAnalysis({ ...completedAnalysis(), status: "pending" }), /автоматически/);
  assert.match(renderDealFinderAnalysis({ ...completedAnalysis(), status: "processing" }), /Анализируется/);
  assert.match(renderDealFinderAnalysis({ ...completedAnalysis(), status: "failed", error_code: "OPENAI_TIMEOUT" }), /Ошибка анализа/);
  assert.match(renderDealFinderAnalysis(completedAnalysis()), /Анализ завершён/);
  assert.match(renderDealFinderAnalysis(completedAnalysis()), /Проверить актуальность/);
  assert.doesNotMatch(renderDealFinderAnalysis(completedAnalysis()), /data-deal-force="true"/);
});
test("production Worker schedules bounded analysis and source sync independently", () => {
  const config = readProjectFile("workers/deal-finder-sync/wrangler.toml");
  const worker = readProjectFile("workers/deal-finder-sync/src/index.ts");
  assert.match(config, /crons = \["\*\/2 \* \* \* \*", "15 6 \* \* \*"\]/);
  assert.match(config, /DEAL_FINDER_MAX_AI_ANALYSES_PER_RUN = "1"/);
  assert.match(config, /DEAL_FINDER_MAX_SEARCHES_PER_RUN = "1"/);
  assert.match(config, /DEAL_FINDER_MAX_SEARCH_RESULTS_PER_RUN = "100"/);
  assert.match(config, /DEAL_FINDER_MAX_DETAILS_PER_RUN = "4"/);
  assert.match(worker, /controller\.cron === "\*\/2 \* \* \* \*"/);
  assert.match(worker, /runDealFinderSync\(env, false, true\)/);
});
test("frontend escapes every AI-provided string", () => {
  const html = renderDealFinderAnalysis(completedAnalysis({ ai_summary: '<img src=x onerror="alert(1)">', positive_signals: ["<script>bad()</script>"] }));
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;|&lt;img/);
});
test("mock pipeline transitions pending to claim, validation, complete and render", () => {
  const job: DealFinderAnalysis = { ...completedAnalysis(), status: "pending", deal_score: null, ai_summary: null };
  job.status = "processing";
  assert.equal(validateStructuredAnalysis(structured), true);
  Object.assign(job, enforceNoComparablesPolicy(structured), { status: "completed", completed_at: "2026-07-17T12:00:00Z" });
  assert.match(renderDealFinderAnalysis(job), /74\/100/);
  assert.match(renderDealFinderAnalysis(job), /70%/);
});

test("Xano queue endpoint is auth, role and owner scoped", () => {
  const script = readProjectFile("docs/xano/deal-finder-frontend-analyze.xs");
  assert.match(script, /auth = "automarket_users"/);
  assert.match(script, /role == "admin"/);
  assert.match(script, /role == "deal_finder_admin"/);
  assert.match(script, /deal_finder_listings\.user_id == \$current_user\.id/);
  assert.doesNotMatch(script, /\$input\.(?:user_id|role|model|deal_score)/);
});
test("Xano queue reuses active work and only repeats completed work explicitly", () => {
  const script = readProjectFile("docs/xano/deal-finder-frontend-analyze.xs");
  const api = readProjectFile("src/lib/deal-finder/api.ts");
  assert.match(script, /status == "pending"/);
  assert.match(script, /status == "processing"/);
  assert.match(script, /status == "completed"/);
  assert.match(script, /input_hash == \$input_hash/);
  assert.match(script, /bool force\?/);
  assert.match(script, /\$completed_analysis != null\) && \(\$input\.force != true\)/);
  assert.match(script, /reused: \$reused/);
  assert.match(api, /body: JSON\.stringify\(\{ force: options\.force === true \}\)/);
});
test("Xano claim uses a transaction and row lock", () => {
  const script = readProjectFile("docs/xano/deal-finder-internal-analysis-claim.xs");
  assert.match(script, /db\.transaction/);
  assert.match(script, /lock = true/);
  assert.match(script, /status == "pending"/);
});
test("Xano claim transitions only pending analyses to processing", () => {
  const script = readProjectFile("docs/xano/deal-finder-internal-analysis-claim.xs");
  assert.match(script, /status == "pending"/);
  assert.match(script, /status: "processing"/);
  assert.match(script, /analysis_status: "processing"/);
  assert.ok(script.indexOf(/status == "pending"/.source) === -1 || script.indexOf('status == "pending"') < script.indexOf('status: "processing"'));
});
test("second, completed and failed claims are rejected by the pending precondition", () => {
  const script = readProjectFile("docs/xano/deal-finder-internal-analysis-claim.xs");
  assert.match(script, /Analysis is not pending/);
  for (const status of ["processing", "completed", "failed"]) assert.notEqual(status, "pending");
});
test("Xano claim cannot mutate listings or user flags", () => {
  const script = readProjectFile("docs/xano/deal-finder-internal-analysis-claim.xs");
  assert.doesNotMatch(script, /db\.(?:edit|patch) deal_finder_listings/);
  assert.doesNotMatch(script, /is_saved|is_hidden|is_viewed|is_new|user_status/);
});
test("Xano claim guard and edit remain inside one rollback-safe transaction", () => {
  const script = readProjectFile("docs/xano/deal-finder-internal-analysis-claim.xs");
  const transactionStart = script.indexOf("db.transaction");
  const guard = script.indexOf('status == "pending"');
  const edit = script.indexOf("db.edit deal_finder_analyses");
  const transactionEnd = script.indexOf("\n    }\n  }", transactionStart);
  assert.ok(transactionStart >= 0 && guard > transactionStart && edit > guard && transactionEnd > edit);
});
test("complete endpoint validates ranges and never edits listing fields or user flags", () => {
  const script = readProjectFile("docs/xano/deal-finder-internal-analysis-complete.xs");
  assert.match(script, /deal_score filters=min:0\|max:100/);
  assert.match(script, /confidence_score filters=min:0\|max:1/);
  assert.match(script, /confidence_score: \(\$input\.confidence_score\|min:0\.7\)/);
  assert.doesNotMatch(script, /db\.edit deal_finder_listings|is_saved|is_hidden|is_viewed/);
});
test("frontend feed selects only the latest completed analysis", () => {
  const script = readProjectFile("docs/xano/deal-finder-frontend-listings.xs");
  assert.match(script, /status == "completed"/);
  assert.match(script, /completed_at: "desc"/);
  assert.doesNotMatch(script, /input_snapshot|provider_response_id|input_tokens|output_tokens/);
});
test("safe Xano frontend contracts never expose the raw analysis input", () => {
  const detail = readProjectFile("docs/xano/deal-finder-frontend-detail.xs");
  assert.doesNotMatch(detail, /input_snapshot|provider_response_id|error_message|raw_data/);
  assert.match(detail, /error_code/);
});

test("Worker dry-run never calls OpenAI or changes state", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; throw new Error("unexpected fetch"); }) as typeof fetch;
  try {
    const response = await handleRequest(new Request("https://worker.example/analyze/dry-run", { method: "POST", headers: { "X-Deal-Finder-Secret": "test-trigger" } }), { DEAL_FINDER_WORKER_TRIGGER_SECRET: "test-trigger", DEAL_FINDER_MANUAL_AI_ENABLED: "true" });
    const payload = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(payload.openai_called, false);
    assert.equal(payload.state_changed, false);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
test("Worker rejects missing trigger secret and disabled live AI before network access", async () => {
  const unauthorized = await handleRequest(new Request("https://worker.example/analyze", { method: "POST" }), { DEAL_FINDER_WORKER_TRIGGER_SECRET: "test-trigger" });
  assert.equal(unauthorized.status, 401);
  const disabled = await handleRequest(new Request("https://worker.example/analyze", { method: "POST", headers: { "X-Deal-Finder-Secret": "test-trigger" } }), { DEAL_FINDER_WORKER_TRIGGER_SECRET: "test-trigger", DEAL_FINDER_MANUAL_AI_ENABLED: "true", DEAL_FINDER_AI_ENABLED: "false" });
  assert.equal(disabled.status, 503);
});

test("v1 frontend relabels known defects without merging analysis arrays", () => {
  const html = renderDealFinderAnalysis({
    ...structured,
    id: 1,
    listing_id: 1,
    status: "completed",
    analysis_version: "deal-finder-v1",
    model: "gpt-5.6-luna",
    known_defects: ["Пробег 228 000 км"],
    completed_at: "2026-07-18T00:00:00.000Z",
  });
  assert.match(html, /AI v1 · Beta/);
  assert.match(html, /Возможные замечания из текста объявления/);
  assert.match(html, /могут включать нейтральные факты/);
  assert.doesNotMatch(html, />Известные дефекты</);
  assert.match(html, />Риски</);
  assert.match(html, />Недостающие данные</);
});

test("analysis disclaimer is complete for every version", () => {
  const html = renderDealFinderAnalysis({ ...structured, id: 1, listing_id: 1, status: "completed", known_defects: ["Подтверждённый дефект"] });
  assert.match(html, /не является технической диагностикой, подтверждённой рыночной оценкой или гарантией выгоды/);
  assert.match(html, />Известные дефекты</);
  assert.doesNotMatch(html, /AI v1 · Beta/);
});

test("OpenAI timeout maps to a safe code", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new DOMException("aborted", "AbortError"); }) as typeof fetch;
  try {
    await assert.rejects(analyzeDealFinderSnapshot({ OPENAI_API_KEY: "test-only" }, snapshot, "gpt-5.6-luna", 10), (error: unknown) => error instanceof OpenAiAnalysisError && error.code === "OPENAI_TIMEOUT");
  } finally { globalThis.fetch = originalFetch; }
});
test("OpenAI rate limit maps to a safe code", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
  try {
    await assert.rejects(analyzeDealFinderSnapshot({ OPENAI_API_KEY: "test-only" }, snapshot, "gpt-5.6-luna", 10), (error: unknown) => error instanceof OpenAiAnalysisError && error.code === "OPENAI_RATE_LIMIT");
  } finally { globalThis.fetch = originalFetch; }
});
test("malformed OpenAI output maps to a safe code", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ id: "resp_test", output: [{ content: [{ type: "output_text", text: "{bad-json" }] }] })) as typeof fetch;
  try {
    await assert.rejects(analyzeDealFinderSnapshot({ OPENAI_API_KEY: "test-only" }, snapshot, "gpt-5.6-luna", 10), (error: unknown) => error instanceof OpenAiAnalysisError && error.code === "OPENAI_INVALID_OUTPUT");
  } finally { globalThis.fetch = originalFetch; }
});

test("browser code contains no Worker secret or OpenAI key", () => {
  const api = readProjectFile("src/lib/deal-finder/api.ts");
  const client = readProjectFile("src/lib/deal-finder/client.ts");
  assert.doesNotMatch(api + client, /OPENAI_API_KEY|XANO_DEAL_FINDER_INGEST_SECRET|X-Deal-Finder-Secret/);
});
