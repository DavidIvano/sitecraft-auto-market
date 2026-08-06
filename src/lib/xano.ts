import type { CarListing } from "./types";
import { parseOptionalScore } from "./aiScores";
import { sortPromotedCars } from "./monetization";
import { API_ROUTES, buildApiUrl, getXanoApiUrl, isXanoConfigured } from "./apiRoutes";
import { normalizePublicCarList, normalizePublicCarListing } from "./publicCar";
import { applyListingTranslation, applyListingTranslations, normalizeListingTranslation } from "./listingTranslation.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locales.ts";

const API_URL = getXanoApiUrl();
const PUBLIC_API_TIMEOUT_MS = 8_000;
const PUBLIC_API_RATE_LIMIT_RETRY_MS = 5_000;
const PUBLIC_API_RATE_LIMIT_ATTEMPTS = 5;
let sellerListingsQueue: Promise<void> = Promise.resolve();

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
  let response: Response | null = null;
  for (let attempt = 0; attempt < PUBLIC_API_RATE_LIMIT_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(buildApiUrl(path, API_URL), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(PUBLIC_API_TIMEOUT_MS),
      });
    } catch (error) {
      throw new XanoPublicApiError(
        error instanceof Error && error.name === "TimeoutError"
          ? "Xano public API timed out"
          : "Xano public API is unavailable",
        503,
      );
    }

    if (response.status !== 429 || attempt === PUBLIC_API_RATE_LIMIT_ATTEMPTS - 1) break;
    await new Promise((resolve) => setTimeout(resolve, PUBLIC_API_RATE_LIMIT_RETRY_MS));
  }

  if (!response) throw new XanoPublicApiError("Xano public API is unavailable", 503);
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

export async function getApprovedCars(locale: Locale = DEFAULT_LOCALE): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) {
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return [];
  }

  const payload = await fetchPublicJson(withLocale(API_ROUTES.cars, locale));
  return sortPromotedCars(applyListingTranslations(normalizePublicCarList(payload), locale));
}

export async function getCarBySlug(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CarListing | null> {
  if (!isXanoConfigured(API_URL)) {
    console.warn("PUBLIC_XANO_API_URL is not configured");
    return null;
  }

  const payload = await fetchPublicJson(withLocale(API_ROUTES.carBySlug(slug), locale));
  const listing = payload ? normalizePublicCarListing(payload) : null;
  return listing ? applyListingTranslation(listing, locale) : null;
}

export async function getSellerListingsBySlug(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) return [];

  return queueSellerListingsRequest(async () => {
    const url = buildApiUrl(withLocale(API_ROUTES.carSellerListings(slug), locale), API_URL);
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

    const cars = await response.json();
    if (!Array.isArray(cars)) return [];

    return cars.slice(0, 6).flatMap((item): CarListing[] => {
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
  });
}

export async function getRelatedCarsBySlug(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<CarListing[]> {
  if (!isXanoConfigured(API_URL)) return [];

  const payload = await fetchPublicJson(withLocale(API_ROUTES.carRelated(slug), locale));
  if (!Array.isArray(payload)) return [];

  const publicPayload = payload.map((item) => (
    item && typeof item === "object"
      ? { ...item, status: "approved", moderation_status: "approved" }
      : item
  ));

  return applyListingTranslations(normalizePublicCarList(publicPayload), locale).slice(0, 6);
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
