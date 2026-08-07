import { createHash } from "node:crypto";

import {
  BACKEND_VALUE_CATALOG,
  normalizeBackendValue,
  type BackendValueField,
} from "../../src/i18n/backendValues.ts";

export const TRANSLATION_SOURCE_SCHEMA = "car_listing_translation_source_v1";
export const TRANSLATION_PROMPT_VERSION = "listing-translation-v1";

type ListingRecord = Record<string, unknown> & { id?: number };

const normalizeText = (value: unknown) => String(value ?? "")
  .replace(/\r\n?/g, "\n")
  .trim();

export function canonicalTranslationSource(listing: ListingRecord) {
  return {
    schema: TRANSLATION_SOURCE_SCHEMA,
    title: normalizeText(listing.title),
    description: normalizeText(listing.description),
    seo_title: normalizeText(listing.seo_title),
    seo_description: normalizeText(listing.seo_description),
    image_alt_texts: Array.isArray(listing.image_alt_texts)
      ? listing.image_alt_texts.map(normalizeText).filter(Boolean)
      : [],
    search_keywords: Array.isArray(listing.search_keywords)
      ? listing.search_keywords.map(normalizeText).filter(Boolean)
      : [],
  };
}

export function createTranslationSourceHash(listing: ListingRecord) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalTranslationSource(listing)))
    .digest("hex");
}

const descriptionValue = (listing: ListingRecord, label: string) => {
  const line = normalizeText(listing.description)
    .split("\n")
    .find((candidate) => candidate.trim().startsWith(`${label}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
};

const knownValue = (field: BackendValueField, rawValue: unknown) => {
  const value = normalizeText(rawValue);
  if (!value) return true;
  const normalized = normalizeBackendValue(field, value);
  return BACKEND_VALUE_CATALOG[field].some((item) => item.code === normalized);
};

const CATEGORY_SOURCES: Array<{
  field: BackendValueField;
  source: string;
  read: (listing: ListingRecord) => unknown;
}> = [
  { field: "vehicle_type", source: "column", read: (listing) => listing.vehicle_type },
  { field: "body_type", source: "column", read: (listing) => listing.body_type },
  { field: "fuel_type", source: "column", read: (listing) => listing.fuel_type },
  { field: "transmission", source: "column", read: (listing) => listing.transmission },
  { field: "drivetrain", source: "column", read: (listing) => listing.drivetrain },
  { field: "color", source: "column", read: (listing) => listing.color },
  { field: "vehicle_condition", source: "column", read: (listing) => listing.vehicle_condition || listing.condition },
  { field: "seller_type", source: "column", read: (listing) => listing.seller_type },
  { field: "country", source: "column", read: (listing) => listing.country },
  { field: "body_type", source: "description:Кузов", read: (listing) => descriptionValue(listing, "Кузов") },
  { field: "drivetrain", source: "description:Привод", read: (listing) => descriptionValue(listing, "Привод") },
  { field: "color", source: "description:Цвет", read: (listing) => descriptionValue(listing, "Цвет") },
  { field: "vehicle_condition", source: "description:Состояние", read: (listing) => descriptionValue(listing, "Состояние") },
  { field: "seller_type", source: "description:Тип продавца", read: (listing) => descriptionValue(listing, "Тип продавца") },
];

export function auditLegacyListingValues(listings: ListingRecord[]) {
  const unknown = new Map<string, {
    field: BackendValueField;
    value: string;
    listing_ids: number[];
    sources: string[];
  }>();

  for (const listing of listings) {
    for (const category of CATEGORY_SOURCES) {
      const value = normalizeText(category.read(listing));
      if (!value || knownValue(category.field, value)) continue;
      const key = `${category.field}\u0000${value}`;
      const entry = unknown.get(key) || {
        field: category.field,
        value,
        listing_ids: [],
        sources: [],
      };
      if (Number.isInteger(listing.id) && !entry.listing_ids.includes(Number(listing.id))) {
        entry.listing_ids.push(Number(listing.id));
      }
      if (!entry.sources.includes(category.source)) entry.sources.push(category.source);
      unknown.set(key, entry);
    }
  }

  return [...unknown.values()]
    .map((entry) => ({
      ...entry,
      listing_ids: entry.listing_ids.sort((left, right) => left - right),
      sources: entry.sources.sort(),
    }))
    .sort((left, right) => left.field.localeCompare(right.field) || left.value.localeCompare(right.value));
}

export function isPublicMigrationCandidate(listing: ListingRecord) {
  const status = normalizeText(listing.status);
  const moderationStatus = normalizeText(listing.moderation_status);
  return status !== "deleted"
    && status !== "archived"
    && [status, moderationStatus].some((value) => ["approved", "published"].includes(value));
}

export function buildTranslationJobs({
  listings,
  translations = [],
  existingJobs = [],
  targetLocales = ["de", "uk", "en", "ar", "tr"],
}: {
  listings: ListingRecord[];
  translations?: ListingRecord[];
  existingJobs?: ListingRecord[];
  targetLocales?: string[];
}) {
  const jobs: ListingRecord[] = [];

  for (const listing of listings.filter(isPublicMigrationCandidate)) {
    const id = Number(listing.id);
    const sourceLocale = normalizeText(listing.source_locale) || "ru";
    const sourceHash = normalizeText(listing.translation_source_hash) || createTranslationSourceHash(listing);

    for (const targetLocale of targetLocales) {
      if (targetLocale === sourceLocale) continue;
      const alreadyTranslated = translations.some((translation) =>
        Number(translation.car_listing_id) === id
        && translation.locale_code === targetLocale
        && translation.source_locale === sourceLocale
        && translation.source_hash === sourceHash
        && translation.translation_status === "completed");
      if (alreadyTranslated) continue;

      const idempotencyKey = `car-listing:${id}:${targetLocale}:${sourceHash.slice(0, 16)}:v1`;
      if (existingJobs.some((job) => job.idempotency_key === idempotencyKey)) continue;

      jobs.push({
        entity_type: "car_listing",
        entity_id: id,
        source_locale: sourceLocale,
        target_locale: targetLocale,
        source_hash: sourceHash,
        status: "queued",
        priority: 100,
        attempt_count: 0,
        max_attempts: 3,
        provider: "openai",
        model: "gpt-5.6-luna",
        prompt_version: TRANSLATION_PROMPT_VERSION,
        idempotency_key: idempotencyKey,
      });
    }
  }

  return jobs;
}
