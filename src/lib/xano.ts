import type { CarListing } from "./types";
import { parseOptionalScore } from "./aiScores";
import { sortPromotedCars } from "./monetization";
import { API_ROUTES, buildApiUrl, getXanoApiUrl, isXanoConfigured } from "./apiRoutes";
import { fetchWithRetry } from "./http/fetchWithRetry";
import { normalizePublicCarList, normalizePublicCarListing } from "./publicCar";
import { withLocale } from "../i18n/routes";

const API_URL = getXanoApiUrl();
const PUBLIC_API_TIMEOUT_MS = 8_000;
let sellerListingsQueue: Promise<void> = Promise.resolve();

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
    response = await fetchWithRetry(buildApiUrl(path, API_URL), {
      headers: { Accept: "application/json" },
    }, {
      attempts: 3,
      timeoutMs: PUBLIC_API_TIMEOUT_MS,
      delaysMs: [1_000, 3_000],
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

const queueSellerListingsRequest = <T>(request: () => Promise<T>) => {
  const result = sellerListingsQueue.then(request, request);
  sellerListingsQueue = result.then(() => undefined, () => undefined);
  return result;
};

const normalizeLimitedPublicCards = (payload: unknown): CarListing[] => {
  if (!Array.isArray(payload)) return [];

  return payload.slice(0, 6).flatMap((item): CarListing[] => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const slugValue = String(source.slug || "").trim();
    const title = String(source.title || "").trim();
    if (!slugValue || !title) return [];

    return [{
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
      status: "approved",
      moderation_status: "approved",
      moderator_approved: true,
    }];
  });
};

type ApprovedCarsOptions = { requireConfigured?: boolean; locale?: string };

export async function getApprovedCars(locale?: string, options?: ApprovedCarsOptions): Promise<CarListing[]>;
export async function getApprovedCars(options?: ApprovedCarsOptions): Promise<CarListing[]>;
export async function getApprovedCars(
  localeOrOptions: string | ApprovedCarsOptions = {},
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

  const path = options.locale ? withLocale(API_ROUTES.localizedCars, options.locale) : API_ROUTES.cars;
  const payload = await fetchPublicJson(path);
  return sortPromotedCars(normalizePublicCarList(payload));
}

export async function getCarBySlug(slug: string, locale?: string): Promise<CarListing | null> {
  if (!isXanoConfigured(API_URL)) {
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return null;
  }

  const route = locale ? API_ROUTES.localizedCarBySlug(slug) : API_ROUTES.carBySlug(slug);
  const payload = await fetchPublicJson(locale ? withLocale(route, locale) : route);
  return payload ? normalizePublicCarListing(payload) : null;
}

export async function getSellerListingsBySlug(slug: string, locale?: string): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) return [];

  return queueSellerListingsRequest(async () => {
    const route = API_ROUTES.carSellerListings(slug);
    const url = buildApiUrl(locale ? withLocale(route, locale) : route, API_URL);
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

    return normalizeLimitedPublicCards(await response.json());
  });
}

export async function getRelatedListingsBySlug(slug: string, locale?: string): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) return [];

  const payload = locale
    ? await fetchPublicJson(withLocale(API_ROUTES.carRelatedListings(slug), locale))
    : await fetchPublicJson(API_ROUTES.carRelatedListings(slug));
  return normalizeLimitedPublicCards(payload);
}

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
