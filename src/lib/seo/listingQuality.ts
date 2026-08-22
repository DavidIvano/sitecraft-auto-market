import { getCarDetailImageUrls } from "../imageUrls.ts";
import type { CarListing } from "../types.ts";

export const SEO_QUALITY_RULES = Object.freeze({
  minimumTitleLength: 4,
  maximumTitleLength: 180,
  // A hard crawl gate must remain language-neutral: the same factual sentence
  // is materially shorter in Arabic or Ukrainian than in German. Longer copy
  // remains a recommendation, while genuinely empty/thin copy is rejected.
  minimumDescriptionLength: 18,
  recommendedDescriptionLength: 160,
  maximumDescriptionLength: 20_000,
  minimumImageCount: 1,
});

export type ListingSeoQualityCode =
  | "missing_slug"
  | "missing_vehicle_identity"
  | "invalid_year"
  | "invalid_price"
  | "missing_location"
  | "title_too_short"
  | "title_too_long"
  | "description_too_short"
  | "description_too_long"
  | "missing_https_photo"
  | "description_below_recommended_length";

export type ListingSeoQualityResult = Readonly<{
  eligible: boolean;
  score: number;
  failures: ListingSeoQualityCode[];
  warnings: ListingSeoQualityCode[];
  imageCount: number;
  titleLength: number;
  descriptionLength: number;
}>;

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const isHttpsImage = (value: unknown) => {
  try {
    const url = new URL(clean(value));
    return url.protocol === "https:" && !/deal-finder-placeholder\.svg$/i.test(url.pathname);
  } catch {
    return false;
  }
};

/**
 * Crawl eligibility is deliberately deterministic and provider-free. The
 * Xano materializer and the frontend parity audit use the same thresholds so
 * a weak or photo-less listing cannot enter a sitemap by accident.
 */
export function evaluateListingSeoQuality(listing: Partial<CarListing>): ListingSeoQualityResult {
  const title = clean(listing.title);
  const description = clean(listing.description);
  const images = getCarDetailImageUrls(listing as CarListing).filter(isHttpsImage);
  const failures: ListingSeoQualityCode[] = [];
  const warnings: ListingSeoQualityCode[] = [];

  if (!clean(listing.slug)) failures.push("missing_slug");
  if (!clean(listing.brand) || !clean(listing.model)) failures.push("missing_vehicle_identity");
  if (!Number.isInteger(Number(listing.year)) || Number(listing.year) < 1886 || Number(listing.year) > new Date().getUTCFullYear() + 1) failures.push("invalid_year");
  if (!Number.isFinite(Number(listing.price)) || Number(listing.price) <= 0) failures.push("invalid_price");
  if (!clean(listing.city) || !clean(listing.country)) failures.push("missing_location");
  if (title.length < SEO_QUALITY_RULES.minimumTitleLength) failures.push("title_too_short");
  if (title.length > SEO_QUALITY_RULES.maximumTitleLength) failures.push("title_too_long");
  if (description.length < SEO_QUALITY_RULES.minimumDescriptionLength) failures.push("description_too_short");
  if (description.length > SEO_QUALITY_RULES.maximumDescriptionLength) failures.push("description_too_long");
  if (images.length < SEO_QUALITY_RULES.minimumImageCount) failures.push("missing_https_photo");
  if (description.length >= SEO_QUALITY_RULES.minimumDescriptionLength && description.length < SEO_QUALITY_RULES.recommendedDescriptionLength) {
    warnings.push("description_below_recommended_length");
  }

  const score = Math.max(0, 100 - failures.length * 20 - warnings.length * 5);
  return {
    eligible: failures.length === 0,
    score,
    failures,
    warnings,
    imageCount: images.length,
    titleLength: title.length,
    descriptionLength: description.length,
  };
}
