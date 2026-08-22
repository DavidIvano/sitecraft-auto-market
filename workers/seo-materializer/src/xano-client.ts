import type {
  SeoMaterializerEnv,
  SeoQueueJob,
  SnapshotPage,
} from "./types.ts";

export class SeoMaterializerXanoError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const cleanBase = (value: unknown) => String(value || "").replace(/\/+$/, "");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(env: SeoMaterializerEnv, path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const maximumAttempts = 8;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${cleanBase(env.XANO_API_BASE_URL)}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Seo-Materializer-Secret": env.XANO_SEO_MATERIALIZER_SECRET || "",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as T & { code?: string };
      if (response.ok) return payload;
      const retryableCode = String(payload.code || "").includes("TOO_MANY_REQUESTS");
      if ((response.status === 429 || response.status >= 500 || retryableCode) && attempt < maximumAttempts - 1) {
        await sleep(Math.min(30_000, 1_500 * (2 ** attempt)));
        continue;
      }
      throw new SeoMaterializerXanoError(payload.code || `XANO_HTTP_${response.status}`, response.status);
    } catch (error) {
      if (error instanceof SeoMaterializerXanoError) throw error;
      if (attempt < maximumAttempts - 1) {
        await sleep(Math.min(30_000, 1_500 * (2 ** attempt)));
        continue;
      }
      if (error instanceof DOMException && error.name === "AbortError") throw new SeoMaterializerXanoError("XANO_TIMEOUT", 504);
      throw new SeoMaterializerXanoError("XANO_NETWORK_ERROR", 503);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new SeoMaterializerXanoError("XANO_RETRY_EXHAUSTED", 503);
}

export const claimJobs = (env: SeoMaterializerEnv, workerId: string, timeoutMs: number) =>
  request<{ jobs: SeoQueueJob[] }>(env, "/seo/internal/queue/claim", { worker_id: workerId, limit: 100 }, timeoutMs);
export const loadSnapshotPage = (env: SeoMaterializerEnv, page: number, limit: number, timeoutMs: number) =>
  request<SnapshotPage>(env, "/seo/internal/snapshot/page", { page, limit }, timeoutMs);
export const stageFacets = (env: SeoMaterializerEnv, generation: string, rows: Record<string, unknown>[], timeoutMs: number) =>
  request<{ items: { key: string; id: number }[] }>(env, "/seo/internal/generation/facets", { generation, rows }, timeoutMs);
export const stageRows = (env: SeoMaterializerEnv, generation: string, kind: string, rows: Record<string, unknown>[], timeoutMs: number) =>
  request<{ inserted: number }>(env, "/seo/internal/generation/rows", { generation, kind, rows }, timeoutMs);
export const activateGeneration = (env: SeoMaterializerEnv, body: Record<string, unknown>, timeoutMs: number) =>
  request<Record<string, unknown>>(env, "/seo/internal/generation/activate", body, timeoutMs);
export const failJobs = (env: SeoMaterializerEnv, workerId: string, jobIds: number[], errorCode: string, timeoutMs: number) =>
  request<Record<string, unknown>>(env, "/seo/internal/queue/fail", { worker_id: workerId, job_ids: jobIds, error_code: errorCode }, timeoutMs);
export const checkpointJobs = (env: SeoMaterializerEnv, workerId: string, jobIds: number[], generation: string, nextCursor: number, timeoutMs: number) =>
  request<Record<string, unknown>>(env, "/seo/internal/queue/checkpoint", {
    worker_id: workerId,
    job_ids: jobIds,
    generation,
    next_cursor: nextCursor,
  }, timeoutMs);
