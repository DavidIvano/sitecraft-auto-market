import type { CarListing, CarListingImage } from "./types.ts";
import { isPublicListing, normalizeListingStatus } from "./listingStatus.ts";

export const DASHBOARD_LISTING_PLACEHOLDER = "/sitecraft-logo.png";

export type DashboardListing = Partial<CarListing> & {
  id: number;
  thumbnail_url?: string;
  primary_image_url?: string;
  image_url?: string;
  images?: Array<Partial<CarListingImage> & { url?: string }>;
};

const isLocalHostname = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".localhost");

export function getSafeDashboardImageUrl(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !isLocalHostname(url.hostname.toLowerCase()) ? url.toString() : "";
  } catch {
    return "";
  }
}

function getImageUrl(image: Partial<CarListingImage> & { url?: string }) {
  if (!image) {
    return "";
  }

  return getSafeDashboardImageUrl(image.image_url || image.url || image.image?.url || image.image?.path);
}

export function getDashboardListingThumbnail(listing: DashboardListing) {
  const directCandidates = [
    listing.thumbnail_url,
    listing.primary_image_url,
    listing.main_image_url,
    listing.image_url,
  ];

  for (const candidate of directCandidates) {
    const safeUrl = getSafeDashboardImageUrl(candidate);
    if (safeUrl) {
      return { url: safeUrl, isPlaceholder: false };
    }
  }

  const images = (listing.images || [])
    .filter((image) => image && image.is_deleted !== true && getImageUrl(image))
    .sort((left, right) => {
      const mainDifference = Number(Boolean(right.is_main)) - Number(Boolean(left.is_main));
      if (mainDifference) return mainDifference;

      const primaryDifference = Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary));
      if (primaryDifference) return primaryDifference;

      const orderDifference = Number(left.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(right.sort_order ?? Number.MAX_SAFE_INTEGER);
      if (orderDifference) return orderDifference;

      return Number(left.id || 0) - Number(right.id || 0);
    });
  const imageUrl = getImageUrl(images[0]);

  return imageUrl
    ? { url: imageUrl, isPlaceholder: false }
    : { url: DASHBOARD_LISTING_PLACEHOLDER, isPlaceholder: true };
}

export function getDashboardListingImageUrls(listing: DashboardListing) {
  const directCandidates = [
    listing.primary_image_url,
    listing.main_image_url,
    listing.image_url,
    listing.thumbnail_url,
  ].map(getSafeDashboardImageUrl).filter(Boolean);
  const rowImages = (listing.images || [])
    .filter((image) => image && image.is_deleted !== true)
    .sort((left, right) => {
      const mainDifference = Number(Boolean(right.is_main || right.is_primary)) - Number(Boolean(left.is_main || left.is_primary));
      if (mainDifference) return mainDifference;
      return Number(left.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(right.sort_order ?? Number.MAX_SAFE_INTEGER);
    })
    .map(getImageUrl)
    .filter(Boolean);

  return [...new Set([...directCandidates, ...rowImages])];
}

export function getDashboardListingActions(listing: DashboardListing) {
  const status = normalizeListingStatus(listing.status);
  const publicListing = isPublicListing(listing);
  const editable = ["draft", "ai_draft", "rejected", "needs_fix"].includes(status);

  return {
    status,
    viewHref: publicListing && listing.slug ? `/cars/${encodeURIComponent(listing.slug)}/` : "",
    editHref: editable ? `/dashboard/listings/edit?id=${encodeURIComponent(String(listing.id))}` : "",
    promoteHref: ["approved", "published"].includes(status)
      ? `/dashboard/cars/promote?id=${encodeURIComponent(String(listing.id))}`
      : "",
    canDelete: !["blocked", "deleted"].includes(status),
  };
}
