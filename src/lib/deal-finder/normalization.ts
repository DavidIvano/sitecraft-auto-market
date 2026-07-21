import type { DealFinderListing } from "./types";

const TRACKING_PARAMS = new Set(["fbclid", "gclid", "dclid", "msclkid", "ref", "referrer", "trk"]);

export function normalizeExternalListingId(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 255);
}

export function normalizeSourceUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:") return null;
    [...url.searchParams.keys()].forEach((key) => {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    });
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function createListingContentHash(input: Pick<DealFinderListing, "platform" | "external_id" | "title" | "price" | "description">) {
  const raw = [input.platform, normalizeExternalListingId(input.external_id), input.title.trim(), input.price ?? "", input.description?.trim() ?? ""].join("|");
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `df_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function mergeImportedDealFinderListing(
  existing: DealFinderListing,
  incoming: Pick<DealFinderListing, "title" | "description" | "price" | "source_image_url" | "last_seen_at" | "content_hash">,
): DealFinderListing {
  return {
    ...existing,
    ...incoming,
    is_saved: existing.is_saved,
    is_hidden: existing.is_hidden,
    is_viewed: existing.is_viewed,
    user_status: existing.user_status,
  };
}
