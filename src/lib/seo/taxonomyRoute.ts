import type { Locale } from "../../i18n/locales.ts";
import { isStrictSeoReleaseLocale } from "../../i18n/releaseStage3.ts";
import { I18N_PREVIEW_NOINDEX } from "../config.ts";
import { isPublicListing } from "../listingStatus.ts";
import { getApprovedCars, getLocalizedApprovedCars } from "../xano.ts";
import { buildSeoTaxonomyGraph } from "./taxonomies.ts";
import {
  resolveSeoTaxonomyPage as resolveSeoTaxonomyPageCore,
  type LoadedSeoTaxonomyCatalog,
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
