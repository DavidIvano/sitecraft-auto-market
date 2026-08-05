import { getStoredAiScores } from "./aiScores.ts";
import { maskVin, sanitizePublicDescription } from "./listingFields.ts";
import { isPublicListing } from "./listingStatus.ts";
import { normalizeListingTranslation } from "./listingTranslation.ts";
import type { CarListing, CarListingImage, PublicSellerSummary } from "./types.ts";

const PUBLIC_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/i;

const toRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const toString = (value: unknown) => String(value ?? "").trim();

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalDate = (value: unknown): string | number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = toString(value);
  return text ? text : undefined;
};

const toOptionalBoolean = (value: unknown): boolean | null | undefined => {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  if (value === null) return null;
  return undefined;
};

export function isValidPublicCarSlug(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const slug = value.trim();
  return !["undefined", "null"].includes(slug.toLowerCase()) && PUBLIC_SLUG_PATTERN.test(slug);
}

export function normalizePublicImageUrl(value: unknown) {
  const url = toString(value);
  if (!url) return "";
  if (url.startsWith("/")) return url.startsWith("//") ? "" : url;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

const readImageUrl = (value: unknown): string => {
  if (typeof value === "string") return normalizePublicImageUrl(value);
  const source = toRecord(value);
  if (!source) return "";
  const optimized = toRecord(source.optimized);
  const variants = toRecord(source.variants);
  const detail = toRecord(variants?.detail);
  return [
    detail?.url,
    optimized?.url,
    source.url,
    source.public_url,
    source.image_url,
    source.src,
    source.path,
  ].map(normalizePublicImageUrl).find(Boolean) || "";
};

const parseImageUrlList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(readImageUrl).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return parseImageUrlList(JSON.parse(value));
  } catch {
    const url = normalizePublicImageUrl(value);
    return url ? [url] : [];
  }
};

const normalizeImageRows = (source: Record<string, unknown>): CarListingImage[] => {
  const rows = Array.isArray(source.images)
    ? source.images
    : Array.isArray(source.car_listing_images)
      ? source.car_listing_images
      : [];

  return rows.flatMap((value, index): CarListingImage[] => {
    const row = toRecord(value);
    if (!row) return [];
    const image = toRecord(row.image);
    const imageMetadata = toRecord(row.image_metadata);
    const imageUrl = [row.image_url, image?.url, imageMetadata].map(readImageUrl).find(Boolean) || "";
    if (!imageUrl) return [];

    return [{
      id: toNumber(row.id) || index + 1,
      car_listing_id: toNumber(row.car_listing_id || source.id),
      image_url: imageUrl,
      image_key: toString(row.image_key) || undefined,
      mime_type: toString(row.mime_type) || undefined,
      original_filename: toString(row.original_filename) || undefined,
      size_bytes: toNumber(row.size_bytes) || undefined,
      image_metadata: imageMetadata || undefined,
      sort_order: toNumber(row.sort_order) || index,
      is_main: row.is_main === true,
      is_primary: row.is_primary === true,
      is_deleted: row.is_deleted === true,
      created_at: toOptionalDate(row.created_at),
    }];
  });
};

const normalizeSeller = (value: unknown): PublicSellerSummary | undefined => {
  const source = toRecord(value);
  if (!source) return undefined;
  const contact = toRecord(source.contact);
  const href = toString(contact?.href);
  const type = contact?.type === "phone" ? "phone" : contact?.type === "email" ? "email" : null;
  const safeHref = type && /^(tel:|mailto:)/i.test(href) ? href : "";
  const phoneHref = /^tel:/i.test(toString(contact?.phone_href)) ? toString(contact?.phone_href) : "";
  const emailHref = /^mailto:/i.test(toString(contact?.email_href)) ? toString(contact?.email_href) : "";

  return {
    name: toString(source.name) || "Продавец автомобиля",
    type: toString(source.type),
    city: toString(source.city),
    active_listings_count: toNumber(source.active_listings_count),
    contact: phoneHref || emailHref || (safeHref && type) ? {
      phone: phoneHref ? toString(contact?.phone) : null,
      phone_href: phoneHref || null,
      email: emailHref ? toString(contact?.email) : null,
      email_href: emailHref || null,
      preferred_method: ["phone", "email"].includes(toString(contact?.preferred_method))
        ? toString(contact?.preferred_method) as "phone" | "email"
        : null,
      ...(safeHref && type ? { type, href: safeHref } : {}),
    } : null,
  };
};

function unwrapListingPayload(payload: unknown) {
  let source = toRecord(payload);
  for (let depth = 0; source && depth < 3; depth += 1) {
    const nested = [source.data, source.result, source.item, source.car].map(toRecord).find(Boolean);
    if (!nested) break;
    source = nested;
  }
  return source;
}

export function normalizeCarListing(payload: unknown): CarListing | null {
  const source = unwrapListingPayload(payload);
  if (!source) return null;

  const slug = toString(source.slug);
  if (!isValidPublicCarSlug(slug)) return null;

  const brand = toString(source.brand);
  const model = toString(source.model);
  const title = toString(source.title) || [brand, model].filter(Boolean).join(" ");
  if (!title) return null;

  const status = toString(source.status) || "draft";
  const moderationStatus = toString(source.moderation_status);
  const images = normalizeImageRows(source);
  const imageUrls = [
    ...parseImageUrlList(source.image_urls),
    ...parseImageUrlList(source.images),
    ...parseImageUrlList(source.car_listing_images),
    ...images.map((image) => image.image_url || ""),
  ].filter(Boolean);
  const scores = getStoredAiScores(source);
  const rawVin = toString(source.vin);
  const seller = normalizeSeller(source.seller);
  const rawPromotion = toRecord(source.promotion);
  const translation = normalizeListingTranslation(source.translation || source.localized_translation);
  const promotionStatus = toString(rawPromotion?.status || source.promotion_status);
  const promotion: CarListing["promotion"] = rawPromotion ? {
    id: toNumber(rawPromotion.id) || undefined,
    plan_code: toString(rawPromotion.plan_code),
    promotion_type: toString(rawPromotion.promotion_type),
    placement: toString(rawPromotion.placement),
    status: promotionStatus as NonNullable<CarListing["promotion"]>["status"],
    priority: toNumber(rawPromotion.priority),
    starts_at: toOptionalDate(rawPromotion.starts_at),
    ends_at: toOptionalDate(rawPromotion.ends_at),
  } : undefined;

  const listing: CarListing = {
    id: toNumber(source.id),
    slug,
    title,
    brand,
    model,
    vehicle_type: toString(source.vehicle_type),
    body_type: toString(source.body_type),
    color: toString(source.color),
    condition: toString(source.condition),
    vehicle_condition: toString(source.vehicle_condition),
    year: toNumber(source.year),
    mileage: toNumber(source.mileage),
    fuel_type: toString(source.fuel_type),
    engine_volume: toString(source.engine_volume),
    transmission: toString(source.transmission),
    seats: toString(source.seats) || undefined,
    doors: toString(source.doors) || undefined,
    drivetrain: toString(source.drivetrain || source.drive_type),
    owner_count: toString(source.owner_count),
    owners_count: toString(source.owners_count || source.owner_count) || undefined,
    first_registration: toString(source.first_registration || source.registration_date),
    first_registration_date: toString(source.first_registration_date),
    tuv_hu: toString(source.tuv_hu),
    tuv_until: toString(source.tuv_until),
    hu_until: toString(source.hu_until),
    has_valid_tuv: toOptionalBoolean(source.has_valid_tuv),
    tuv_valid_until: toString(source.tuv_valid_until) || null,
    vin: "",
    vin_masked: toString(source.vin_masked) || maskVin(rawVin),
    price: toNumber(source.price),
    currency: toString(source.currency) || "EUR",
    city: toString(source.city),
    country: toString(source.country),
    seller_name: "",
    seller_phone: "",
    seller_email: "",
    description: sanitizePublicDescription(source.description),
    status: status as CarListing["status"],
    moderation_status: (moderationStatus || undefined) as CarListing["moderation_status"],
    sold_at: toOptionalDate(source.sold_at),
    deleted_at: toOptionalDate(source.deleted_at),
    boosted_at: toOptionalDate(source.boosted_at),
    boosted_until: toOptionalDate(source.boosted_until),
    featured_at: toOptionalDate(source.featured_at),
    featured_until: toOptionalDate(source.featured_until),
    homepage_at: toOptionalDate(source.homepage_at),
    homepage_until: toOptionalDate(source.homepage_until),
    last_promoted_at: toOptionalDate(source.last_promoted_at),
    published_at: toOptionalDate(source.published_at),
    promotion_status: (promotionStatus || undefined) as CarListing["promotion_status"],
    promotion_type: toString(source.promotion_type) || undefined,
    promotion_placement: toString(source.promotion_placement) || undefined,
    promotion_priority: toNumber(source.promotion_priority),
    promotion_started_at: toOptionalDate(source.promotion_started_at),
    promotion_ends_at: toOptionalDate(source.promotion_ends_at),
    promotion,
    moderator_approved: source.moderator_approved === true,
    seller_type: toString(source.seller_type) === "dealer" ? "dealer" : "private",
    seller,
    is_saved: source.is_saved === true,
    saved_at: toOptionalDate(source.saved_at),
    dealer_profile_id: toNumber(source.dealer_profile_id) || undefined,
    dealer_plan: toString(source.dealer_plan) as CarListing["dealer_plan"],
    dealer_verified: source.dealer_verified === true,
    is_ai_generated: source.is_ai_generated === true,
    ai_analysis: source.ai_analysis,
    ai_payload: source.ai_payload,
    ai_highlights: source.ai_highlights as CarListing["ai_highlights"],
    ai_listing_score: source.ai_listing_score as CarListing["ai_listing_score"],
    ai_recommendations: source.ai_recommendations as CarListing["ai_recommendations"],
    ai_warnings: source.ai_warnings as CarListing["ai_warnings"],
    ai_missing_fields: source.ai_missing_fields as CarListing["ai_missing_fields"],
    ai_confidence: source.ai_confidence as CarListing["ai_confidence"],
    ai_status: toString(source.ai_status),
    ai_scan_status: toString(source.ai_scan_status),
    ai_scan_score: source.ai_scan_score as CarListing["ai_scan_score"],
    ai_scan_badges: source.ai_scan_badges as CarListing["ai_scan_badges"],
    ai_scan_errors_json: source.ai_scan_errors_json,
    ai_scan_warnings_json: source.ai_scan_warnings_json,
    ai_scan_recommendations_json: source.ai_scan_recommendations_json,
    ai_scan_last_checked_at: toOptionalDate(source.ai_scan_last_checked_at),
    ai_scan_recommendation: toString(source.ai_scan_recommendation),
    listing_quality_score: scores.listingQualityScore ?? undefined,
    photo_quality_score: scores.photoQualityScore ?? undefined,
    trust_score: scores.trustScore ?? undefined,
    seo_title: toString(source.seo_title),
    seo_description: toString(source.seo_description),
    image_alt_texts: source.image_alt_texts as CarListing["image_alt_texts"],
    search_keywords: source.search_keywords as CarListing["search_keywords"],
    source_locale: toString(source.source_locale || source.content_locale) || "ru",
    translation,
    seller_rating: source.seller_rating as CarListing["seller_rating"],
    user_rating: source.user_rating as CarListing["user_rating"],
    main_image_url: readImageUrl(source.main_image_url),
    thumbnail_url: readImageUrl(source.thumbnail_url),
    primary_image_url: readImageUrl(source.primary_image_url),
    image_url: readImageUrl(source.image_url),
    cover_image_url: readImageUrl(source.cover_image_url),
    image_urls: [...new Set(imageUrls)],
    image_keys: source.image_keys as CarListing["image_keys"],
    images,
    created_at: toOptionalDate(source.created_at),
    updated_at: toOptionalDate(source.updated_at),
  };

  if (Array.isArray(source.seller_listings)) {
    listing.seller_listings = source.seller_listings
      .map(normalizeCarListing)
      .filter((item): item is CarListing => Boolean(item && isPublicListing(item)));
  }

  return listing;
}

export function normalizePublicCarListing(payload: unknown): CarListing | null {
  const listing = normalizeCarListing(payload);
  return listing && isPublicListing(listing) ? listing : null;
}

export function normalizePublicCarList(payload: unknown): CarListing[] {
  const source = toRecord(payload);
  const values = Array.isArray(payload)
    ? payload
    : [source?.items, source?.records, source?.data, source?.result].find(Array.isArray) || [];

  return values
    .map(normalizePublicCarListing)
    .filter((item): item is CarListing => Boolean(item));
}
