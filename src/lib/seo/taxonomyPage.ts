import type { Locale } from "../../i18n/locales.ts";
import { getRouteAlternates } from "../../i18n/publicRoutes.ts";
import type { CarListing } from "../types.ts";
import {
  TAXONOMY_PAGE_SIZE,
  buildRelatedSeoTaxonomyGroups,
  buildSeoTaxonomyBreadcrumbs,
  buildSeoTaxonomyMetadata,
  findSeoTaxonomyFacet,
  getFacetReadyLocales,
  getTaxonomyBasePath,
  getTaxonomyCanonicalPath,
  hasSeoFilterQuery,
  isSeoTaxonomyFacetIndexable,
  type SeoBreadcrumb,
  type SeoRelatedTaxonomyGroup,
  type SeoTaxonomyFacet,
  type SeoTaxonomyGraph,
  type SeoTaxonomyType,
} from "./taxonomies.ts";

export type LoadedSeoTaxonomyCatalog = {
  cars: CarListing[];
  graph: SeoTaxonomyGraph;
  strictSeoRelease: boolean;
};

export type ResolvedSeoTaxonomyPage = {
  status: "ok";
  facet: SeoTaxonomyFacet;
  graph: SeoTaxonomyGraph;
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

export type SeoTaxonomyResolution =
  | ResolvedSeoTaxonomyPage
  | { status: "not_found" }
  | { status: "redirect"; location: string };

const safeDecode = (value: unknown) => {
  try {
    return decodeURIComponent(String(value ?? "")).trim();
  } catch {
    return "";
  }
};

const parsePage = (searchParams: URLSearchParams) => {
  const raw = searchParams.get("page");
  if (raw === null || raw === "") return 1;
  if (!/^\d+$/u.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100_000 ? page : null;
};

const appendNonPageQuery = (path: string, searchParams: URLSearchParams) => {
  const url = new URL(path, "https://local.invalid");
  for (const [key, value] of searchParams) {
    if (key !== "page") url.searchParams.append(key, value);
  }
  return `${url.pathname}${url.search}`;
};

export function resolveSeoTaxonomyPage(input: {
  locale: Locale;
  type: SeoTaxonomyType;
  slug: unknown;
  parentSlug?: unknown;
  url: URL;
  catalog: LoadedSeoTaxonomyCatalog;
  previewNoindex?: boolean;
}): SeoTaxonomyResolution {
  const rawSlug = safeDecode(input.slug);
  const rawParent = safeDecode(input.parentSlug);
  if (!rawSlug || rawSlug.length > 100 || (input.type === "model" && (!rawParent || rawParent.length > 100))) {
    return { status: "not_found" };
  }
  const facet = findSeoTaxonomyFacet(input.catalog.graph, input.type, rawSlug, rawParent);
  if (!facet) return { status: "not_found" };

  const page = parsePage(input.url.searchParams);
  if (!page) return { status: "not_found" };
  const totalPages = Math.max(1, Math.ceil(facet.cars.length / TAXONOMY_PAGE_SIZE));
  if (page > totalPages) return { status: "not_found" };

  const canonicalPath = getTaxonomyCanonicalPath(input.locale, facet, page);
  const routeNeedsCanonicalRedirect = rawSlug !== facet.slug
    || (input.type === "model" && rawParent !== facet.parentSlug);
  const pageOneDuplicate = page === 1
    && input.url.searchParams.has("page")
    && !hasSeoFilterQuery(input.url.searchParams);
  if (routeNeedsCanonicalRedirect || pageOneDuplicate) {
    return { status: "redirect", location: appendNonPageQuery(canonicalPath, input.url.searchParams) };
  }

  const start = (page - 1) * TAXONOMY_PAGE_SIZE;
  const cars = facet.cars.slice(start, start + TAXONOMY_PAGE_SIZE);
  const indexable = isSeoTaxonomyFacetIndexable(facet, input.locale, {
    strictSeoRelease: input.catalog.strictSeoRelease,
    previewNoindex: input.previewNoindex ?? false,
  });
  const filteredQuery = hasSeoFilterQuery(input.url.searchParams);
  const metadata = buildSeoTaxonomyMetadata(facet, input.locale, page);
  const alternatePath = `${getTaxonomyBasePath(facet)}${page > 1 ? `?page=${page}` : ""}`;
  const readyLocales = indexable ? getFacetReadyLocales(facet, input.locale) : [];

  return {
    status: "ok",
    facet,
    graph: input.catalog.graph,
    cars,
    total: facet.cars.length,
    page,
    totalPages,
    canonicalPath,
    title: metadata.title,
    heading: metadata.heading,
    description: metadata.description,
    noindex: !indexable || filteredQuery,
    filteredQuery,
    breadcrumbs: buildSeoTaxonomyBreadcrumbs(input.catalog.graph, facet, input.locale),
    relatedGroups: buildRelatedSeoTaxonomyGroups(input.catalog.graph, facet, input.locale),
    alternateLocales: getRouteAlternates(alternatePath, readyLocales),
    previousPath: page > 1 ? getTaxonomyCanonicalPath(input.locale, facet, page - 1) : null,
    nextPath: page < totalPages ? getTaxonomyCanonicalPath(input.locale, facet, page + 1) : null,
  };
}
