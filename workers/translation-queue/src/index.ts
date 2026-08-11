import {
  constantTimeSecretEqual,
  getTranslationWorkerConfig,
  normalizeTargetLocale,
} from "./env.ts";
import type { RunOptions, TranslationWorkerEnv } from "./types.ts";
import {
  claimTranslationJob,
  completeTranslationJob,
  failTranslationJob,
  getPendingTranslationJobs,
  prepareTranslationJobs,
  translateClaimedJob,
  TranslationXanoError,
} from "./xano-client.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const safeErrorCode = (error: unknown) => {
  if (error instanceof TranslationXanoError) return error.code;
  return "TRANSLATION_WORKER_ERROR";
};

export async function runTranslationBatch(env: TranslationWorkerEnv, options: RunOptions) {
  const config = getTranslationWorkerConfig(env);
  if (!config.configured) return { ok: false, code: "CONFIGURATION_ERROR", processed: 0 };
  if (!options.dryRun && (!config.enabled || config.dryRun)) {
    return { ok: false, code: "LIVE_PROCESSING_DISABLED", processed: 0 };
  }

  const limit = Math.min(Math.max(1, options.limit), config.maxJobsPerRun, 3);
  const preparation = await prepareTranslationJobs(env, options.targetLocale, options.dryRun, config.timeoutMs);
  const pending = await getPendingTranslationJobs(env, options.targetLocale, limit, config.timeoutMs);
  const jobs = Array.isArray(pending.jobs) ? pending.jobs.slice(0, limit) : [];

  if (options.dryRun) {
    return {
      ok: true,
      dry_run: true,
      target_locale: options.targetLocale,
      candidate_job_ids: jobs.map((job) => job.id),
      preparation,
      processed: 0,
    };
  }

  const workerId = `translation-worker:${crypto.randomUUID()}`;
  const outcomes: Array<{ job_id: number; outcome: string }> = [];
  for (const job of jobs) {
    try {
      const claim = await claimTranslationJob(env, job.id, workerId, config.timeoutMs);
      if (!claim.should_translate) {
        outcomes.push({ job_id: job.id, outcome: claim.outcome || "skipped" });
        continue;
      }
      const translation = await translateClaimedJob(env, job.id, config.timeoutMs);
      if (!translation.translation?.title?.trim() || !translation.translation?.description?.trim()) {
        throw new TranslationXanoError("OPENAI_INVALID_OUTPUT", 502);
      }
      await completeTranslationJob(env, job.id, translation, config.timeoutMs);
      outcomes.push({ job_id: job.id, outcome: "completed" });
    } catch (error) {
      const code = safeErrorCode(error);
      await failTranslationJob(env, job.id, code, config.timeoutMs).catch(() => undefined);
      outcomes.push({ job_id: job.id, outcome: code });
      break;
    }
  }

  return {
    ok: outcomes.every((item) => item.outcome === "completed" || ["completed", "outdated", "not_public"].includes(item.outcome)),
    dry_run: false,
    target_locale: options.targetLocale,
    processed: outcomes.length,
    outcomes,
  };
}

export async function handleRequest(request: Request, env: TranslationWorkerEnv) {
  const url = new URL(request.url);
  const config = getTranslationWorkerConfig(env);
  if (url.pathname === "/health") {
    return json({
      ok: true,
      service: "sitecraft-translation-queue",
      configured: config.configured,
      enabled: config.enabled,
      dry_run: config.dryRun,
      scheduled_enabled: config.scheduledEnabled,
      max_jobs_per_run: config.maxJobsPerRun,
    });
  }

  if (url.pathname !== "/run") return json({ ok: false, code: "NOT_FOUND" }, 404);
  if (request.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!constantTimeSecretEqual(request.headers.get("X-Translation-Trigger-Secret"), env.TRANSLATION_WORKER_TRIGGER_SECRET)) {
    return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  }

  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  const targetLocale = normalizeTargetLocale(input.target_locale, env);
  if (!targetLocale) return json({ ok: false, code: "UNSUPPORTED_LOCALE" }, 400);
  const requestedLimit = Number(input.limit || config.maxJobsPerRun);
  const dryRun = input.dry_run === true || config.dryRun || !config.enabled;
  const result = await runTranslationBatch(env, {
    targetLocale,
    limit: Number.isInteger(requestedLimit) ? requestedLimit : config.maxJobsPerRun,
    dryRun,
    source: "manual",
  });
  return json(result, result.ok ? 200 : 503);
}

export default {
  fetch: handleRequest,
  async scheduled(_event: { cron?: string }, env: TranslationWorkerEnv) {
    const config = getTranslationWorkerConfig(env);
    const targetLocale = normalizeTargetLocale(undefined, env);
    if (!config.enabled || config.dryRun || !config.scheduledEnabled || !config.configured || !targetLocale) return;
    await runTranslationBatch(env, {
      targetLocale,
      limit: config.maxJobsPerRun,
      dryRun: false,
      source: "scheduled",
    }).then((result) => console.log(JSON.stringify({ service: "sitecraft-translation-queue", event: "batch", ...result })));
  },
};
