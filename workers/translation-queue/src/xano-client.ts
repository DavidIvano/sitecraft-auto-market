import type {
  ClaimResponse,
  PendingJobsResponse,
  ProviderTranslationResponse,
  TranslationWorkerEnv,
} from "./types.ts";

export class TranslationXanoError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const cleanBaseUrl = (value: string | undefined) => String(value || "").replace(/\/+$/, "");

async function xanoRequest<T>(env: TranslationWorkerEnv, path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${cleanBaseUrl(env.XANO_API_BASE_URL)}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Translation-Worker-Secret": env.XANO_TRANSLATION_WORKER_SECRET || "",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as T & { code?: string; message?: string };
    if (!response.ok) throw new TranslationXanoError(payload.code || `XANO_HTTP_${response.status}`, response.status);
    return payload;
  } catch (error) {
    if (error instanceof TranslationXanoError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new TranslationXanoError("XANO_TIMEOUT", 504);
    throw new TranslationXanoError("XANO_NETWORK_ERROR", 503);
  } finally {
    clearTimeout(timeout);
  }
}

export const prepareTranslationJobs = (env: TranslationWorkerEnv, targetLocale: string, dryRun: boolean, timeoutMs: number) =>
  xanoRequest<Record<string, unknown>>(env, "/translations/internal/prepare", {
    target_locale: targetLocale,
    dry_run: dryRun,
  }, timeoutMs);

export const getPendingTranslationJobs = (env: TranslationWorkerEnv, targetLocale: string, limit: number, timeoutMs: number) =>
  xanoRequest<PendingJobsResponse>(env, "/translations/internal/jobs/pending", {
    target_locale: targetLocale,
    limit,
  }, timeoutMs);

export const claimTranslationJob = (env: TranslationWorkerEnv, jobId: number, workerId: string, timeoutMs: number) =>
  xanoRequest<ClaimResponse>(env, `/translations/internal/jobs/${jobId}/claim`, { worker_id: workerId }, timeoutMs);

export const translateClaimedJob = (env: TranslationWorkerEnv, jobId: number, timeoutMs: number) =>
  xanoRequest<ProviderTranslationResponse>(env, `/translations/internal/jobs/${jobId}/translate`, {}, timeoutMs);

export const completeTranslationJob = (
  env: TranslationWorkerEnv,
  jobId: number,
  translation: ProviderTranslationResponse,
  timeoutMs: number,
) => xanoRequest<Record<string, unknown>>(env, `/translations/internal/jobs/${jobId}/complete`, {
  title: translation.translation?.title || "",
  description: translation.translation?.description || "",
  model: translation.model || "gpt-5.6-luna",
  provider_response_id: translation.provider_response_id || null,
}, timeoutMs);

export const failTranslationJob = (env: TranslationWorkerEnv, jobId: number, errorCode: string, timeoutMs: number) =>
  xanoRequest<Record<string, unknown>>(env, `/translations/internal/jobs/${jobId}/fail`, {
    error_code: errorCode,
  }, timeoutMs);
