import type { Locale } from "../../i18n/locales.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import {
  I18N_PREVIEW_NOINDEX,
  SEO_CATALOG_API_ENABLED,
  SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED,
} from "../config.ts";
import {
  getApprovedCars,
  getLocalizedApprovedCars,
  getLocalizedSeoCatalogPagePayload,
} from "../xano.ts";
import {
  buildCompatibilityLocalizedCatalogPage,
  normalizeBoundedLocalizedCatalogPage,
  resolveLocalizedCatalogPage,
  type LocalizedCatalogResolution,
} from "./catalogApi.ts";
import { TAXONOMY_PAGE_SIZE } from "./taxonomies.ts";
import { readSeoTaxonomyPageNumber } from "./taxonomyPage.ts";

export type LoadLocalizedCatalogPageInput = {
  locale: Locale;
  url: URL;
};

const loadCompatibilityCatalog = async (
  input: LoadLocalizedCatalogPageInput,
  page: number,
): Promise<LocalizedCatalogResolution> => {
  const listings = isStrictSeoReleaseLocale(input.locale)
    ? await getLocalizedApprovedCars(input.locale)
    : await getApprovedCars(input.locale, { requireConfigured: true });
  const catalog = buildCompatibilityLocalizedCatalogPage(listings, { locale: input.locale, page });
  return resolveLocalizedCatalogPage({
    ...input,
    catalog,
    previewNoindex: I18N_PREVIEW_NOINDEX,
  });
};

export async function loadLocalizedCatalogPage(
  input: LoadLocalizedCatalogPageInput,
): Promise<LocalizedCatalogResolution> {
  const page = readSeoTaxonomyPageNumber(input.url.searchParams);
  if (!page) return { status: "not_found" };
  if (!SEO_CATALOG_API_ENABLED) return loadCompatibilityCatalog(input, page);
  try {
    const rawPayload = await getLocalizedSeoCatalogPagePayload({
      locale: input.locale,
      page,
      limit: TAXONOMY_PAGE_SIZE,
    });
    if (rawPayload === null) {
      if (SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED) return loadCompatibilityCatalog(input, page);
      return { status: "not_found" };
    }
    const catalog = normalizeBoundedLocalizedCatalogPage(rawPayload, {
      locale: input.locale,
      requestedPage: page,
    });
    return resolveLocalizedCatalogPage({
      ...input,
      catalog,
      previewNoindex: I18N_PREVIEW_NOINDEX,
    });
  } catch (error) {
    if (SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED) return loadCompatibilityCatalog(input, page);
    throw error;
  }
}
