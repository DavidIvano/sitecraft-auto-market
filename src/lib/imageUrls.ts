import type { CarListing, CarListingImage } from "./types";

function normalizeUrl(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const url = value.trim();

  if (!url) {
    return "";
  }

  return url.startsWith("http") || url.startsWith("/") ? url : "";
}

function getMetadataUrl(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const metadata = value as Record<string, unknown>;
  const optimized = metadata.optimized && typeof metadata.optimized === "object"
    ? (metadata.optimized as Record<string, unknown>)
    : {};
  const variants = metadata.variants && typeof metadata.variants === "object"
    ? (metadata.variants as Record<string, unknown>)
    : {};
  const detail = variants.detail && typeof variants.detail === "object" ? (variants.detail as Record<string, unknown>) : {};
  const candidates = [
    detail.url,
    optimized.url,
    metadata.url,
    metadata.public_url,
    metadata.image_url,
    metadata.src,
    metadata.path,
  ];
  const url = candidates.find((candidate) => typeof candidate === "string" && candidate.length > 0);

  return normalizeUrl(url);
}

function getMetadataVariantUrl(value: unknown, variant: "thumb" | "card" | "detail"): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const metadata = value as Record<string, unknown>;
  const variants = metadata.variants && typeof metadata.variants === "object"
    ? (metadata.variants as Record<string, unknown>)
    : {};
  const variantData = variants[variant] && typeof variants[variant] === "object"
    ? (variants[variant] as Record<string, unknown>)
    : {};
  const optimized = metadata.optimized && typeof metadata.optimized === "object"
    ? (metadata.optimized as Record<string, unknown>)
    : {};

  return normalizeUrl(variantData.url) || normalizeUrl(optimized.url) || getMetadataUrl(value);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parseStringArray(parsed);
    } catch {
      return normalizeUrl(value) ? [normalizeUrl(value)] : [];
    }
  }

  return [];
}

function sortImageRows(images: CarListingImage[]) {
  return [...images]
    .filter((image) => !image.is_deleted)
    .sort((left, right) => {
      const leftPrimary = left.is_primary || left.is_main ? 0 : 1;
      const rightPrimary = right.is_primary || right.is_main ? 0 : 1;

      if (leftPrimary !== rightPrimary) {
        return leftPrimary - rightPrimary;
      }

      return Number(left.sort_order ?? 999) - Number(right.sort_order ?? 999);
    });
}

export function getListingImages(car: Partial<CarListing>) {
  return sortImageRows(car.images ?? [])
    .map((image) => ({
      ...image,
      image_url: normalizeUrl(image.image_url) || normalizeUrl(image.image?.url) || getMetadataUrl(image.image_metadata),
    }))
    .filter((image) => Boolean(image.image_url));
}

export function getCarImageUrls(car: Partial<CarListing>) {
  const fromImageUrls = parseStringArray(car.image_urls);
  const fromRows = getListingImages(car)
    .map((image) => image.image_url)
    .filter((value): value is string => Boolean(value));
  const candidates = [
    normalizeUrl(car.cover_image_url),
    normalizeUrl(car.main_image_url),
    ...fromImageUrls,
    ...fromRows,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function getCarCoverImageUrl(car: Partial<CarListing>) {
  return getCarImageUrls(car)[0] || "";
}

export function getCarCardImageUrl(car: Partial<CarListing>) {
  const row = getListingImages(car)[0];
  const variantUrl = row ? getMetadataVariantUrl(row.image_metadata, "card") || getMetadataVariantUrl(row.image_metadata, "thumb") : "";

  return variantUrl || getCarCoverImageUrl(car);
}

export function getCarDetailImageUrls(car: Partial<CarListing>) {
  const rowUrls = getListingImages(car)
    .map((image) => getMetadataVariantUrl(image.image_metadata, "detail") || image.image_url)
    .filter((value): value is string => Boolean(value));
  const legacyUrls = getCarImageUrls(car);

  return [...new Set([...rowUrls, ...legacyUrls])];
}

export const getMainListingImageUrl = getCarCoverImageUrl;
