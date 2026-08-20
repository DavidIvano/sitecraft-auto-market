import type { Locale } from "../../i18n/locales.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import {
  I18N_PREVIEW_NOINDEX,
  SEO_TAXONOMY_API_ENABLED,
  SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED,
} from "../config.ts";
import { isPublicListing } from "../listingStatus.ts";
import {
  getApprovedCars,
  getLocalizedApprovedCars,
  getLocalizedSeoTaxonomyCountsPayload,
  getLocalizedSeoTaxonomyPagePayload,
} from "../xano.ts";
import {
  normalizeBoundedSeoTaxonomyPage,
  normalizeBoundedSeoTaxonomyCountsPage,
  resolveBoundedSeoTaxonomyPage,
} from "./taxonomyApi.ts";
import {
  TAXONOMY_PAGE_SIZE,
  buildSeoTaxonomyGraph,
  isSeoTaxonomyFacetIndexable,
  normalizeTaxonomyRouteSlug,
  type SeoTaxonomyFacet,
  type SeoTaxonomyType,
} from "./taxonomies.ts";
import {
  readSeoTaxonomyPageNumber,
  resolveSeoTaxonomyPage as resolveSeoTaxonomyPageCore,
  type LoadedSeoTaxonomyCatalog,
  type SeoTaxonomyResolution,
} from "./taxonomyPage.ts";

export type { LoadedSeoTaxonomyCatalog, ResolvedSeoTaxonomyPage, SeoTaxonomyResolution } from "./taxonomyPage.ts";

export async function loadLocalizedSeoTaxonomyCatalog(locale: Locale): Promise<LoadedSeoTaxonomyCatalog> {
  const strictSeoRelease = isStrictSeoReleaseLocale(locale);
  const listings = strictSeoRelease
    ? await getLocalizedApprovedCars(locale)
    : await getApprovedCars(locale, { requireConfigured: true });
  const cars = listings.filter(isPublicListing);
  return { cars, graph: buildSeoTaxonomyGraph(cars), strictSeoRelease };
}

export function resolveSeoTaxonomyPage(input: Parameters<typeof resolveSeoTaxonomyPageCore>[0]) {
  return resolveSeoTaxonomyPageCore({
    ...input,
    previewNoindex: input.previewNoindex ?? I18N_PREVIEW_NOINDEX,
  });
}

export type LoadLocalizedSeoTaxonomyPageInput = {
  locale: Locale;
  type: SeoTaxonomyType;
  slug: unknown;
  parentSlug?: unknown;
  url: URL;
};

const loadCompatibilityTaxonomyPage = async (
  input: LoadLocalizedSeoTaxonomyPageInput,
): Promise<SeoTaxonomyResolution> => {
  const catalog = await loadLocalizedSeoTaxonomyCatalog(input.locale);
  return resolveSeoTaxonomyPage({ ...input, catalog });
};

/**
 * One route-level entry point for all localized taxonomy pages. When the
 * additive endpoint is enabled, only the requested 24 cards plus aggregate
 * metadata cross the Xano boundary. The historical full-catalog path remains
 * available behind a separate, explicit rollout flag.
 */
export async function loadLocalizedSeoTaxonomyPage(
  input: LoadLocalizedSeoTaxonomyPageInput,
): Promise<SeoTaxonomyResolution> {
  if (!SEO_TAXONOMY_API_ENABLED) return loadCompatibilityTaxonomyPage(input);

  const page = readSeoTaxonomyPageNumber(input.url.searchParams);
  if (!page) return { status: "not_found" };
  const slug = normalizeTaxonomyRouteSlug(input.type, input.slug);
  const parentSlug = input.type === "model"
    ? normalizeTaxonomyRouteSlug("brand", input.parentSlug)
    : "";
  if (!slug || (input.type === "model" && !parentSlug)) return { status: "not_found" };

  try {
    const rawPayload = await getLocalizedSeoTaxonomyPagePayload({
      locale: input.locale,
      type: input.type,
      slug,
      parentSlug: parentSlug || undefined,
      page,
      limit: TAXONOMY_PAGE_SIZE,
    });
    if (rawPayload === null && SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED) {
      return loadCompatibilityTaxonomyPage(input);
    }
    const payload = normalizeBoundedSeoTaxonomyPage(rawPayload, {
      locale: input.locale,
      type: input.type,
      requestedPage: page,
    });
    return resolveBoundedSeoTaxonomyPage({
      ...input,
      payload,
      previewNoindex: I18N_PREVIEW_NOINDEX,
    });
  } catch (error) {
    if (SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED) {
      return loadCompatibilityTaxonomyPage(input);
    }
    throw error;
  }
}

export type LoadedSeoTaxonomySitemapFacets = {
  facets: SeoTaxonomyFacet[];
  queryCount: number;
};

/**
 * Paged aggregate feed for sitemap taxonomy URLs. Returns null while the
 * bounded API is disabled (or during an explicitly enabled compatibility
 * canary), allowing the existing graph to remain the rollout fallback.
 */
export async function loadLocalizedSeoTaxonomySitemapFacets(
  locale: Locale,
  options: { requireBounded?: boolean; allowCompatibilityFallback?: boolean } = {},
): Promise<LoadedSeoTaxonomySitemapFacets | null> {
  if (!SEO_TAXONOMY_API_ENABLED && !options.requireBounded) return null;
  try {
    const facets: SeoTaxonomyFacet[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const rawPayload = await getLocalizedSeoTaxonomyCountsPayload(locale, { page, limit: 500 });
      if (rawPayload === null) throw new Error("Taxonomy counts endpoint is missing");
      const result = normalizeBoundedSeoTaxonomyCountsPage(rawPayload, { locale, requestedPage: page });
      totalPages = result.totalPages;
      if (totalPages > 1_000) throw new Error("Taxonomy counts endpoint exceeded the safety bound");
      facets.push(...result.facets);
      page += 1;
    } while (page <= totalPages);

    const uniqueFacets = [...new Map(facets.map((facet) => [`${facet.type}:${facet.key}`, facet])).values()];
    if (uniqueFacets.length !== facets.length) throw new Error("Taxonomy counts endpoint returned duplicate facets");
    return {
      facets: uniqueFacets.filter((facet) => isSeoTaxonomyFacetIndexable(facet, locale, {
        strictSeoRelease: true,
        previewNoindex: I18N_PREVIEW_NOINDEX,
      })),
      queryCount: totalPages,
    };
  } catch (error) {
    const allowCompatibilityFallback = options.allowCompatibilityFallback
      ?? SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED;
    if (allowCompatibilityFallback) return null;
    throw error;
  }
}
