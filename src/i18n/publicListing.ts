import { getCarDetailImageUrls } from "../lib/imageUrls.ts";
import { sanitizePublicDescription } from "../lib/listingFields.ts";
import type { CarListing } from "../lib/types.ts";
import { getCanonicalSeoCity } from "../lib/seo/locationSeo.ts";

export type PublicTranslationStatus = "source" | "translated" | "unavailable" | "stale" | "pending" | "failed";

export type PublicLocaleResolution = {
  requested_locale: string;
  source_locale: string;
  resolved_locale: string | null;
  translation_status: PublicTranslationStatus;
  translation_version: number;
  translations_ready: boolean;
  fallback_used: boolean;
  fallback_reason: string | null;
};

export type PublicListingDto = {
  id: number;
  slug: string;
  title: string;
  description: string;
  brand_id?: number | string;
  brand_slug?: string;
  brand: string;
  model_id?: number | string;
  model_slug?: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  currency: string;
  city_id?: number | string;
  city_slug?: string;
  city: string;
  region_id?: number | string;
  region_slug?: string;
  region?: string;
  postal_code?: string;
  country: string;
  fuel_type: string;
  transmission: string;
  body_type: string;
  color: string;
  image_urls: string[];
  created_at?: string | number;
  updated_at?: string | number;
  translation_updated_at?: string | number;
  available_locales: string[];
  locale_resolution: PublicLocaleResolution;
};

/** @deprecated Use PublicListingDto. */
export type GermanPublicListingDto = PublicListingDto;

const text = (value: unknown) => String(value ?? "").trim();
const positiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const mapStatus = (value: unknown): PublicTranslationStatus => {
  const status = text(value).toLowerCase();
  if (["source", "original"].includes(status)) return "source";
  if (["translated", "reviewed", "machine_translated", "completed"].includes(status)) return "translated";
  if (["stale", "outdated"].includes(status)) return "stale";
  if (["pending", "processing", "queued"].includes(status)) return "pending";
  if (["failed", "error"].includes(status)) return "failed";
  return "unavailable";
};

export function resolvePublicListingLocale(
  listing: CarListing,
  requestedLocale = "de",
): PublicLocaleResolution {
  const translation = listing.translation as (Record<string, unknown> & { status?: unknown }) | undefined;
  const requested = text(translation?.requested_locale) || requestedLocale;
  const sourceLocale = text(translation?.source_locale) || text(listing.source_locale) || "unknown";
  const resolvedLocale = text(translation?.resolved_locale)
    || (mapStatus(translation?.translation_status ?? translation?.status) === "translated" ? text(translation?.locale) : "")
    || (sourceLocale === requested ? sourceLocale : "");
  const listingVersion = positiveInteger((listing as CarListing & { translation_version?: unknown }).translation_version);
  const resolvedVersion = positiveInteger(translation?.translation_version ?? listingVersion);
  const sourceHash = text(translation?.source_hash);
  const resolvedSourceHash = text(translation?.resolved_source_hash ?? translation?.source_hash);
  const rawReady = (listing as CarListing & { translations_ready?: unknown }).translations_ready === true
    || text(translation?.readiness) === "ready";
  let translationStatus = mapStatus(translation?.translation_status ?? translation?.status);

  if (sourceLocale === requested && resolvedLocale === requested && translationStatus === "unavailable") {
    translationStatus = "source";
  }
  if (translationStatus === "translated" && listingVersion > 0 && resolvedVersion !== listingVersion) {
    translationStatus = "stale";
  }

  const validSource = translationStatus === "source" && sourceLocale === requested && resolvedLocale === requested;
  const validTranslation = translationStatus === "translated"
    && resolvedLocale === requested
    && rawReady
    && (listingVersion === 0 || resolvedVersion === listingVersion)
    && (!sourceHash || !resolvedSourceHash || sourceHash === resolvedSourceHash);
  const available = validSource || validTranslation;
  const fallbackUsed = translation?.is_fallback === true || Boolean(resolvedLocale && resolvedLocale !== requested);

  return {
    requested_locale: requested,
    source_locale: sourceLocale,
    resolved_locale: available ? resolvedLocale : (resolvedLocale || null),
    translation_status: available ? translationStatus : translationStatus === "source" ? "unavailable" : translationStatus,
    translation_version: listingVersion,
    translations_ready: validSource || validTranslation,
    fallback_used: fallbackUsed,
    fallback_reason: fallbackUsed
      ? "resolved_locale_differs_from_requested_locale"
      : available
        ? null
        : `translation_${translationStatus}`,
  };
}

export function toPublicListingForLocale(listing: CarListing, requestedLocale: string): PublicListingDto | null {
  const resolution = resolvePublicListingLocale(listing, requestedLocale);
  const title = text(listing.title);
  const description = sanitizePublicDescription(listing.description).trim();

  if (resolution.requested_locale !== requestedLocale
    || resolution.resolved_locale !== requestedLocale
    || resolution.fallback_used
    || !["source", "translated"].includes(resolution.translation_status)
    || !resolution.translations_ready
    || !title
    || !description) {
    return null;
  }

  return {
    id: Number(listing.id) || 0,
    slug: text(listing.slug),
    title,
    description,
    brand_id: listing.brand_id,
    brand_slug: text(listing.brand_slug) || undefined,
    brand: text(listing.brand),
    model_id: listing.model_id,
    model_slug: text(listing.model_slug) || undefined,
    model: text(listing.model),
    year: Number(listing.year) || 0,
    mileage: Number(listing.mileage) || 0,
    price: Number(listing.price) || 0,
    currency: /^[A-Z]{3}$/.test(text(listing.currency).toUpperCase()) ? text(listing.currency).toUpperCase() : "EUR",
    city_id: listing.city_id,
    city_slug: text(listing.city_slug) || undefined,
    city: getCanonicalSeoCity(listing.city),
    region_id: listing.region_id,
    region_slug: text(listing.region_slug) || undefined,
    region: text(listing.region) || undefined,
    postal_code: text(listing.postal_code) || undefined,
    country: text(listing.country),
    fuel_type: text(listing.fuel_type),
    transmission: text(listing.transmission),
    body_type: text(listing.body_type),
    color: text(listing.color),
    image_urls: getCarDetailImageUrls(listing).slice(0, 8),
    created_at: listing.created_at,
    updated_at: listing.updated_at,
    translation_updated_at: listing.translation && "updated_at" in listing.translation
      ? listing.translation.updated_at as string | number | undefined
      : undefined,
    available_locales: Array.isArray(listing.available_locales)
      ? [...new Set(listing.available_locales.map(text).filter(Boolean))]
      : [requestedLocale],
    locale_resolution: resolution,
  };
}

export function projectCatalogForLocale(listings: CarListing[], requestedLocale: string) {
  return listings.flatMap((listing) => {
    const projected = toPublicListingForLocale(listing, requestedLocale);
    return projected ? [projected] : [];
  });
}

/** @deprecated Compatibility wrapper for the Release 3 German route. */
export function toGermanPublicListing(listing: CarListing): GermanPublicListingDto | null {
  return toPublicListingForLocale(listing, "de");
}

/** @deprecated Compatibility wrapper for the Release 3 German route. */
export function projectGermanCatalog(listings: CarListing[]) {
  return projectCatalogForLocale(listings, "de");
}
