import type { DealFinderSyncEnv } from "./env.ts";
import type { KleinanzeigenAd, KleinanzeigenSearchResponse } from "./types.ts";

const BASE_URL = "https://api.kleinanzeigen-agent.de/api/v2/kleinanzeigen";
export class KleinanzeigenAgentError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

async function getJson<T>(env: DealFinderSyncEnv, path: string, timeoutMs: number) {
  if (!env.KLEINANZEIGEN_AGENT_API_KEY) throw new KleinanzeigenAgentError("CONFIGURATION_ERROR", 503);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${BASE_URL}${path}`, { headers: { klaz_key: env.KLEINANZEIGEN_AGENT_API_KEY }, signal: controller.signal });
      const payload = await response.json().catch(() => null) as KleinanzeigenSearchResponse | null;
      if (response.ok && payload?.success) return payload as T;
      const error = new KleinanzeigenAgentError(payload?.error_code || "UPSTREAM_ERROR", response.status || 502);
      if (attempt === 0 && retryableStatuses.has(error.status)) { await new Promise((resolve) => setTimeout(resolve, 250)); continue; }
      throw error;
    } catch (error) {
      if (attempt === 0 && !(error instanceof KleinanzeigenAgentError)) { await new Promise((resolve) => setTimeout(resolve, 250)); continue; }
      if (error instanceof KleinanzeigenAgentError) throw error;
      throw new KleinanzeigenAgentError("UPSTREAM_TIMEOUT", 504);
    } finally { clearTimeout(timeout); }
  }
  throw new KleinanzeigenAgentError("UPSTREAM_UNAVAILABLE", 503);
}

export function createKleinanzeigenAgentClient(env: DealFinderSyncEnv, timeoutMs: number) {
  return {
    async searchListings(params: Record<string, string | number | boolean | undefined>) { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value))); return getJson<KleinanzeigenSearchResponse>(env, `/search?${query}`, timeoutMs); },
    async getListingDetails(adId: string) { return getJson<{ success: boolean; data?: { ad?: KleinanzeigenAd } }>(env, `/ads/${encodeURIComponent(adId)}`, timeoutMs); },
    async getListingStatus(adId: string) { return getJson<{ success: boolean; data?: Record<string, unknown> }>(env, `/ads/${encodeURIComponent(adId)}/status`, timeoutMs); },
  };
}
