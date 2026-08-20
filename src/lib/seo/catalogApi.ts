import type { Locale } from "../../i18n/locales.ts";
import { getPublicPageMessages, getRouteAlternates } from "../../i18n/publicRoutes.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import { isPublicListing } from "../listingStatus.ts";
import { normalizePublicCarList } from "../publicCar.ts";
import type { CarListing } from "../types.ts";
import { normalizeSeoRelatedTaxonomyGroups } from "./taxonomyApi.ts";
import {
  TAXONOMY_PAGE_SIZE,
  buildRelatedSeoTaxonomyGroups,
  buildSeoTaxonomyGraph,
  hasSeoFilterQuery,
  type SeoBreadcrumb,
  type SeoRelatedTaxonomyGroup,
} from "./taxonomies.ts";
import {
  appendNonPageQueryToPath,
  readSeoTaxonomyPageNumber,
} from "./taxonomyPage.ts";

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

export class SeoCatalogContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoCatalogContractError";
  }
}

export type LoadedLocalizedCatalogPage = {
  items: CarListing[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  readyLocales: string[];
  relatedGroups: SeoRelatedTaxonomyGroup[];
  dataSource: "xano_bounded" | "compatibility_catalog";
};

export type ResolvedLocalizedCatalogPage = {
  status: "ok";
  dataSource: LoadedLocalizedCatalogPage["dataSource"];
  cars: CarListing[];
  total: number;
  page: number;
  totalPages: number;
  canonicalPath: string;
  title: string;
  heading: string;
  description: string;
  noindex: boolean;
  filteredQuery: boolean;
  breadcrumbs: SeoBreadcrumb[];
  relatedGroups: SeoRelatedTaxonomyGroup[];
  alternateLocales: Array<{ locale: string; path: string; label?: string }>;
  previousPath: string | null;
  nextPath: string | null;
};

export type LocalizedCatalogResolution =
  | ResolvedLocalizedCatalogPage
  | { status: "not_found" }
  | { status: "redirect"; location: string };

export function normalizeBoundedLocalizedCatalogPage(
  payload: unknown,
  input: { locale: Locale; requestedPage: number },
): LoadedLocalizedCatalogPage {
  const source = toRecord(payload);
  const pagination = toRecord(source?.pagination);
  const rawItems = source?.items ?? toRecord(source?.listings)?.items ?? source?.cars;
  const items = normalizePublicCarList(rawItems).filter(isPublicListing);
  const page = positiveInteger(pagination?.page ?? source?.page);
  const limit = positiveInteger(pagination?.limit ?? pagination?.per_page ?? source?.limit);
  const total = nonNegativeInteger(pagination?.total ?? source?.total);
  const totalPages = positiveInteger(pagination?.total_pages ?? pagination?.pageTotal);
  if (!source || !page || !limit || limit > TAXONOMY_PAGE_SIZE || total === null || !totalPages || page !== input.requestedPage) {
    throw new SeoCatalogContractError("Localized catalog pagination contract is invalid");
  }
  const expectedTotalPages = Math.max(1, Math.ceil(total / limit));
  const expectedItems = total === 0 ? 0 : Math.min(limit, total - ((page - 1) * limit));
  if (page > totalPages || totalPages !== expectedTotalPages || items.length !== expectedItems) {
    throw new SeoCatalogContractError("Localized catalog page bounds are invalid");
  }
  const readyLocales = Array.isArray(source.ready_locales)
    ? [...new Set(source.ready_locales.map(text).filter(Boolean))]
    : [];
  if (total > 0 && !readyLocales.includes(input.locale)) {
    throw new SeoCatalogContractError("Localized catalog omitted the requested ready locale");
  }
  return {
    items,
    page,
    limit,
    total,
    totalPages,
    readyLocales,
    relatedGroups: normalizeSeoRelatedTaxonomyGroups(source.related_groups ?? source.related, input.locale),
    dataSource: "xano_bounded",
  };
}

export function buildCompatibilityLocalizedCatalogPage(
  cars: CarListing[],
  input: { locale: Locale; page: number },
): LoadedLocalizedCatalogPage | null {
  const publicCars = cars.filter(isPublicListing);
  const total = publicCars.length;
  const totalPages = Math.max(1, Math.ceil(total / TAXONOMY_PAGE_SIZE));
  if (input.page > totalPages) return null;
  const start = (input.page - 1) * TAXONOMY_PAGE_SIZE;
  return {
    items: publicCars.slice(start, start + TAXONOMY_PAGE_SIZE),
    page: input.page,
    limit: TAXONOMY_PAGE_SIZE,
    total,
    totalPages,
    readyLocales: [],
    relatedGroups: buildRelatedSeoTaxonomyGroups(buildSeoTaxonomyGraph(publicCars), null, input.locale),
    dataSource: "compatibility_catalog",
  };
}

const catalogCanonicalPath = (locale: Locale, page: number) => (
  page > 1 ? `/${locale}/cars/?page=${page}` : `/${locale}/cars/`
);

export function resolveLocalizedCatalogPage(input: {
  locale: Locale;
  url: URL;
  catalog: LoadedLocalizedCatalogPage | null;
  previewNoindex?: boolean;
}): LocalizedCatalogResolution {
  const page = readSeoTaxonomyPageNumber(input.url.searchParams);
  if (!page || !input.catalog || input.catalog.page !== page) return { status: "not_found" };
  const filteredQuery = hasSeoFilterQuery(input.url.searchParams);
  const canonicalPath = catalogCanonicalPath(input.locale, page);
  if (page === 1 && input.url.searchParams.has("page") && !filteredQuery) {
    return { status: "redirect", location: appendNonPageQueryToPath(canonicalPath, input.url.searchParams) };
  }
  const messages = getPublicPageMessages(input.locale);
  const indexable = isStrictSeoReleaseLocale(input.locale)
    && !input.previewNoindex
    && input.catalog.total > 0;
  const alternatePath = `/cars/${page > 1 ? `?page=${page}` : ""}`;
  const alternateLocales = input.catalog.dataSource === "xano_bounded"
    ? getRouteAlternates(alternatePath, input.catalog.readyLocales)
    : getRouteAlternates(alternatePath);
  const pageSuffix = page > 1 ? ` · ${page}` : "";
  const description = page > 1
    ? `${messages.catalogDescription} ${messages.results}: ${page}.`
    : messages.catalogDescription;
  const breadcrumbs: SeoBreadcrumb[] = [
    { href: `/${input.locale}/`, label: messages.homeTitle },
    { label: messages.catalogTitle },
  ];
  return {
    status: "ok",
    dataSource: input.catalog.dataSource,
    cars: input.catalog.items,
    total: input.catalog.total,
    page,
    totalPages: input.catalog.totalPages,
    canonicalPath,
    title: `${messages.catalogTitle}${pageSuffix}`,
    heading: messages.catalogTitle,
    description,
    noindex: !indexable || filteredQuery,
    filteredQuery,
    breadcrumbs,
    relatedGroups: input.catalog.relatedGroups,
    alternateLocales,
    previousPath: page > 1 ? catalogCanonicalPath(input.locale, page - 1) : null,
    nextPath: page < input.catalog.totalPages ? catalogCanonicalPath(input.locale, page + 1) : null,
  };
}
