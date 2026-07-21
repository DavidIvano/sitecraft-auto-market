import type { DealFinderListResponse, DealFinderListing } from "./types.ts";

export function normalizeDealFinderListResponse(payload: unknown, defaultPerPage = 100): DealFinderListResponse {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = Array.isArray(source.data) ? source.data : Array.isArray(source.listings) ? source.listings : [];
  const rawPagination = source.pagination && typeof source.pagination === "object" ? source.pagination as Record<string, unknown> : {};

  return {
    data: data as DealFinderListing[],
    pagination: {
      page: Number(rawPagination.page || 1),
      per_page: Number(rawPagination.per_page || defaultPerPage),
      total: Number(rawPagination.total || data.length),
      total_pages: Number(rawPagination.total_pages || 1),
      has_next: rawPagination.has_next === true,
      has_previous: rawPagination.has_previous === true,
    },
  };
}
