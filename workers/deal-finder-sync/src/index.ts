import { DEAL_FINDER_STRUCTURED_OUTPUT_SCHEMA, sanitizeAnalysisSnapshot } from "./analysis.ts";
import {
  constantTimeSecretEqual,
  getDealFinderAiConfig,
  getDealFinderManualConfig,
  getDealFinderSyncConfig,
  hasWorkerAnalysisConfiguration,
  hasWorkerSyncConfiguration,
  type DealFinderSyncEnv,
} from "./env.ts";
import { logger } from "./logger.ts";
import { analyzeDealFinderSnapshot, OpenAiAnalysisError } from "./openai-client.ts";
import { runDealFinderSync } from "./sync.ts";
import { createXanoDealFinderClient } from "./xano-client.ts";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const asPending = <T>(value: { data?: T[] } | T[]) => Array.isArray(value) ? value : value.data || [];
const fixture = {
  id: 1,
  content_hash: "dry-run-fixture",
  title: "Dry-run fixture",
  description: "Безопасная локальная проверка структуры без вызова OpenAI.",
  price: 0,
  currency: "EUR",
  brand: null,
  model: null,
  variant: null,
  year: null,
  mileage: null,
  fuel_type: null,
  transmission: null,
  power_kw: null,
  power_hp: null,
  engine_volume: null,
  body_type: null,
  city: null,
  postal_code: null,
  published_at: null,
  first_seen_at: "2026-01-01T00:00:00.000Z",
};

async function handleAnalyzeDryRun(env: DealFinderSyncEnv) {
  const config = getDealFinderAiConfig(env);
  let pendingId: number | null = null;
  let snapshot: unknown = fixture;
  if (hasWorkerAnalysisConfiguration(env)) {
    try {
      const jobs = asPending(await createXanoDealFinderClient(env, config.timeoutMs).getPendingAnalyses(1));
      if (jobs[0]) { pendingId = jobs[0].id; snapshot = jobs[0].input_snapshot; }
    } catch {
      // A fixture still verifies local sanitization and schema without mutating Xano.
    }
  }
  const sanitized = sanitizeAnalysisSnapshot(snapshot);
  return json({
    ok: Boolean(sanitized),
    dry_run: true,
    openai_called: false,
    state_changed: false,
    pending_analysis_id: pendingId,
    source: pendingId ? "pending" : "fixture",
    model: config.model,
    max_per_run: config.maxAnalysesPerRun,
    input_fields: sanitized ? Object.keys(sanitized) : [],
    strict_schema: DEAL_FINDER_STRUCTURED_OUTPUT_SCHEMA.additionalProperties === false,
    schema_validation: sanitized ? "passed" : "failed",
  }, sanitized ? 200 : 422);
}

async function handleAnalyze(env: DealFinderSyncEnv) {
  const config = getDealFinderAiConfig(env);
  if (!config.enabled) return json({ ok: false, code: "AI_DISABLED" }, 503);
  if (config.dryRun) return json({ ok: false, code: "AI_DRY_RUN_ONLY" }, 503);
  if (!env.OPENAI_API_KEY || !hasWorkerAnalysisConfiguration(env)) return json({ ok: false, code: "ANALYSIS_CONFIGURATION_ERROR" }, 503);
  const xano = createXanoDealFinderClient(env, config.timeoutMs);
  const pending = asPending(await xano.getPendingAnalyses(config.maxAnalysesPerRun)).slice(0, 1);
  if (!pending.length) return json({ ok: true, processed: 0, completed: 0, failed: 0, analysis_ids: [] });
  const analysisIds: number[] = [];
  let completed = 0;
  let failed = 0;
  for (const job of pending) {
    analysisIds.push(job.id);
    try {
      const claimed = await xano.claimAnalysis(job.id);
      const result = await analyzeDealFinderSnapshot(env, claimed.analysis.input_snapshot, config.model, config.timeoutMs);
      await xano.completeAnalysis(job.id, { model: config.model, provider_response_id: result.responseId, result: result.result, usage: result.usage });
      completed += 1;
    } catch (error) {
      const code = error instanceof OpenAiAnalysisError ? error.code : "UNKNOWN_ANALYSIS_ERROR";
      try { await xano.failAnalysis(job.id, code); } catch { logger.error("analysis_fail_status_update_failed", { analysis_id: job.id }); }
      failed += 1;
    }
  }
  return json({ ok: failed === 0, processed: pending.length, completed, failed, analysis_ids: analysisIds }, failed ? 502 : 200);
}

export async function handleRequest(request: Request, env: DealFinderSyncEnv) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    const manual = getDealFinderManualConfig(env);
    return json({
      ok: true,
      service: "sitecraft-deal-finder-sync",
      source: "kleinanzeigen_agent",
      xanoConfigured: Boolean(env.XANO_API_BASE_URL && env.XANO_DEAL_FINDER_INGEST_SECRET),
      providerConfigured: Boolean(env.KLEINANZEIGEN_AGENT_API_KEY),
      openaiConfigured: Boolean(env.OPENAI_API_KEY),
      manualSyncEnabled: manual.syncEnabled,
      manualAiEnabled: manual.aiEnabled,
      scheduledSyncEnabled: getDealFinderSyncConfig(env).syncEnabled,
    });
  }
  const supported = ["/sync", "/sync/dry-run", "/analyze", "/analyze/dry-run"];
  if (request.method !== "POST" || !supported.includes(url.pathname)) return json({ ok: false, code: "NOT_FOUND" }, 404);
  if (!constantTimeSecretEqual(request.headers.get("X-Deal-Finder-Secret"), env.DEAL_FINDER_WORKER_TRIGGER_SECRET)) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  const manual = getDealFinderManualConfig(env);
  if (url.pathname.startsWith("/sync") && !manual.syncEnabled) return json({ ok: false, code: "SYNC_DISABLED" }, 503);
  if (url.pathname.startsWith("/analyze") && !manual.aiEnabled) return json({ ok: false, code: "AI_DISABLED" }, 503);
  try {
    if (url.pathname === "/analyze/dry-run") return await handleAnalyzeDryRun(env);
    if (url.pathname === "/analyze") return await handleAnalyze(env);
    if (!hasWorkerSyncConfiguration(env)) return json({ ok: false, code: "CONFIGURATION_ERROR" }, 503);
    return json({ ok: true, ...(await runDealFinderSync(env, url.pathname === "/sync/dry-run", true)) });
  } catch (error) {
    logger.error(url.pathname.startsWith("/analyze") ? "analysis_failed" : "sync_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    return json({ ok: false, code: url.pathname.startsWith("/analyze") ? "ANALYSIS_FAILED" : "SYNC_FAILED" }, 502);
  }
}

export default {
  fetch: (request: Request, env: DealFinderSyncEnv) => handleRequest(request, env),
  scheduled: async (controller: { cron?: string }, env: DealFinderSyncEnv) => {
    if (controller.cron === "*/2 * * * *") {
      const config = getDealFinderAiConfig(env);
      if (!config.enabled || config.dryRun || !env.OPENAI_API_KEY || !hasWorkerAnalysisConfiguration(env)) return;
      try {
        const response = await handleAnalyze(env);
        if (!response.ok) logger.error("scheduled_analysis_failed", { status: response.status });
      } catch (error) {
        logger.error("scheduled_analysis_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
      }
      return;
    }

    const config = getDealFinderSyncConfig(env);
    if (!config.syncEnabled || config.dryRun || !hasWorkerSyncConfiguration(env)) return;
    try {
      await runDealFinderSync(env, false, true);
    } catch (error) {
      logger.error("scheduled_sync_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    }
  },
};
