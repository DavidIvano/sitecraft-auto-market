import type { CarListing } from "./types";
import { parseOptionalScore } from "./aiScores";
import { sortPromotedCars } from "./monetization";
import { API_ROUTES, buildApiUrl, getXanoApiUrl, isXanoConfigured } from "./apiRoutes";
import { fetchWithRetry } from "./http/fetchWithRetry";
import { normalizePublicCarList, normalizePublicCarListing } from "./publicCar";
import { applyListingTranslation, applyListingTranslations, normalizeListingTranslation } from "./listingTranslation.ts";
import { DEFAULT_LOCALE, resolveBackendLocale, type Locale, type XanoLocale } from "../i18n/locales.ts";

const API_URL = getXanoApiUrl();
const PUBLIC_API_TIMEOUT_MS = 8_000;
const PUBLIC_API_RATE_LIMIT_ATTEMPTS = 5;
const PUBLIC_CATALOG_FRESH_MS = 60_000;
const PUBLIC_CATALOG_STALE_MS = 10 * 60_000;
let sellerListingsQueue: Promise<void> = Promise.resolve();
const catalogCache = new Map<XanoLocale, { cars: CarListing[]; freshUntil: number; staleUntil: number }>();
const catalogRequests = new Map<XanoLocale, Promise<CarListing[]>>();
const localizedCatalogCache = new Map<Locale, { cars: CarListing[]; freshUntil: number; staleUntil: number }>();
const localizedCatalogRequests = new Map<Locale, Promise<CarListing[]>>();

const withLocale = (path: string, locale: Locale) =>
  `${path}${path.includes("?") ? "&" : "?"}lang=${encodeURIComponent(locale)}`;

export class XanoPublicApiError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "XanoPublicApiError";
    this.status = status;
  }
}

async function fetchPublicJson(path: string) {
  let response: Response;
  try {
    const requestInit = {
      headers: { Accept: "application/json" },
      // Cloudflare caches the public Xano response close to the visitor. The
      // short TTL keeps new listings fresh while removing repeated origin wait
      // time during language switches and simultaneous page renders.
      cf: { cacheEverything: true, cacheTtl: 60 },
    } as RequestInit & { cf: { cacheEverything: boolean; cacheTtl: number } };
    response = await fetchWithRetry(buildApiUrl(path, API_URL), requestInit, {
      attempts: PUBLIC_API_RATE_LIMIT_ATTEMPTS,
      timeoutMs: PUBLIC_API_TIMEOUT_MS,
      delaysMs: [1_000, 3_000, 5_000, 5_000],
      dedupeKey: `xano-public:${path}`,
    });
  } catch (error) {
    throw new XanoPublicApiError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Xano public API timed out"
        : "Xano public API is unavailable",
      503,
    );
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new XanoPublicApiError("Xano public API request failed", response.status >= 500 ? 503 : 502);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new XanoPublicApiError("Xano public API returned a non-JSON response", 502);
  }

  try {
    return await response.json() as unknown;
  } catch {
    throw new XanoPublicApiError("Xano public API returned invalid JSON", 502);
  }
}

const loadApprovedCatalog = (locale: XanoLocale) => {
  const existing = catalogRequests.get(locale);
  if (existing) return existing;

  const request = (async () => {
    const path = withLocale(API_ROUTES.cars, locale);
    const payload = await fetchPublicJson(path);
    const cars = sortPromotedCars(applyListingTranslations(normalizePublicCarList(payload), locale));
    const now = Date.now();
    catalogCache.set(locale, {
      cars,
      freshUntil: now + PUBLIC_CATALOG_FRESH_MS,
      staleUntil: now + PUBLIC_CATALOG_STALE_MS,
    });
    return cars;
  })();

  catalogRequests.set(locale, request);
  void request.finally(() => {
    if (catalogRequests.get(locale) === request) catalogRequests.delete(locale);
  }).catch(() => {});
  return request;
};

const loadLocalizedApprovedCatalog = (locale: Locale) => {
  const existing = localizedCatalogRequests.get(locale);
  if (existing) return existing;

  const request = (async () => {
    const payload = await fetchPublicJson(withLocale(API_ROUTES.localizedCars, locale));
    const cars = sortPromotedCars(applyListingTranslations(normalizePublicCarList(payload), locale));
    const now = Date.now();
    localizedCatalogCache.set(locale, {
      cars,
      freshUntil: now + PUBLIC_CATALOG_FRESH_MS,
      staleUntil: now + PUBLIC_CATALOG_STALE_MS,
    });
    return cars;
  })();

  localizedCatalogRequests.set(locale, request);
  void request.finally(() => {
    if (localizedCatalogRequests.get(locale) === request) localizedCatalogRequests.delete(locale);
  }).catch(() => {});
  return request;
};

const queueSellerListingsRequest = <T>(request: () => Promise<T>) => {
  const result = sellerListingsQueue.then(request, request);
  sellerListingsQueue = result.then(() => undefined, () => undefined);
  return result;
};

const normalizeLimitedPublicCards = (payload: unknown, locale: Locale): CarListing[] => {
  if (!Array.isArray(payload)) return [];

  return payload.slice(0, 6).flatMap((item): CarListing[] => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const slugValue = String(source.slug || "").trim();
    const title = String(source.title || "").trim();
    if (!slugValue || !title) return [];

    return [applyListingTranslation({
      id: Number(source.id) || 0,
      slug: slugValue,
      title,
      brand: String(source.brand || ""),
      model: String(source.model || ""),
      year: Number(source.year) || 0,
      price: Number(source.price) || 0,
      currency: String(source.currency || "EUR"),
      mileage: Number(source.mileage) || 0,
      city: String(source.city || ""),
      country: String(source.country || ""),
      body_type: String(source.body_type || ""),
      fuel_type: String(source.fuel_type || ""),
      transmission: String(source.transmission || ""),
      thumbnail_url: String(source.thumbnail_url || ""),
      main_image_url: String(source.main_image_url || ""),
      primary_image_url: String(source.primary_image_url || ""),
      image_url: String(source.image_url || ""),
      cover_image_url: String(source.cover_image_url || ""),
      is_ai_generated: source.is_ai_generated === true,
      listing_quality_score: parseOptionalScore(source.listing_quality_score) ?? undefined,
      photo_quality_score: parseOptionalScore(source.photo_quality_score) ?? undefined,
      trust_score: parseOptionalScore(source.trust_score) ?? undefined,
      description: "",
      source_locale: String(source.source_locale || "ru"),
      translation: normalizeListingTranslation(source.translation || source.localized_translation),
      status: "approved",
      moderation_status: "approved",
      moderator_approved: true,
    }, locale)];
  });
};

type ApprovedCarsOptions = { requireConfigured?: boolean; locale?: Locale };

export type PublicCatalogPageOptions = {
  locale?: Locale;
  page?: number;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "mileage_asc";
  filters?: Record<string, string | number | undefined>;
  localized?: boolean;
};

export type PublicCatalogPage = {
  items: CarListing[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  paginationSource: "xano" | "compatibility_slice";
};

export type LocalizedSeoTaxonomyPageRequest = {
  locale: Locale;
  type: string;
  slug: string;
  parentSlug?: string;
  page?: number;
  limit?: number;
};

export type LocalizedSeoCatalogPageRequest = {
  locale: Locale;
  page?: number;
  limit?: number;
};

export type LocalizedSeoListingSitemapShardRequest = {
  locale: Locale;
  page: number;
  limit: number;
  generation?: string;
};

function readPaginationTotal(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  const meta = source.meta && typeof source.meta === "object" ? source.meta as Record<string, unknown> : {};
  const candidate = Number(source.total ?? source.itemsTotal ?? meta.total);
  return Number.isInteger(candidate) && candidate >= 0 ? candidate : null;
}

export async function getApprovedCarsPage(options: PublicCatalogPageOptions = {}): Promise<PublicCatalogPage> {
  if (!isXanoConfigured(API_URL)) throw new XanoPublicApiError("Xano public API is not configured", 503);
  const locale = options.locale || DEFAULT_LOCALE;
  const contentLocale = options.localized ? locale : resolveBackendLocale(locale);
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(24, Math.max(1, Math.floor(Number(options.limit) || 24)));
  const params = new URLSearchParams({ lang: contentLocale, page: String(page), limit: String(limit), sort: options.sort || "newest" });
  Object.entries(options.filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const route = options.localized ? API_ROUTES.localizedCars : API_ROUTES.cars;
  const payload = await fetchPublicJson(`${route}?${params.toString()}`);
  const normalized = sortPromotedCars(applyListingTranslations(normalizePublicCarList(payload), contentLocale));
  const explicitTotal = readPaginationTotal(payload);
  const items = explicitTotal === null ? normalized.slice((page - 1) * limit, page * limit) : normalized.slice(0, limit);
  const total = explicitTotal ?? normalized.length;
  return {
    items,
    page,
    limit,
    total,
    hasNext: page * limit < total,
    paginationSource: explicitTotal === null ? "compatibility_slice" : "xano",
  };
}

/**
 * Additive bounded SEO contract. The response is deliberately returned as
 * unknown and validated by src/lib/seo/taxonomyApi.ts before it can affect
 * canonical, robots or sitemap decisions.
 */
export async function getLocalizedSeoTaxonomyPagePayload(
  options: LocalizedSeoTaxonomyPageRequest,
): Promise<unknown> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(24, Math.max(1, Math.floor(Number(options.limit) || 24)));
  const params = new URLSearchParams({
    lang: options.locale,
    page: String(page),
    limit: String(limit),
  });
  if (options.parentSlug) params.set("parent_slug", options.parentSlug);
  return fetchPublicJson(
    `${API_ROUTES.localizedTaxonomyPage(options.type, options.slug)}?${params.toString()}`,
  );
}

export async function getLocalizedSeoTaxonomyCountsPayload(
  locale: Locale,
  options: { page?: number; limit?: number } = {},
): Promise<unknown> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(500, Math.max(1, Math.floor(Number(options.limit) || 500)));
  const params = new URLSearchParams({ lang: locale, page: String(page), limit: String(limit) });
  return fetchPublicJson(`${API_ROUTES.localizedTaxonomyCounts}?${params.toString()}`);
}

export async function getLocalizedSeoCatalogPagePayload(
  options: LocalizedSeoCatalogPageRequest,
): Promise<unknown> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(24, Math.max(1, Math.floor(Number(options.limit) || 24)));
  const params = new URLSearchParams({ lang: options.locale, page: String(page), limit: String(limit) });
  return fetchPublicJson(`${API_ROUTES.localizedCatalogPage}?${params.toString()}`);
}

export async function getSeoSitemapManifestPayload(): Promise<unknown> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }
  return fetchPublicJson(API_ROUTES.seoSitemapManifest);
}

export async function getLocalizedSeoListingSitemapShardPayload(
  options: LocalizedSeoListingSitemapShardRequest,
): Promise<unknown> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }
  const page = Math.max(1, Math.floor(Number(options.page) || 1));
  const limit = Math.min(10_000, Math.max(1, Math.floor(Number(options.limit) || 10_000)));
  const params = new URLSearchParams({
    lang: options.locale,
    page: String(page),
    limit: String(limit),
  });
  if (options.generation) params.set("generation", options.generation);
  return fetchPublicJson(`${API_ROUTES.localizedListingSitemapShard}?${params.toString()}`);
}

export async function getApprovedCars(locale?: Locale, options?: ApprovedCarsOptions): Promise<CarListing[]>;
export async function getApprovedCars(options?: ApprovedCarsOptions): Promise<CarListing[]>;
export async function getApprovedCars(
  localeOrOptions: Locale | ApprovedCarsOptions = {},
  explicitOptions: ApprovedCarsOptions = {},
): Promise<CarListing[]> {
  const options = typeof localeOrOptions === "string"
    ? { ...explicitOptions, locale: localeOrOptions }
    : localeOrOptions;
  if (!isXanoConfigured(API_URL)) {
    if (options.requireConfigured) {
      throw new XanoPublicApiError("Xano public API is not configured", 503);
    }
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return [];
  }

  const locale = resolveBackendLocale(options.locale || DEFAULT_LOCALE);
  const cached = catalogCache.get(locale);
  const now = Date.now();
  if (cached?.freshUntil && cached.freshUntil > now) return [...cached.cars];
  if (cached?.staleUntil && cached.staleUntil > now) {
    void loadApprovedCatalog(locale).catch(() => {});
    return [...cached.cars];
  }
  return [...await loadApprovedCatalog(locale)];
}

export async function getCarBySlug(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CarListing | null> {
  if (!isXanoConfigured(API_URL)) {
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return null;
  }

  const contentLocale = resolveBackendLocale(locale);
  const payload = await fetchPublicJson(withLocale(API_ROUTES.carBySlug(slug), contentLocale));
  const listing = payload ? normalizePublicCarListing(payload) : null;
  return listing ? applyListingTranslation(listing, contentLocale) : null;
}

export async function getLocalizedApprovedCars(locale: Locale): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }

  const cached = localizedCatalogCache.get(locale);
  const now = Date.now();
  if (cached?.freshUntil && cached.freshUntil > now) return [...cached.cars];
  if (cached?.staleUntil && cached.staleUntil > now) {
    void loadLocalizedApprovedCatalog(locale).catch(() => {});
    return [...cached.cars];
  }
  return [...await loadLocalizedApprovedCatalog(locale)];
}

export async function getLocalizedCarBySlug(slug: string, locale: Locale): Promise<CarListing | null> {
  if (!isXanoConfigured(API_URL)) {
    throw new XanoPublicApiError("Xano public API is not configured", 503);
  }

  const payload = await fetchPublicJson(withLocale(API_ROUTES.localizedCarBySlug(slug), locale));
  const listing = payload ? normalizePublicCarListing(payload) : null;
  return listing ? applyListingTranslation(listing, locale) : null;
}

export async function getSellerListingsBySlug(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) return [];

  const contentLocale = resolveBackendLocale(locale);

  return queueSellerListingsRequest(async () => {
    const url = buildApiUrl(withLocale(API_ROUTES.carSellerListings(slug), contentLocale), API_URL);
    let response: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(url);
      if (response.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (!response) throw new Error("Failed to fetch seller listings");
    if (response.status === 404) return [];
    if (!response.ok) throw new Error("Failed to fetch seller listings");

    return normalizeLimitedPublicCards(await response.json(), contentLocale);
  });
}

export async function getRelatedCarsBySlug(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) return [];

  const contentLocale = resolveBackendLocale(locale);
  const payload = await fetchPublicJson(withLocale(API_ROUTES.carRelated(slug), contentLocale));
  if (!Array.isArray(payload)) return [];

  const publicPayload = payload.map((item) => (
    item && typeof item === "object"
      ? { ...item, status: "approved", moderation_status: "approved" }
      : item
  ));

  return applyListingTranslations(normalizePublicCarList(publicPayload), contentLocale).slice(0, 6);
}

export const getRelatedListingsBySlug = getRelatedCarsBySlug;

export async function createCarListing(formData: FormData, authToken?: string): Promise<CarListing> {
  if (!isXanoConfigured(API_URL)) {
    throw new Error("PUBLIC_XANO_API_URL is not configured");
  }

  const response = await fetch(buildApiUrl(API_ROUTES.cars, API_URL), {
    method: "POST",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to create car listing");
  }

  return response.json();
}

export async function submitCarForReview(id: number, authToken?: string): Promise<CarListing> {
  if (!isXanoConfigured(API_URL)) {
    throw new Error("PUBLIC_XANO_API_URL is not configured");
  }

  const response = await fetch(buildApiUrl(API_ROUTES.carSubmit(id), API_URL), {
    method: "PATCH",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });

  if (!response.ok) {
    throw new Error("Failed to submit car listing");
  }

  return response.json();
}
