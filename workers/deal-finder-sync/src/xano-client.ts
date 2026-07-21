import type { DealFinderSyncEnv } from "./env.ts";
import type { DealFinderSearchProfile, IngestListing, IngestResponse, SyncMetadata, TouchSeenInput, TouchSeenResponse } from "./types.ts";
import type { PendingAnalysis, StructuredAnalysis, AnalysisUsage } from "./analysis.ts";

export class XanoDealFinderError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
function baseUrl(value: string | undefined) { if (!value) throw new XanoDealFinderError("CONFIGURATION_ERROR", 503); return value.replace(/\/+$/, ""); }
export function createXanoDealFinderClient(env: DealFinderSyncEnv, timeoutMs: number) {
  const request = async <T>(path: string, init: RequestInit = {}) => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl(env.XANO_API_BASE_URL)}${path}`, { ...init, headers: { "Content-Type": "application/json", "X-Deal-Finder-Secret": env.XANO_DEAL_FINDER_INGEST_SECRET || "", ...init.headers }, signal: controller.signal });
      const payload = await response.json().catch(() => null) as T | null;
      if (!response.ok || !payload) throw new XanoDealFinderError("XANO_ERROR", response.status || 502);
      return payload;
    } catch (error) { if (error instanceof XanoDealFinderError) throw error; throw new XanoDealFinderError("XANO_UNAVAILABLE", 503); } finally { clearTimeout(timeout); }
  };
  return {
    getActiveSearches: () => request<{ data?: DealFinderSearchProfile[] } | DealFinderSearchProfile[]>("/deal-finder/internal/searches/active"),
    existingIds: (searchId: number, externalIds: string[]) => request<{ existing_ids?: string[] }>("/deal-finder/internal/listings/existing-ids", { method: "POST", body: JSON.stringify({ platform: "kleinanzeigen", search_id: searchId, external_ids: externalIds }) }),
    ingest: (searchId: number, listings: IngestListing[], fetchedAt: string, syncMetadata?: SyncMetadata) => request<IngestResponse>("/deal-finder/internal/listings/ingest", { method: "POST", body: JSON.stringify({ source_type: "kleinanzeigen_agent", search_id: searchId, fetched_at: fetchedAt, listings, sync_metadata: syncMetadata }) }),
    touchSeenListings: ({ platform, searchId, seenAt, externalIds, logSync = false, syncMetadata }: TouchSeenInput) => request<TouchSeenResponse>("/deal-finder/internal/listings/touch-seen", { method: "POST", body: JSON.stringify({ platform, search_id: searchId, seen_at: seenAt, external_ids: externalIds, log_sync: logSync, sync_metadata: syncMetadata }) }),
    getPendingAnalyses: (limit = 1) => request<{ data?: PendingAnalysis[] } | PendingAnalysis[]>(`/deal-finder/internal/analyses/pending?limit=${Math.max(1, Math.min(5, limit))}`),
    claimAnalysis: (id: number) => request<{ analysis: PendingAnalysis }>(`/deal-finder/internal/analyses/${id}/claim`, { method: "POST", body: "{}" }),
    completeAnalysis: (id: number, input: { model: string; provider_response_id: string | null; result: StructuredAnalysis; usage: AnalysisUsage }) => request<{ analysis: { id: number; status: "completed" } }>(`/deal-finder/internal/analyses/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({
        model: input.model,
        provider_response_id: input.provider_response_id,
        ...input.result,
        usage: input.usage,
      }),
    }),
    failAnalysis: (id: number, errorCode: string) => request<{ analysis: { id: number; status: "failed" } }>(`/deal-finder/internal/analyses/${id}/fail`, { method: "POST", body: JSON.stringify({ error_code: errorCode }) }),
  };
}
