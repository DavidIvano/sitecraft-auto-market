import type { DealFinderDataLevel, IngestListing, JsonRecord, KleinanzeigenAd } from "./types.ts";

const trackingKeys = new Set(["fbclid", "gclid", "dclid", "msclkid", "ref", "referrer", "trk"]);
export function normalizeExternalId(value: unknown) { return String(value ?? "").trim().slice(0, 255); }
export function normalizeExternalUrl(value: unknown) {
  try { const url = new URL(String(value)); if (url.protocol !== "https:") return null; [...url.searchParams.keys()].forEach((key) => { if (key.startsWith("utm_") || trackingKeys.has(key.toLowerCase())) url.searchParams.delete(key); }); url.hash = ""; url.pathname = url.pathname.replace(/\/+$/, "") || "/"; return url.toString(); } catch { return null; }
}
export function normalizeExternalImageUrl(value: unknown) {
  const url = normalizeExternalUrl(value);
  return url && !new URL(url).pathname.toLowerCase().endsWith(".svg") ? url : null;
}
export function createContentHash(listing: Pick<IngestListing, "title" | "description" | "price" | "year" | "mileage" | "source_image_url">) { const input = [listing.title, listing.description || "", listing.price ?? "", listing.year ?? "", listing.mileage ?? "", listing.source_image_url || ""].join("|"); let hash = 2166136261; for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619); return `df_${(hash >>> 0).toString(16).padStart(8, "0")}`; }
const text = (value: unknown) => { const trimmed = typeof value === "string" ? value.trim() : ""; return trimmed || null; };
const number = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(/[^\d,.-]/g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
function detail(details: JsonRecord | null | undefined, keys: string[]) { for (const key of keys) if (details && key in details) return details[key]; return null; }
function attribute(ad: KleinanzeigenAd, name: string, field: "value" | "label" = "label") {
  for (const item of ad.attributes || []) {
    if (!item || typeof item !== "object") continue;
    const record = item as JsonRecord;
    if (record.name !== name || !Array.isArray(record.values) || !record.values[0] || typeof record.values[0] !== "object") continue;
    return (record.values[0] as JsonRecord)[field] ?? null;
  }
  return null;
}
function year(value: unknown) {
  const match = String(value ?? "").match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}
export function mapKleinanzeigenAd(ad: KleinanzeigenAd, options?: { dataLevel?: DealFinderDataLevel; detailFetchedAt?: string | null }): IngestListing | null {
  const dataLevel = options && typeof options === "object" ? options.dataLevel || "search" : "search";
  const detailFetchedAt = options && typeof options === "object" ? options.detailFetchedAt || null : null;
  const externalId = normalizeExternalId(ad.ad_id); const sourceUrl = normalizeExternalUrl(ad.ad_url); const title = text(ad.title); if (!externalId || !sourceUrl || !title) return null;
  const details = ad.details || {}; const sourceImages = (ad.images || []).map((image) => normalizeExternalImageUrl(typeof image === "string" ? image : image?.url)).filter((image): image is string => Boolean(image));
  const registration = attribute(ad, "autos.ezdate", "value") ?? detail(details, ["year", "first_registration_year", "Erstzulassung"]);
  const listing = { platform: "kleinanzeigen" as const, external_id: externalId, source_url: sourceUrl, title, description: text(ad.description), price: number(ad.price?.amount), currency: text(ad.price?.currency_code)?.toUpperCase() || "EUR", brand: text(attribute(ad, "autos.marke") ?? detail(details, ["brand", "make", "Marke"])), model: text(attribute(ad, "autos.model") ?? detail(details, ["model", "Modell"])), variant: text(detail(details, ["variant", "Variante"])), year: year(registration), mileage: number(attribute(ad, "autos.km", "value") ?? detail(details, ["mileage", "Kilometerstand"])), fuel_type: text(attribute(ad, "autos.fuel") ?? detail(details, ["fuel_type", "fuel", "Kraftstoffart"])), transmission: text(attribute(ad, "autos.shift") ?? detail(details, ["transmission", "Getriebe"])), power_kw: number(detail(details, ["power_kw"])), power_hp: number(attribute(ad, "autos.power", "value") ?? detail(details, ["power_hp", "Leistung"])), city: text(ad.location?.city || ad.location?.name), postal_code: text(ad.location?.zip || detail(details, ["postal_code", "zip_code"])), source_image_url: sourceImages[0] || null, source_images: sourceImages, published_at: text(ad.created_at), data_level: dataLevel, provider_detail_loaded: dataLevel === "detail", provider_detail_fetched_at: dataLevel === "detail" ? detailFetchedAt : null, raw_data: { category: ad.category || null, attributes: ad.attributes || [], details } };
  return { ...listing, content_hash: createContentHash(listing) };
}
