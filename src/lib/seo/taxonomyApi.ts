import type { Locale } from "../../i18n/locales.ts";
import { getRouteAlternates, getPublicPageMessages } from "../../i18n/publicRoutes.ts";
import { isPublicListing } from "../listingStatus.ts";
import { normalizePublicCarList } from "../publicCar.ts";
import type { CarListing } from "../types.ts";
import {
  SEO_PRICE_BUCKETS,
  TAXONOMY_PAGE_SIZE,
  buildSeoTaxonomyMetadata,
  getFacetReadyLocales,
  getSeoTaxonomyFacetCount,
  getTaxonomyBasePath,
  getTaxonomyCanonicalPath,
  getTaxonomyDisplayLabel,
  getTaxonomyGroupLabel,
  hasSeoFilterQuery,
  isSeoTaxonomyFacetIndexable,
  normalizeTaxonomyRouteSlug,
  type SeoBreadcrumb,
  type SeoRelatedTaxonomyGroup,
  type SeoTaxonomyFacet,
  type SeoTaxonomyType,
} from "./taxonomies.ts";
import {
  appendNonPageQueryToPath,
  readSeoTaxonomyPageNumber,
  safeDecodeSeoTaxonomyParam,
  type SeoTaxonomyResolution,
} from "./taxonomyPage.ts";
import { toSitemapIsoDate } from "./sitemapApi.ts";

const TAXONOMY_TYPES = new Set<SeoTaxonomyType>([
  "brand", "model", "city", "region", "fuel", "body", "price",
]);

const toRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const text = (value: unknown) => String(value ?? "").replace(/\s+/gu, " ").trim();
const optionalText = (value: unknown) => text(value) || undefined;
const nonNegativeInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const positiveInteger = (value: unknown) => {
  const parsed = nonNegativeInteger(value);
  return parsed && parsed > 0 ? parsed : null;
};

export class SeoTaxonomyContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoTaxonomyContractError";
  }
}

export type BoundedSeoTaxonomyPage = {
  facet: SeoTaxonomyFacet;
  items: CarListing[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  parentLabel?: string;
  regionLabel?: string;
  relatedGroups: SeoRelatedTaxonomyGroup[];
};

export type BoundedSeoTaxonomyCountsPage = {
  facets: SeoTaxonomyFacet[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const readReadyLocales = (value: unknown) => (
  Array.isArray(value)
    ? [...new Set(value.map(text).filter(Boolean))]
    : []
);

function normalizeFacet(
  value: unknown,
  expectedType?: SeoTaxonomyType,
  pageCars: CarListing[] = [],
): SeoTaxonomyFacet | null {
  const source = toRecord(value);
  if (!source) return null;
  const type = text(source.type) as SeoTaxonomyType;
  if (!TAXONOMY_TYPES.has(type) || (expectedType && type !== expectedType)) return null;
  const rawSlug = text(source.slug);
  const rawParentSlug = type === "model" ? text(source.parent_slug) : "";
  const parentSlug = type === "model" ? normalizeTaxonomyRouteSlug("brand", rawParentSlug) : "";
  const slug = normalizeTaxonomyRouteSlug(type, rawSlug);
  const label = text(source.label);
  const total = nonNegativeInteger(source.total ?? source.count);
  if (!slug || rawSlug !== slug || !label || total === null) return null;
  if (type === "model" && (!parentSlug || rawParentSlug !== parentSlug)) return null;
  const priceBucket = type === "price"
    ? SEO_PRICE_BUCKETS.find((bucket) => bucket.slug === slug)
    : undefined;
  if (type === "price" && !priceBucket) return null;
  const rawRegionSlug = text(source.region_slug);
  const regionSlug = rawRegionSlug ? normalizeTaxonomyRouteSlug("region", rawRegionSlug) : "";
  if (rawRegionSlug && rawRegionSlug !== regionSlug) return null;
  const rawCode = text(source.code);
  if (["fuel", "body", "price"].includes(type) && rawCode && rawCode !== slug) return null;
  const rawLastmod = source.lastmod;
  const lastmod = toSitemapIsoDate(rawLastmod);
  if (rawLastmod !== null && rawLastmod !== undefined && rawLastmod !== "" && !lastmod) return null;
  const key = type === "model" ? `${parentSlug}/${slug}` : slug;
  return {
    type,
    key,
    slug,
    label,
    cars: pageCars,
    count: total,
    readyLocales: readReadyLocales(source.ready_locales ?? source.available_locales),
    parentSlug: parentSlug || undefined,
    regionSlug: regionSlug || undefined,
    code: rawCode || (["fuel", "body", "price"].includes(type) ? slug : undefined),
    priceBucket,
    lastmod,
  };
}

export function normalizeSeoRelatedTaxonomyGroups(
  value: unknown,
  locale: Locale,
  currentFacet: SeoTaxonomyFacet | null = null,
) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((groupValue): SeoRelatedTaxonomyGroup[] => {
    const group = toRecord(groupValue);
    const type = text(group?.type) as SeoTaxonomyType;
    const rows = Array.isArray(group?.items) ? group.items : Array.isArray(group?.facets) ? group.facets : [];
    if (!TAXONOMY_TYPES.has(type)) return [];
    const links = rows.flatMap((row) => {
      const facet = normalizeFacet(row, type);
      if (!facet || (currentFacet && facet.type === currentFacet.type && facet.key === currentFacet.key)) return [];
      if (!isSeoTaxonomyFacetIndexable(facet, locale, { strictSeoRelease: true, previewNoindex: false })) return [];
      return [{
        type: facet.type,
        href: `/${locale}${getTaxonomyBasePath(facet)}`,
        label: getTaxonomyDisplayLabel(facet, locale),
        count: getSeoTaxonomyFacetCount(facet),
      }];
    }).slice(0, 8);
    return links.length ? [{ type, label: getTaxonomyGroupLabel(type, locale), links }] : [];
  });
}

/**
 * Validates the additive Xano contract at the frontend/backend boundary.
 * Invalid or unexpectedly unbounded payloads fail closed instead of silently
 * becoming indexable SEO pages.
 */
export function normalizeBoundedSeoTaxonomyPage(
  payload: unknown,
  input: { locale: Locale; type: SeoTaxonomyType; requestedPage: number },
): BoundedSeoTaxonomyPage | null {
  if (payload === null) return null;
  const source = toRecord(payload);
  if (!source) throw new SeoTaxonomyContractError("Taxonomy API returned an invalid payload");
  const pagination = toRecord(source.pagination) || {};
  const listings = toRecord(source.listings);
  const rawItems = source.items ?? listings?.items ?? source.cars;
  const items = normalizePublicCarList(rawItems).filter(isPublicListing);
  const page = positiveInteger(pagination.page ?? source.page);
  const limit = positiveInteger(pagination.limit ?? pagination.per_page ?? source.limit);
  const total = nonNegativeInteger(pagination.total ?? source.total ?? toRecord(source.facet)?.total);
  const facetTotal = nonNegativeInteger(toRecord(source.facet)?.total);
  if (!page || !limit || total === null || facetTotal === null || facetTotal !== total || page !== input.requestedPage || limit > TAXONOMY_PAGE_SIZE) {
    throw new SeoTaxonomyContractError("Taxonomy API pagination contract is invalid");
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const reportedTotalPages = positiveInteger(pagination.total_pages ?? pagination.pageTotal);
  if (total === 0) return null;
  const expectedItems = Math.min(limit, total - ((page - 1) * limit));
  if ((reportedTotalPages !== null && reportedTotalPages !== totalPages)
    || page > totalPages
    || items.length !== expectedItems
    || items.length > limit) {
    throw new SeoTaxonomyContractError("Taxonomy API page bounds are invalid");
  }
  const facetSource = { ...(toRecord(source.facet) || {}), total };
  const facet = normalizeFacet(facetSource, input.type, items);
  if (!facet) throw new SeoTaxonomyContractError("Taxonomy API facet contract is invalid");
  if (!facet.readyLocales?.includes(input.locale)) {
    throw new SeoTaxonomyContractError("Taxonomy API omitted the requested ready locale");
  }
  return {
    facet,
    items,
    page,
    limit,
    total,
    totalPages,
    parentLabel: optionalText(toRecord(source.facet)?.parent_label),
    regionLabel: optionalText(toRecord(source.facet)?.region_label),
    relatedGroups: normalizeSeoRelatedTaxonomyGroups(source.related_groups ?? source.related, input.locale, facet),
  };
}

export function normalizeBoundedSeoTaxonomyCountsPage(
  payload: unknown,
  input: { locale: Locale; requestedPage: number },
): BoundedSeoTaxonomyCountsPage {
  const source = toRecord(payload);
  const pagination = toRecord(source?.pagination);
  const rows = Array.isArray(source?.items) ? source.items : null;
  const page = positiveInteger(pagination?.page ?? source?.page);
  const limit = positiveInteger(pagination?.limit ?? pagination?.per_page ?? source?.limit);
  const total = nonNegativeInteger(pagination?.total ?? source?.total);
  const totalPagesValue = positiveInteger(pagination?.total_pages ?? pagination?.pageTotal);
  if (!source || !rows || !page || !limit || limit > 500 || total === null || !totalPagesValue || page !== input.requestedPage) {
    throw new SeoTaxonomyContractError("Taxonomy counts pagination contract is invalid");
  }
  const expectedTotalPages = Math.max(1, Math.ceil(total / limit));
  if (rows.length > limit || page > totalPagesValue || totalPagesValue !== expectedTotalPages) {
    throw new SeoTaxonomyContractError("Taxonomy counts page bounds are invalid");
  }
  const facets = rows.flatMap((row): SeoTaxonomyFacet[] => {
    const sourceRow = toRecord(row);
    if (!sourceRow || sourceRow.indexable === false) return [];
    const facet = normalizeFacet({
      ...sourceRow,
      total: sourceRow.count ?? sourceRow.total,
      ready_locales: [input.locale],
    });
    return facet ? [facet] : [];
  });
  if (facets.length !== rows.filter((row) => toRecord(row)?.indexable !== false).length) {
    throw new SeoTaxonomyContractError("Taxonomy counts contains an invalid facet");
  }
  return { facets, page, limit, total, totalPages: totalPagesValue };
}

const buildBoundedBreadcrumbs = (
  page: BoundedSeoTaxonomyPage,
  locale: Locale,
): SeoBreadcrumb[] => {
  const messages = getPublicPageMessages(locale);
  const breadcrumbs: SeoBreadcrumb[] = [
    { href: `/${locale}/`, label: messages.homeTitle },
    { href: `/${locale}/cars/`, label: messages.catalogTitle },
  ];
  if (page.facet.type === "model" && page.facet.parentSlug) {
    breadcrumbs.push({
      href: `/${locale}/cars/brand/${page.facet.parentSlug}/`,
      label: page.parentLabel || page.facet.parentSlug,
    });
  }
  if (page.facet.type === "city" && page.facet.regionSlug && page.regionLabel) {
    breadcrumbs.push({
      href: `/${locale}/cars/region/${page.facet.regionSlug}/`,
      label: page.regionLabel,
    });
  }
  breadcrumbs.push({ label: getTaxonomyDisplayLabel(page.facet, locale) });
  return breadcrumbs;
};

export function resolveBoundedSeoTaxonomyPage(input: {
  locale: Locale;
  type: SeoTaxonomyType;
  slug: unknown;
  parentSlug?: unknown;
  url: URL;
  payload: BoundedSeoTaxonomyPage | null;
  previewNoindex?: boolean;
}): SeoTaxonomyResolution {
  const rawSlug = safeDecodeSeoTaxonomyParam(input.slug);
  const rawParent = safeDecodeSeoTaxonomyParam(input.parentSlug);
  if (!rawSlug || rawSlug.length > 100 || (input.type === "model" && (!rawParent || rawParent.length > 100))) {
    return { status: "not_found" };
  }
  const pageNumber = readSeoTaxonomyPageNumber(input.url.searchParams);
  if (!pageNumber || !input.payload) return { status: "not_found" };
  const page = input.payload;
  if (page.page !== pageNumber || page.page > page.totalPages) return { status: "not_found" };

  const canonicalPath = getTaxonomyCanonicalPath(input.locale, page.facet, page.page);
  const routeNeedsCanonicalRedirect = rawSlug !== page.facet.slug
    || (input.type === "model" && rawParent !== page.facet.parentSlug);
  const pageOneDuplicate = page.page === 1
    && input.url.searchParams.has("page")
    && !hasSeoFilterQuery(input.url.searchParams);
  if (routeNeedsCanonicalRedirect || pageOneDuplicate) {
    return { status: "redirect", location: appendNonPageQueryToPath(canonicalPath, input.url.searchParams) };
  }

  const indexable = isSeoTaxonomyFacetIndexable(page.facet, input.locale, {
    strictSeoRelease: true,
    previewNoindex: input.previewNoindex ?? false,
  });
  const filteredQuery = hasSeoFilterQuery(input.url.searchParams);
  const metadata = buildSeoTaxonomyMetadata(page.facet, input.locale, page.page);
  const alternatePath = `${getTaxonomyBasePath(page.facet)}${page.page > 1 ? `?page=${page.page}` : ""}`;
  const readyLocales = indexable ? getFacetReadyLocales(page.facet, input.locale) : [];

  return {
    status: "ok",
    dataSource: "xano_bounded",
    facet: page.facet,
    cars: page.items,
    total: page.total,
    page: page.page,
    totalPages: page.totalPages,
    canonicalPath,
    title: metadata.title,
    heading: metadata.heading,
    description: metadata.description,
    noindex: !indexable || filteredQuery,
    filteredQuery,
    breadcrumbs: buildBoundedBreadcrumbs(page, input.locale),
    relatedGroups: page.relatedGroups,
    alternateLocales: getRouteAlternates(alternatePath, readyLocales),
    previousPath: page.page > 1 ? getTaxonomyCanonicalPath(input.locale, page.facet, page.page - 1) : null,
    nextPath: page.page < page.totalPages ? getTaxonomyCanonicalPath(input.locale, page.facet, page.page + 1) : null,
  };
}
