import { normalizeLocale } from "../i18n/locale.ts";
import { type Locale } from "../i18n/locales.ts";
import { sanitizePublicDescription } from "./listingFields.ts";
import type {
  CarListing,
  CarListingTranslation,
  ListingTranslatableContent,
  ListingTranslationStatus,
} from "./types.ts";

const translationStatuses: readonly ListingTranslationStatus[] = [
  "completed",
  "processing",
  "failed",
  "missing",
  "stale",
];

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const toText = (value: unknown) => typeof value === "string" ? value.trim() : "";

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const text = toText(item);
      return text ? [text] : [];
    });
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return toStringArray(JSON.parse(value));
    } catch {
      return [value.trim()];
    }
  }

  return [];
};

const supportedLocale = (value: unknown): Locale | null => {
  return normalizeLocale(toText(value), { activeOnly: true });
};

const translatedContentFrom = (source: Record<string, unknown>): ListingTranslatableContent => {
  const nested = toRecord(source.content) || toRecord(source.fields) || source;
  return {
    title: toText(nested.title) || undefined,
    description: toText(nested.description) || undefined,
    city: toText(nested.city) || undefined,
    seo_title: toText(nested.seo_title) || undefined,
    seo_description: toText(nested.seo_description) || undefined,
    image_alt_texts: toStringArray(nested.image_alt_texts),
    ai_highlights: toStringArray(nested.ai_highlights),
    ai_recommendations: toStringArray(nested.ai_recommendations),
    ai_warnings: toStringArray(nested.ai_warnings),
  };
};

export function normalizeListingTranslation(payload: unknown): CarListingTranslation | null {
  const source = toRecord(payload);
  if (!source) return null;

  const locale = supportedLocale(source.locale || source.target_locale || source.language);
  if (!locale) return null;

  const rawStatus = toText(source.status).toLowerCase();
  const status = translationStatuses.includes(rawStatus as ListingTranslationStatus)
    ? rawStatus as ListingTranslationStatus
    : "missing";

  return {
    id: Number(source.id) > 0 ? Number(source.id) : undefined,
    locale,
    requested_locale: supportedLocale(source.requested_locale) || undefined,
    resolved_locale: supportedLocale(source.resolved_locale) || undefined,
    source_locale: supportedLocale(source.source_locale) || undefined,
    source_hash: toText(source.source_hash) || undefined,
    resolved_source_hash: toText(source.resolved_source_hash) || undefined,
    status,
    translation_status: ["source", "translated", "unavailable", "stale", "pending", "failed"].includes(toText(source.translation_status))
      ? toText(source.translation_status) as CarListingTranslation["translation_status"]
      : undefined,
    readiness: toText(source.readiness) === "ready" ? "ready" : undefined,
    translation_version: Number.isInteger(Number(source.translation_version)) && Number(source.translation_version) >= 0
      ? Number(source.translation_version)
      : undefined,
    is_fallback: source.is_fallback === true,
    updated_at: typeof source.updated_at === "string" || typeof source.updated_at === "number"
      ? source.updated_at
      : undefined,
    ...translatedContentFrom(source),
  };
}

const originalContentFrom = (listing: CarListing): ListingTranslatableContent => ({
  title: listing.title,
  description: listing.description,
  city: listing.city,
  seo_title: listing.seo_title,
  seo_description: listing.seo_description,
  image_alt_texts: toStringArray(listing.image_alt_texts),
  ai_highlights: toStringArray(listing.ai_highlights),
  ai_recommendations: toStringArray(listing.ai_recommendations),
  ai_warnings: toStringArray(listing.ai_warnings),
});

export function applyListingTranslation(listing: CarListing, requestedLocale: Locale): CarListing {
  const sourceLocale = supportedLocale(listing.source_locale) || "ru";
  const originalContent = listing.original_content || originalContentFrom(listing);
  const translation = normalizeListingTranslation(listing.translation);
  const canApply = requestedLocale !== sourceLocale
    && translation?.status === "completed"
    && translation.locale === requestedLocale;

  if (!canApply) {
    return {
      ...listing,
      original_content: originalContent,
      translation_meta: {
        requested_locale: requestedLocale,
        content_locale: sourceLocale,
        source_locale: sourceLocale,
        fallback_locale: requestedLocale === sourceLocale ? undefined : sourceLocale,
        status: requestedLocale === sourceLocale ? "completed" : translation?.status || "missing",
        used_fallback: requestedLocale !== sourceLocale,
      },
    };
  }

  const translatedDescription = sanitizePublicDescription(translation.description);
  return {
    ...listing,
    title: translation.title || listing.title,
    description: translatedDescription || listing.description,
    city: translation.city || listing.city,
    seo_title: translation.seo_title || listing.seo_title,
    seo_description: translation.seo_description || listing.seo_description,
    image_alt_texts: translation.image_alt_texts?.length ? translation.image_alt_texts : listing.image_alt_texts,
    ai_highlights: translation.ai_highlights?.length ? translation.ai_highlights : listing.ai_highlights,
    ai_recommendations: translation.ai_recommendations?.length ? translation.ai_recommendations : listing.ai_recommendations,
    ai_warnings: translation.ai_warnings?.length ? translation.ai_warnings : listing.ai_warnings,
    original_content: originalContent,
    translation_meta: {
      requested_locale: requestedLocale,
      content_locale: requestedLocale,
      source_locale: sourceLocale,
      status: "completed",
      used_fallback: false,
    },
  };
}

export const applyListingTranslations = (listings: CarListing[], locale: Locale) =>
  listings.map((listing) => applyListingTranslation(listing, locale));
