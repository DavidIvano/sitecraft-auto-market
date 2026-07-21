import type { DealFinderFilters, DealFinderListing } from "./types.ts";

function listingScore(listing: DealFinderListing) {
  return Number(listing.analysis?.deal_score || 0);
}

export function applyDealFinderScoreQuery(listings: DealFinderListing[], filters: DealFinderFilters = {}) {
  const filtered = listings.filter((listing) => {
    const score = listingScore(listing);
    if (filters.deal_score_min !== undefined && score < filters.deal_score_min) return false;
    if (filters.deal_score_max !== undefined && score > filters.deal_score_max) return false;
    return true;
  });
  if (filters.sort === "deal_score_desc") return [...filtered].sort((left, right) => listingScore(right) - listingScore(left));
  if (filters.sort === "deal_score_asc") return [...filtered].sort((left, right) => listingScore(left) - listingScore(right));
  return filtered;
}
