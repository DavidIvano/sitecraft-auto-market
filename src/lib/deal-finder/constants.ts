import type { DealFinderSort } from "./types.ts";

// Score thresholds are server-side configuration. These UI fallbacks deliberately
// don't expose private Worker variables to the client bundle.
export const DEAL_FINDER_MIN_SCORE = 70;
export const DEAL_FINDER_HOT_SCORE = 80;
export const DEAL_FINDER_ENABLED = import.meta.env?.PUBLIC_DEAL_FINDER_ENABLED === "true";
export const DEAL_FINDER_USE_MOCK_DATA = import.meta.env?.PUBLIC_DEAL_FINDER_USE_MOCK_DATA === "true";
export const DEAL_FINDER_WORKSPACE_API_ENABLED = import.meta.env?.PUBLIC_DEAL_FINDER_WORKSPACE_API_ENABLED === "true";
export const DEAL_FINDER_STAGE3_API_ENABLED = import.meta.env?.PUBLIC_DEAL_FINDER_STAGE3_API_ENABLED === "true";
export const DEAL_FINDER_PLACEHOLDER = "/deal-finder-placeholder.svg";
export const DEAL_FINDER_DEFAULT_SORT: DealFinderSort = "newest";
export const DEAL_FINDER_DEFAULT_PER_PAGE = 100;
export const DEAL_FINDER_MAX_PER_PAGE = 100;
export const DEAL_FINDER_PER_PAGE_OPTIONS = [24, 48, 100] as const;
export const DEAL_FINDER_ALLOWED_SORTS: DealFinderSort[] = [
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "deal_score_desc",
  "deal_score_asc",
  "profit_desc",
  "last_checked_asc",
];
