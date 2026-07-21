export type DealFinderSyncEnv = {
  KLEINANZEIGEN_AGENT_API_KEY?: string;
  XANO_API_BASE_URL?: string;
  XANO_DEAL_FINDER_INGEST_SECRET?: string;
  DEAL_FINDER_WORKER_TRIGGER_SECRET?: string;
  OPENAI_API_KEY?: string;
  DEAL_FINDER_OPENAI_MODEL?: string;
  DEAL_FINDER_MAX_AI_ANALYSES_PER_RUN?: string;
  DEAL_FINDER_AI_ENABLED?: string;
  DEAL_FINDER_AI_DRY_RUN?: string;
  DEAL_FINDER_AI_TIMEOUT_MS?: string;
  DEAL_FINDER_SYNC_ENABLED?: string;
  DEAL_FINDER_MANUAL_SYNC_ENABLED?: string;
  DEAL_FINDER_MANUAL_AI_ENABLED?: string;
  DEAL_FINDER_SYNC_INTERVAL_MINUTES?: string;
  DEAL_FINDER_MAX_SEARCHES_PER_RUN?: string;
  DEAL_FINDER_MAX_SEARCH_RESULTS_PER_RUN?: string;
  DEAL_FINDER_MAX_DETAILS_PER_RUN?: string;
  DEAL_FINDER_MAX_AI_ANALYSES_PER_SYNC?: string;
  DEAL_FINDER_HTTP_TIMEOUT_MS?: string;
  DEAL_FINDER_DRY_RUN?: string;
};

export type DealFinderSyncConfig = { syncEnabled: boolean; dryRun: boolean; maxSearchesPerRun: number; maxSearchResultsPerRun: number; maxDetailsPerRun: number; maxAiAnalysesPerSync: number; timeoutMs: number };
export type DealFinderAiConfig = { enabled: boolean; dryRun: boolean; model: string; maxAnalysesPerRun: number; timeoutMs: number };
export type DealFinderManualConfig = { syncEnabled: boolean; aiEnabled: boolean };

const positiveInteger = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

const nonNegativeInteger = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
};

export function getDealFinderSyncConfig(env: DealFinderSyncEnv): DealFinderSyncConfig {
  return {
    syncEnabled: env.DEAL_FINDER_SYNC_ENABLED === "true",
    dryRun: env.DEAL_FINDER_DRY_RUN !== "false",
    maxSearchesPerRun: positiveInteger(env.DEAL_FINDER_MAX_SEARCHES_PER_RUN, 1, 1),
    maxSearchResultsPerRun: positiveInteger(env.DEAL_FINDER_MAX_SEARCH_RESULTS_PER_RUN, 100, 100),
    maxDetailsPerRun: positiveInteger(env.DEAL_FINDER_MAX_DETAILS_PER_RUN, 4, 4),
    maxAiAnalysesPerSync: nonNegativeInteger(env.DEAL_FINDER_MAX_AI_ANALYSES_PER_SYNC, 0, 0),
    timeoutMs: positiveInteger(env.DEAL_FINDER_HTTP_TIMEOUT_MS, 15_000, 30_000),
  };
}

export function getDealFinderManualConfig(env: DealFinderSyncEnv): DealFinderManualConfig {
  return {
    syncEnabled: env.DEAL_FINDER_MANUAL_SYNC_ENABLED === "true",
    aiEnabled: env.DEAL_FINDER_MANUAL_AI_ENABLED === "true",
  };
}

export function hasWorkerSyncConfiguration(env: DealFinderSyncEnv) {
  return Boolean(env.KLEINANZEIGEN_AGENT_API_KEY && env.XANO_API_BASE_URL && env.XANO_DEAL_FINDER_INGEST_SECRET);
}

export function getDealFinderAiConfig(env: DealFinderSyncEnv): DealFinderAiConfig {
  return {
    enabled: env.DEAL_FINDER_AI_ENABLED === "true",
    dryRun: env.DEAL_FINDER_AI_DRY_RUN !== "false",
    model: env.DEAL_FINDER_OPENAI_MODEL?.trim() || "gpt-5.6-luna",
    maxAnalysesPerRun: positiveInteger(env.DEAL_FINDER_MAX_AI_ANALYSES_PER_RUN, 1, 1),
    timeoutMs: positiveInteger(env.DEAL_FINDER_AI_TIMEOUT_MS, 30_000, 30_000),
  };
}

export function hasWorkerAnalysisConfiguration(env: DealFinderSyncEnv) {
  return Boolean(env.XANO_API_BASE_URL && env.XANO_DEAL_FINDER_INGEST_SECRET);
}

export function constantTimeSecretEqual(received: string | null, expected: string | undefined) {
  if (!received || !expected || received.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < received.length; index += 1) difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}
