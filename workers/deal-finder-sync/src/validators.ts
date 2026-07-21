import type { IngestListing } from "./types.ts";
export function validateIngestListing(listing: IngestListing, currentYear = new Date().getUTCFullYear() + 1) {
  if (!listing.external_id || listing.external_id.length > 255 || !listing.title || listing.title.length > 300) return false;
  try { if (new URL(listing.source_url).protocol !== "https:") return false; } catch { return false; }
  if (listing.price !== null && (listing.price < 0 || listing.price > 1_000_000)) return false; if (listing.year !== null && (listing.year < 1900 || listing.year > currentYear)) return false; if (listing.mileage !== null && (listing.mileage < 0 || listing.mileage > 3_000_000)) return false; if (listing.power_kw !== null && (listing.power_kw < 0 || listing.power_kw > 2_000)) return false;
  return listing.source_images.every((url) => { try { const parsed = new URL(url); return parsed.protocol === "https:" && !parsed.pathname.toLowerCase().endsWith(".svg"); } catch { return false; } });
}
export function validateAiOutput(value: unknown) { if (!value || typeof value !== "object") return false; const output = value as Record<string, unknown>; const fields = ["deal_score", "risk_score", "liquidity_score", "data_quality_score"]; return fields.every((field) => Number.isInteger(output[field]) && Number(output[field]) >= 0 && Number(output[field]) <= 100) && typeof output.confidence_score === "number" && output.confidence_score >= 0 && output.confidence_score <= 1 && ["HOT_DEAL", "CONTACT_NOW", "REVIEW", "WATCH", "SKIP", "INSUFFICIENT_DATA"].includes(String(output.recommendation)); }
