import { isValidPublicCarSlug } from "../publicCar.ts";

export const SITEMAP_LISTING_SHARD_SIZE = 10_000;
export const SITEMAP_MAX_SHARDS_PER_LOCALE = 10_000;
export const SITEMAP_MAX_ENTRIES_PER_INDEX = 50_000;
export const SITEMAP_GENERATION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u;

const toRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);
const text = (value: unknown) => String(value ?? "").trim();
const nonNegativeInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const positiveInteger = (value: unknown) => {
  const parsed = nonNegativeInteger(value);
  return parsed && parsed > 0 ? parsed : null;
};

export const toSitemapIsoDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const raw = text(value);
  const date = typeof value === "number" || /^\d+$/u.test(raw)
    ? new Date(Number(value))
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export class SeoSitemapContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoSitemapContractError";
  }
}

export type SeoSitemapLocaleManifest = {
  locale: string;
  generation: string;
  listingTotal: number;
  shardSize: number;
  shardCount: number;
  lastmod: string | null;
};

export type SeoSitemapManifest = {
  locales: SeoSitemapLocaleManifest[];
  generatedAt: string | null;
};

export type SeoListingSitemapItem = {
  slug: string;
  lastmod: string | null;
};

export type SeoListingSitemapShard = {
  locale: string;
  generation: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: SeoListingSitemapItem[];
};

export function normalizeSeoSitemapManifest(
  payload: unknown,
  expectedLocales: readonly string[],
): SeoSitemapManifest {
  const source = toRecord(payload);
  const rows = Array.isArray(source?.locales) ? source.locales : Array.isArray(source?.items) ? source.items : null;
  if (!source || !rows) throw new SeoSitemapContractError("SEO sitemap manifest payload is invalid");
  const locales = rows.map((row): SeoSitemapLocaleManifest => {
    const item = toRecord(row);
    const locale = text(item?.locale);
    const generation = text(item?.generation);
    const listingTotal = nonNegativeInteger(item?.listing_total ?? item?.total);
    const shardSize = positiveInteger(item?.shard_size);
    const shardCount = nonNegativeInteger(item?.shard_count);
    if (!item || !locale || !SITEMAP_GENERATION_PATTERN.test(generation)
      || listingTotal === null || shardSize !== SITEMAP_LISTING_SHARD_SIZE || shardCount === null) {
      throw new SeoSitemapContractError("SEO sitemap manifest locale row is invalid");
    }
    const expectedShardCount = listingTotal === 0 ? 0 : Math.ceil(listingTotal / shardSize);
    if (shardCount !== expectedShardCount || shardCount > SITEMAP_MAX_SHARDS_PER_LOCALE) {
      throw new SeoSitemapContractError("SEO sitemap manifest shard count is invalid");
    }
    const lastmod = toSitemapIsoDate(item.lastmod);
    if (item.lastmod && !lastmod) throw new SeoSitemapContractError("SEO sitemap manifest lastmod is invalid");
    return { locale, generation, listingTotal, shardSize, shardCount, lastmod };
  });
  const localeCodes = locales.map((item) => item.locale);
  if (new Set(localeCodes).size !== localeCodes.length) {
    throw new SeoSitemapContractError("SEO sitemap manifest contains duplicate locales");
  }
  const expected = [...new Set(expectedLocales)].sort();
  const actual = [...localeCodes].sort();
  if (expected.length !== actual.length || expected.some((locale, index) => locale !== actual[index])) {
    throw new SeoSitemapContractError("SEO sitemap manifest does not match the public locale registry");
  }
  const sitemapIndexEntryCount = locales.length
    + locales.reduce((total, item) => total + item.shardCount, 0);
  if (sitemapIndexEntryCount > SITEMAP_MAX_ENTRIES_PER_INDEX) {
    throw new SeoSitemapContractError("SEO sitemap manifest exceeds the sitemap index limit");
  }
  const generatedAt = toSitemapIsoDate(source.generated_at);
  if (source.generated_at && !generatedAt) throw new SeoSitemapContractError("SEO sitemap manifest timestamp is invalid");
  return { locales, generatedAt };
}

export function normalizeSeoListingSitemapShard(
  payload: unknown,
  input: { locale: string; generation: string; requestedPage: number },
): SeoListingSitemapShard | null {
  if (payload === null) return null;
  const source = toRecord(payload);
  const pagination = toRecord(source?.pagination);
  const rows = Array.isArray(source?.items) ? source.items : null;
  const locale = text(source?.locale);
  const generation = text(source?.generation);
  const page = positiveInteger(pagination?.page ?? source?.page);
  const limit = positiveInteger(pagination?.limit ?? pagination?.per_page ?? source?.limit);
  const total = nonNegativeInteger(pagination?.total ?? source?.total);
  const totalPages = positiveInteger(pagination?.total_pages ?? pagination?.pageTotal);
  if (!source || !rows || locale !== input.locale || generation !== input.generation
    || !SITEMAP_GENERATION_PATTERN.test(generation) || !page || page !== input.requestedPage
    || limit !== SITEMAP_LISTING_SHARD_SIZE || total === null || !totalPages) {
    throw new SeoSitemapContractError("SEO listing sitemap shard pagination is invalid");
  }
  const expectedTotalPages = Math.max(1, Math.ceil(total / limit));
  const expectedItems = total === 0 ? 0 : Math.min(limit, total - ((page - 1) * limit));
  if (page > totalPages || totalPages !== expectedTotalPages || rows.length !== expectedItems) {
    throw new SeoSitemapContractError("SEO listing sitemap shard bounds are invalid");
  }
  const items = rows.map((row): SeoListingSitemapItem => {
    const item = toRecord(row);
    const slug = text(item?.slug);
    const lastmod = toSitemapIsoDate(item?.lastmod ?? item?.updated_at);
    if (!item || !isValidPublicCarSlug(slug) || ((item.lastmod ?? item.updated_at) && !lastmod)) {
      throw new SeoSitemapContractError("SEO listing sitemap item is invalid");
    }
    return { slug, lastmod };
  });
  if (new Set(items.map((item) => item.slug)).size !== items.length) {
    throw new SeoSitemapContractError("SEO listing sitemap shard contains duplicate slugs");
  }
  return { locale, generation, page, limit, total, totalPages, items };
}
