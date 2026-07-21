import { getDealFinderSyncConfig, type DealFinderSyncEnv } from "./env.ts";
import { createKleinanzeigenAgentClient } from "./kleinanzeigen-agent-client.ts";
import { logger } from "./logger.ts";
import { mapKleinanzeigenAd } from "./normalizers.ts";
import type { DealFinderSearchProfile, IngestListing, IngestResponse, SyncMetadata, SyncResult } from "./types.ts";
import { validateIngestListing } from "./validators.ts";
import { createXanoDealFinderClient } from "./xano-client.ts";

const asSearches = (value: { data?: DealFinderSearchProfile[] } | DealFinderSearchProfile[]) => Array.isArray(value) ? value : value.data || [];
function searchQuery(profile: DealFinderSearchProfile, maxResults: number) { return { q: [profile.brand, profile.model, ...(profile.required_keywords || [])].filter(Boolean).join(" ") || undefined, category_id: profile.category_id || undefined, location_id: profile.location_id || undefined, distance: profile.radius_km || undefined, min_price: profile.price_min || undefined, max_price: profile.price_max || undefined, picture_required: profile.picture_required === true ? true : undefined, poster_type: profile.seller_types?.[0] || undefined, page: 0, size: Math.min(maxResults, 100) }; }
export async function runDealFinderSync(env: DealFinderSyncEnv, requestedDryRun?: boolean, allowDisabledSearches = false): Promise<SyncResult> {
  const config = getDealFinderSyncConfig(env); const dryRun = requestedDryRun ?? config.dryRun; const xano = createXanoDealFinderClient(env, config.timeoutMs); const agent = createKleinanzeigenAgentClient(env, config.timeoutMs);
  const searches = asSearches(await xano.getActiveSearches()).filter((search) => search.is_active !== false && (dryRun || allowDisabledSearches || search.sync_enabled !== false) && search.source_type === "kleinanzeigen_agent").slice(0, config.maxSearchesPerRun);
  const candidates: Array<{ search: DealFinderSearchProfile; listing: IngestListing }> = [];
  for (const search of searches) { const response = await agent.searchListings(searchQuery(search, config.maxSearchResultsPerRun)); for (const ad of (response.data?.ads || []).slice(0, config.maxSearchResultsPerRun)) { const listing = mapKleinanzeigenAd(ad); if (listing && validateIngestListing(listing)) candidates.push({ search, listing }); } }
  const existingKeys = new Set<string>();
  const candidatesBySearch = new Map<number, typeof candidates>();
  for (const candidate of candidates) {
    candidatesBySearch.set(candidate.search.id, [...(candidatesBySearch.get(candidate.search.id) || []), candidate]);
  }
  for (const [searchId, searchCandidates] of candidatesBySearch) {
    const externalIds = [...new Set(searchCandidates.map((candidate) => candidate.listing.external_id))];
    const response = await xano.existingIds(searchId, externalIds);
    for (const externalId of response.existing_ids || []) existingKeys.add(`${searchId}:${externalId}`);
  }
  const isExisting = (candidate: (typeof candidates)[number]) => existingKeys.has(`${candidate.search.id}:${candidate.listing.external_id}`);
  const newCandidates = candidates.filter((candidate) => !isExisting(candidate)).slice(0, config.maxDetailsPerRun);
  const existingCandidates = candidates.filter(isExisting);
  let detailsFetched = 0;
  let detailFailures = 0;
  const detailCandidates: Array<{ search: DealFinderSearchProfile; listing: IngestListing }> = [];
  if (!dryRun) {
    for (const candidate of newCandidates) {
      try {
        const detailFetchedAt = new Date().toISOString();
        const detailResponse = await agent.getListingDetails(candidate.listing.external_id);
        const enriched = mapKleinanzeigenAd(detailResponse.data?.ad || {}, { dataLevel: "detail", detailFetchedAt });
        if (enriched && validateIngestListing(enriched)) {
          detailCandidates.push({ search: candidate.search, listing: enriched });
          detailsFetched += 1;
        } else {
          detailFailures += 1;
        }
      } catch {
        detailFailures += 1;
      }
    }
  }
  logger.info("sync_candidates_collected", { searches: searches.length, candidates: candidates.length, newCandidates: newCandidates.length, existingCandidates: existingCandidates.length, detailsFetched, detailFailures, dryRun });
  if (dryRun) return { dryRun: true, searches: searches.length, candidates: candidates.length, newCandidates: newCandidates.length, existingCandidates: existingCandidates.length, detailsFetched, detailFailures, touched: 0, touchMissing: 0 };

  const seenAt = new Date().toISOString();
  let touched = 0;
  let touchMissing = 0;
  const existingBySearch = new Map<number, string[]>();
  for (const candidate of existingCandidates) existingBySearch.set(candidate.search.id, [...(existingBySearch.get(candidate.search.id) || []), candidate.listing.external_id]);

  const metadata = (rejected: number, touchedCount = touched): SyncMetadata => ({
    candidates_found: candidates.length,
    new_candidates: newCandidates.length,
    existing_candidates: existingCandidates.length,
    details_fetched: detailsFetched,
    detail_failures: detailFailures,
    touched: touchedCount,
    rejected,
  });

  for (const [searchId, externalIds] of existingBySearch) {
    const result = await xano.touchSeenListings({
      platform: "kleinanzeigen",
      searchId,
      seenAt,
      externalIds: [...new Set(externalIds)],
      logSync: detailCandidates.length === 0,
      syncMetadata: metadata(detailFailures),
    });
    touched += result.touched;
    touchMissing += result.missing;
  }

  const bySearch = new Map<number, IngestListing[]>();
  for (const candidate of detailCandidates) bySearch.set(candidate.search.id, [...(bySearch.get(candidate.search.id) || []), candidate.listing]);
  let ingested: IngestResponse | undefined;
  if (bySearch.size > 0) {
    ingested = { created: 0, updated: 0, duplicates: 0, rejected: 0, created_listing_ids: [] };
    for (const [searchId, listings] of bySearch) {
      const result = await xano.ingest(searchId, listings, seenAt, metadata(detailFailures, touched));
      ingested = { created: ingested.created + result.created, updated: ingested.updated + result.updated, duplicates: ingested.duplicates + result.duplicates, rejected: ingested.rejected + result.rejected, created_listing_ids: [...ingested.created_listing_ids, ...result.created_listing_ids] };
    }
  }
  return { dryRun: false, searches: searches.length, candidates: candidates.length, newCandidates: newCandidates.length, existingCandidates: existingCandidates.length, detailsFetched, detailFailures, touched, touchMissing, ingested };
}
