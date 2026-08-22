import type { SeoMaterializerEnv } from "./types.ts";

const boundedInteger = (value: unknown, fallback: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

export function getSeoMaterializerConfig(env: SeoMaterializerEnv) {
  return {
    configured: Boolean(env.XANO_API_BASE_URL && env.XANO_SEO_MATERIALIZER_SECRET),
    enabled: env.SEO_MATERIALIZER_ENABLED === "true",
    dryRun: env.SEO_MATERIALIZER_DRY_RUN !== "false",
    scheduledEnabled: env.SEO_MATERIALIZER_SCHEDULED_ENABLED === "true",
    batchSize: boundedInteger(env.SEO_MATERIALIZER_BATCH_SIZE, 50, 100),
    concurrency: boundedInteger(env.SEO_MATERIALIZER_CONCURRENCY, 1, 4),
    requestDelayMs: boundedInteger(env.SEO_MATERIALIZER_REQUEST_DELAY_MS, 2_100, 5_000),
    timeoutMs: boundedInteger(env.SEO_MATERIALIZER_HTTP_TIMEOUT_MS, 65_000, 90_000),
  };
}

export function constantTimeSecretEqual(provided: string | null, expected: string | undefined) {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}
