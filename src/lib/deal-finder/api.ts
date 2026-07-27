import { API_ROUTES, buildApiUrl } from "../apiRoutes";
import { fetchCurrentUser, getAuthToken } from "../authClient";
import { DEAL_FINDER_DEFAULT_PER_PAGE, DEAL_FINDER_DEFAULT_SORT, DEAL_FINDER_USE_MOCK_DATA, DEAL_FINDER_WORKSPACE_API_ENABLED } from "./constants";
import { clampDealFinderPerPage } from "./pagination";
import { dealFinderMockEmails, dealFinderMockListings, dealFinderMockSearches, dealFinderMockSyncLogs, getDealFinderMockStats } from "./mock-data";
import type {
  DealFinderAnalysis,
  DealFinderAnalyzeResponse,
  DealFinderEmail,
  DealFinderFilters,
  DealFinderListing,
  DealFinderListingDetails,
  DealFinderListingState,
  DealFinderListResponse,
  DealFinderPagination,
  DealFinderSearch,
  DealFinderSearchInput,
  DealFinderStats,
  DealFinderSyncLog,
  DealFinderTranslationResponse,
  DealFinderWorkspacePayload,
} from "./types";
import { DealFinderApiError } from "./types";
import { normalizeDealFinderListResponse } from "./response";
import { applyDealFinderScoreQuery } from "./score-query";
import {
  normalizeWorkspaceRecord,
  readWorkspaceRecord,
  writeWorkspaceRecord,
  type DealFinderWorkspaceRecord,
} from "./workspace";
import {
  loadWorkspaceRecordFromServerOrLocal,
  saveWorkspaceRecordToServerOrLocal,
} from "./workspace-fallback";

type RequestOptions = RequestInit & { signal?: AbortSignal };

function createQuery(filters: DealFinderFilters = {}) {
  const params = new URLSearchParams();
  const values = {
    page: Math.max(1, Math.trunc(Number(filters.page) || 1)),
    per_page: clampDealFinderPerPage(filters.per_page),
    sort: filters.sort || DEAL_FINDER_DEFAULT_SORT,
    ...filters,
  };
  values.per_page = clampDealFinderPerPage(values.per_page);
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

function requireToken() {
  const token = getAuthToken();
  if (!token) throw new DealFinderApiError("Требуется вход в кабинет.", 401, "UNAUTHORIZED");
  return token;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = requireToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(buildApiUrl(path), { ...options, headers });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    if (response.status === 401) {
      const confirmedUser = await fetchCurrentUser(undefined, token, { force: true }).catch(() => null);
      if (confirmedUser?.id && getAuthToken() === token) {
        throw new DealFinderApiError(
          "Сессия подтверждена, но защищённый endpoint временно отклонил запрос.",
          503,
          "AUTH_STATE_MISMATCH",
        );
      }
    }
    const message = typeof payload?.message === "string" ? payload.message : "Deal Finder временно недоступен.";
    const code = typeof payload?.code === "string"
      ? payload.code
      : typeof payload?.error_code === "string"
        ? payload.error_code
        : undefined;
    throw new DealFinderApiError(message, response.status, code);
  }
  return payload as T;
}

function listingScore(listing: DealFinderListing) {
  return Number(listing.analysis?.deal_score || 0);
}

function getDealFinderMockListing(id: number | string) {
  const storedListing = dealFinderMockListings.find((item) => item.id === Number(id));
  if (storedListing || Number(id) !== 59) return storedListing;
  const description = "Zum Verkauf steht ein gepflegter Volkswagen Golf 1.6 TDI.\n\nDas Fahrzeug ist fahrbereit und wurde regelmäßig gewartet. Klimaanlage, Tempomat und zwei Schlüssel sind vorhanden.\n\nBekannte Hinweise: altersübliche Gebrauchsspuren. Bitte besichtigen und Probefahrt vereinbaren.";
  return {
    ...dealFinderMockListings[0],
    id: 59,
    title: "Volkswagen Golf 1.6 TDI Comfortline",
    description,
    source_image_url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1600&q=82",
    source_images: [
      "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1600&q=82",
    ],
    analysis: dealFinderMockListings[0].analysis ? { ...dealFinderMockListings[0].analysis, listing_id: 59 } : null,
  } satisfies DealFinderListing;
}

export function filterDealFinderMockListings(filters: DealFinderFilters = {}) {
  const term = filters.search?.trim().toLowerCase();
  const listings = dealFinderMockListings.filter((listing) => {
    if (filters.source_status && listing.source_status !== filters.source_status) return false;
    if (filters.user_status && listing.user_status !== filters.user_status) return false;
    if (filters.is_saved !== undefined && listing.is_saved !== filters.is_saved) return false;
    if (filters.is_new !== undefined && listing.is_new !== filters.is_new) return false;
    if (filters.is_hidden !== undefined && listing.is_hidden !== filters.is_hidden) return false;
    if (filters.brand && listing.brand?.toLowerCase() !== filters.brand.toLowerCase()) return false;
    if (filters.model && listing.model?.toLowerCase() !== filters.model.toLowerCase()) return false;
    if (filters.price_min !== undefined && (listing.price ?? 0) < filters.price_min) return false;
    if (filters.price_max !== undefined && (listing.price ?? 0) > filters.price_max) return false;
    if (filters.year_min !== undefined && (listing.year ?? 0) < filters.year_min) return false;
    if (filters.year_max !== undefined && (listing.year ?? 0) > filters.year_max) return false;
    if (filters.mileage_max !== undefined && (listing.mileage ?? Number.MAX_SAFE_INTEGER) > filters.mileage_max) return false;
    if (filters.fuel_type && listing.fuel_type?.toLowerCase() !== filters.fuel_type.toLowerCase()) return false;
    if (filters.transmission && listing.transmission?.toLowerCase() !== filters.transmission.toLowerCase()) return false;
    if (filters.deal_score_min !== undefined && listingScore(listing) < filters.deal_score_min) return false;
    if (filters.deal_score_max !== undefined && listingScore(listing) > filters.deal_score_max) return false;
    if (!term) return true;
    return [listing.title, listing.brand, listing.model, listing.city].filter(Boolean).join(" ").toLowerCase().includes(term);
  });
  const sort = filters.sort || DEAL_FINDER_DEFAULT_SORT;
  return [...listings].sort((left, right) => {
    if (sort === "price_asc") return (left.price ?? Infinity) - (right.price ?? Infinity);
    if (sort === "price_desc") return (right.price ?? -Infinity) - (left.price ?? -Infinity);
    if (sort === "deal_score_desc") return listingScore(right) - listingScore(left);
    if (sort === "deal_score_asc") return listingScore(left) - listingScore(right);
    if (sort === "profit_desc") return (right.analysis?.potential_profit_high ?? -Infinity) - (left.analysis?.potential_profit_high ?? -Infinity);
    const leftDate = Date.parse(left.first_seen_at);
    const rightDate = Date.parse(right.first_seen_at);
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

function createMockResponse(filters: DealFinderFilters): DealFinderListResponse {
  const page = Math.max(1, filters.page || 1);
  const perPage = clampDealFinderPerPage(filters.per_page);
  const all = filterDealFinderMockListings(filters);
  const totalPages = Math.max(1, Math.ceil(all.length / perPage));
  const pagination: DealFinderPagination = {
    page,
    per_page: perPage,
    total: all.length,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_previous: page > 1,
  };
  return { data: all.slice((page - 1) * perPage, page * perPage), pagination };
}

export async function getDealFinderStats(signal?: AbortSignal): Promise<DealFinderStats> {
  if (DEAL_FINDER_USE_MOCK_DATA) return getDealFinderMockStats();
  return request<DealFinderStats>(API_ROUTES.dealFinderStats, { signal });
}

export async function getDealFinderListings(filters: DealFinderFilters = {}, signal?: AbortSignal): Promise<DealFinderListResponse> {
  if (DEAL_FINDER_USE_MOCK_DATA) return createMockResponse(filters);
  const needsCompleteScoreSet = filters.deal_score_min !== undefined
    || filters.deal_score_max !== undefined
    || filters.sort === "deal_score_desc"
    || filters.sort === "deal_score_asc"
    || filters.sort === "profit_desc";
  if (needsCompleteScoreSet) {
    const requestedPage = Math.max(1, filters.page || 1);
    const requestedPerPage = clampDealFinderPerPage(filters.per_page);
    const serverFilters: DealFinderFilters = {
      ...filters,
      page: 1,
      per_page: 100,
      sort: "newest",
      deal_score_min: undefined,
      deal_score_max: undefined,
    };
    const requestPage = async (page: number) => {
      const query = createQuery({ ...serverFilters, page });
      return normalizeDealFinderListResponse(
        await request<unknown>(`${API_ROUTES.dealFinderListings}?${query}`, { signal }),
        100,
      );
    };
    const first = await requestPage(1);
    const all = [...first.data];
    for (let page = 2; page <= first.pagination.total_pages; page += 1) {
      all.push(...(await requestPage(page)).data);
    }
    const matched = applyDealFinderScoreQuery(all, filters);
    const totalPages = Math.max(1, Math.ceil(matched.length / requestedPerPage));
    const start = (requestedPage - 1) * requestedPerPage;
    return {
      data: matched.slice(start, start + requestedPerPage),
      pagination: {
        page: requestedPage,
        per_page: requestedPerPage,
        total: matched.length,
        total_pages: totalPages,
        has_next: requestedPage < totalPages,
        has_previous: requestedPage > 1,
      },
    };
  }
  const query = createQuery(filters);
  return normalizeDealFinderListResponse(
    await request<unknown>(`${API_ROUTES.dealFinderListings}${query ? `?${query}` : ""}`, { signal }),
    DEAL_FINDER_DEFAULT_PER_PAGE,
  );
}

export async function getDealFinderListing(id: number | string, signal?: AbortSignal): Promise<DealFinderListingDetails> {
  if (DEAL_FINDER_USE_MOCK_DATA) {
    const listing = getDealFinderMockListing(id);
    if (!listing) throw new DealFinderApiError("Объявление не найдено.", 404, "NOT_FOUND");
    return {
      listing,
      analysis: listing.analysis || null,
      search: dealFinderMockSearches.find((item) => item.id === listing.search_id) || null,
      email: null,
      allowed_actions: { view: true, save: true, hide: true, reanalyze: true },
    };
  }
  return request<DealFinderListingDetails>(API_ROUTES.dealFinderListing(id), { signal });
}

export async function getDealFinderSearches(signal?: AbortSignal): Promise<DealFinderSearch[]> {
  if (DEAL_FINDER_USE_MOCK_DATA) return dealFinderMockSearches;
  const payload = await request<{ data?: DealFinderSearch[] } | DealFinderSearch[]>(API_ROUTES.dealFinderSearches, { signal });
  return Array.isArray(payload) ? payload : payload.data || [];
}

export async function createDealFinderSearch(input: DealFinderSearchInput, signal?: AbortSignal): Promise<DealFinderSearch> {
  return request<DealFinderSearch>(API_ROUTES.dealFinderSearches, { method: "POST", body: JSON.stringify(input), signal });
}

export async function updateDealFinderSearch(id: number | string, input: Partial<DealFinderSearchInput>, signal?: AbortSignal): Promise<DealFinderSearch> {
  return request<DealFinderSearch>(API_ROUTES.dealFinderSearch(id), { method: "PATCH", body: JSON.stringify(input), signal });
}

export async function disableDealFinderSearch(id: number | string, signal?: AbortSignal): Promise<void> {
  await request<Record<string, unknown>>(API_ROUTES.dealFinderSearch(id), { method: "DELETE", signal });
}

async function listingAction(id: number | string, path: (value: number | string) => string, signal?: AbortSignal) {
  return request<DealFinderListingState>(path(id), { method: "POST", signal });
}

export const markDealFinderViewed = (id: number | string, signal?: AbortSignal) => listingAction(id, API_ROUTES.dealFinderListingView, signal);
export const saveDealFinderListing = (id: number | string, signal?: AbortSignal) => listingAction(id, API_ROUTES.dealFinderListingSave, signal);
export const unsaveDealFinderListing = (id: number | string, signal?: AbortSignal) => listingAction(id, API_ROUTES.dealFinderListingUnsave, signal);
export const hideDealFinderListing = (id: number | string, signal?: AbortSignal) => listingAction(id, API_ROUTES.dealFinderListingHide, signal);
export const restoreDealFinderListing = (id: number | string, signal?: AbortSignal) => listingAction(id, API_ROUTES.dealFinderListingRestore, signal);
export async function requestDealFinderDescriptionTranslation(
  id: number | string,
  targetLanguage: "ru" = "ru",
  signal?: AbortSignal,
): Promise<DealFinderTranslationResponse> {
  if (DEAL_FINDER_USE_MOCK_DATA) {
    const listing = getDealFinderMockListing(id);
    if (!listing) throw new DealFinderApiError("Объявление не найдено.", 404, "NOT_FOUND");
    if (!listing.description?.trim()) throw new DealFinderApiError("В объявлении нет описания для перевода.", 422, "DESCRIPTION_REQUIRED");
    return {
      translation: {
        id: 9000 + listing.id,
        listing_id: listing.id,
        source_language: "de",
        target_language: targetLanguage,
        status: "completed",
        translated_text: `Тестовый перевод: ${listing.description}`,
        completed_at: new Date().toISOString(),
        cached: true,
      },
    };
  }
  return request<DealFinderTranslationResponse>(API_ROUTES.dealFinderListingTranslateDescription(id), {
    method: "POST",
    body: JSON.stringify({ source_language: "de", target_language: targetLanguage }),
    signal,
  });
}
export const requestDealFinderAnalysis = (
  id: number | string,
  options: { force?: boolean; signal?: AbortSignal } = {},
) => {
  if (DEAL_FINDER_USE_MOCK_DATA) {
    const listing = dealFinderMockListings.find((item) => item.id === Number(id));
    if (!listing) throw new DealFinderApiError("Объявление не найдено.", 404, "NOT_FOUND");
    if (listing.analysis && ["pending", "processing"].includes(listing.analysis.status)) {
      return Promise.resolve({ analysis: { id: listing.analysis.id, listing_id: listing.id, status: listing.analysis.status, created_at: listing.analysis.created_at, reused: true } } satisfies DealFinderAnalyzeResponse);
    }
    const pending: DealFinderAnalysis = {
      id: Date.now(), listing_id: listing.id, status: "pending", analysis_status: "pending",
      positive_signals: [], negative_signals: [], missing_information: [], known_defects: [], recommended_questions: [],
      created_at: new Date().toISOString(),
    };
    listing.analysis = pending;
    return Promise.resolve({ analysis: { id: pending.id, listing_id: listing.id, status: pending.status, created_at: pending.created_at, reused: false } } satisfies DealFinderAnalyzeResponse);
  }
  return request<DealFinderAnalyzeResponse>(API_ROUTES.dealFinderListingAnalyze(id), {
    method: "POST",
    body: JSON.stringify({ force: options.force === true }),
    signal: options.signal,
  });
};

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export async function getDealFinderWorkspace(id: number | string, signal?: AbortSignal): Promise<DealFinderWorkspaceRecord> {
  const listingId = Number(id);
  if (!DEAL_FINDER_WORKSPACE_API_ENABLED || DEAL_FINDER_USE_MOCK_DATA) {
    return readWorkspaceRecord(browserStorage(), listingId);
  }
  return loadWorkspaceRecordFromServerOrLocal(
    listingId,
    () => request<unknown>(API_ROUTES.dealFinderListingWorkspace(id), { signal }),
    browserStorage(),
  );
}

export async function saveDealFinderWorkspace(
  id: number | string,
  input: DealFinderWorkspacePayload,
  signal?: AbortSignal,
): Promise<DealFinderWorkspaceRecord> {
  const listingId = Number(id);
  if (!DEAL_FINDER_WORKSPACE_API_ENABLED || DEAL_FINDER_USE_MOCK_DATA) {
    return writeWorkspaceRecord(browserStorage(), normalizeWorkspaceRecord({ ...input, storage: "local" }, listingId));
  }
  return saveWorkspaceRecordToServerOrLocal(
    listingId,
    input,
    () => request<unknown>(API_ROUTES.dealFinderListingWorkspace(id), {
      method: "PATCH",
      body: JSON.stringify(input),
      signal,
    }),
    browserStorage(),
  );
}

export async function getDealFinderSyncLogs(signal?: AbortSignal): Promise<DealFinderSyncLog[]> {
  if (DEAL_FINDER_USE_MOCK_DATA) return dealFinderMockSyncLogs;
  const payload = await request<{ data?: DealFinderSyncLog[] } | DealFinderSyncLog[]>(API_ROUTES.dealFinderSyncLogs, { signal });
  return Array.isArray(payload) ? payload : payload.data || [];
}

export async function getDealFinderEmails(signal?: AbortSignal): Promise<DealFinderEmail[]> {
  if (DEAL_FINDER_USE_MOCK_DATA) return dealFinderMockEmails;
  void signal;
  return [];
}
