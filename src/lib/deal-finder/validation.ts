import { normalizeExternalListingId, normalizeSourceUrl } from "./normalization";

export type DealFinderValidationResult = { valid: true } | { valid: false; message: string };

export function validateDealFinderTestListing(input: Record<string, unknown>, currentYear = new Date().getFullYear() + 1): DealFinderValidationResult {
  const externalId = normalizeExternalListingId(input.external_id);
  if (!externalId) return { valid: false, message: "external_id is required" };
  if (!normalizeSourceUrl(input.source_url)) return { valid: false, message: "source_url must be a valid https URL" };
  const title = String(input.title ?? "").trim();
  if (!title || title.length > 300) return { valid: false, message: "title is required and must be at most 300 characters" };

  const ranges: Array<[string, number, number]> = [
    ["price", 0, 1_000_000],
    ["year", 1900, currentYear],
    ["mileage", 0, 3_000_000],
    ["power_kw", 0, 2000],
    ["deal_score", 0, 100],
    ["risk_score", 0, 100],
    ["confidence_score", 0, 1],
    ["radius_km", 0, 1000],
  ];
  for (const [field, min, max] of ranges) {
    if (input[field] === undefined || input[field] === null || input[field] === "") continue;
    const value = Number(input[field]);
    if (!Number.isFinite(value) || value < min || value > max) return { valid: false, message: `${field} must be between ${min} and ${max}` };
  }
  return { valid: true };
}

export function validateDealFinderIngestBatch(input: Record<string, unknown>, maxListings = 100): DealFinderValidationResult {
  const sourceType = String(input.source_type ?? "").trim();
  if (!['kleinanzeigen_agent', 'manual_json', 'mock', 'email'].includes(sourceType)) {
    return { valid: false, message: "source_type is invalid" };
  }
  if (!Number.isInteger(Number(input.search_id)) || Number(input.search_id) < 1) {
    return { valid: false, message: "search_id is required" };
  }
  if (!Array.isArray(input.listings) || input.listings.length === 0 || input.listings.length > maxListings) {
    return { valid: false, message: `listings must contain 1 to ${maxListings} items` };
  }
  for (const listing of input.listings) {
    if (!listing || typeof listing !== "object") return { valid: false, message: "listing must be an object" };
    const validated = validateDealFinderTestListing(listing as Record<string, unknown>);
    if (!validated.valid) return validated;
  }
  return { valid: true };
}
