import type { CarListing, CarListingImage } from "./types.ts";
import { isPublicListing, normalizeListingStatus } from "./listingStatus.ts";

export const DASHBOARD_LISTING_PLACEHOLDER = "/sitecraft-logo.png";

export type DashboardListing = Partial<CarListing> & {
  id: number;
  views_total?: number;
  views_unique?: number;
  views_7d?: number;
  last_viewed_at?: string | number | null;
  thumbnail_url?: string;
  primary_image_url?: string;
  image_url?: string;
  images?: Array<Partial<CarListingImage> & { url?: string }>;
};

export function normalizeViewCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function formatViewCount(value: unknown) {
  const count = normalizeViewCount(value);
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14
    ? "просмотров"
    : mod10 === 1
      ? "просмотр"
      : mod10 >= 2 && mod10 <= 4
        ? "просмотра"
        : "просмотров";
  return `${count.toLocaleString("ru-RU")} ${noun}`;
}

export function formatLastViewedAt(value: unknown, now = new Date()) {
  if (value === null || value === undefined || value === "") return "";
  const date = typeof value === "number" || /^\d+$/.test(String(value))
    ? new Date(Number(value))
    : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (sameDay) return `Последний просмотр: сегодня, ${time}`;

  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" as const }),
  }).format(date);
  return `Последний просмотр: ${dateLabel}, ${time}`;
}

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

  const viewHref = publicListing && listing.slug ? `/cars/${encodeURIComponent(listing.slug)}/` : "";
  const editHref = editable ? `/dashboard/listings/edit?id=${encodeURIComponent(String(listing.id))}` : "";
  const primary = status === "draft" || status === "ai_draft"
    ? { label: "Продолжить", href: editHref }
    : status === "rejected" || status === "needs_fix"
      ? { label: "Исправить", href: editHref }
      : viewHref
        ? { label: "Посмотреть", href: viewHref }
        : { label: "", href: "" };

  return {
    status,
    primaryLabel: primary.label,
    primaryHref: primary.href,
    viewHref,
    editHref,
    promoteHref: ["approved", "published"].includes(status)
      ? `/dashboard/cars/promote?id=${encodeURIComponent(String(listing.id))}`
      : "",
    canDelete: !["blocked", "deleted"].includes(status),
  };
}
