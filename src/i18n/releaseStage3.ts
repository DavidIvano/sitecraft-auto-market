import { hasCompleteVehicleTaxonomy } from "../domain/vehicleTaxonomy.ts";
import { getLocaleDefinition } from "./config.ts";
import { hasUiDictionary } from "./messages.ts";
import { hasPublicPageDictionary } from "./publicRoutes.ts";
import { hasPublicStaticPageDictionary } from "./staticPages.ts";

export const STAGE3_PRIMARY_RELEASE_ORDER = ["en", "fr", "tr", "ar", "ru", "uk"] as const;

export const STAGE3_EU_RELEASE_BATCHES = [
  ["nl", "da", "sv", "fi"],
  ["es", "pt", "it"],
  ["pl", "cs", "sk", "sl"],
  ["bg", "hr", "ro", "hu", "el"],
  ["et", "lv", "lt", "mt", "ga"],
] as const;

// These locales use only translation-ready Xano records on indexable SEO pages.
// A locale is added here during release preparation, but it still remains
// unreachable until config.ts explicitly sets isPublic=true.
export const STRICT_SEO_RELEASE_LOCALES = new Set<string>(["en", "fr"]);

export type LocaleReleaseEvidence = {
  publicListingCount: number;
  readyListingCount: number;
  sitemapReady: boolean;
  canonicalReady: boolean;
  reciprocalHreflangReady: boolean;
  smokeReady: boolean;
};

export function getStaticLocaleReleaseReadiness(locale: string) {
  const definition = getLocaleDefinition(locale);
  return {
    configured: Boolean(definition?.code === locale && definition.isActive),
    uiReady: hasUiDictionary(locale),
    publicPagesReady: hasPublicPageDictionary(locale),
    staticPagesReady: hasPublicStaticPageDictionary(locale),
    taxonomyReady: hasCompleteVehicleTaxonomy(locale),
  };
}

export function evaluateLocaleRelease(locale: string, evidence: LocaleReleaseEvidence) {
  const checks = {
    ...getStaticLocaleReleaseReadiness(locale),
    listingTranslationsReady: evidence.publicListingCount > 0
      && evidence.readyListingCount === evidence.publicListingCount,
    sitemapReady: evidence.sitemapReady,
    canonicalReady: evidence.canonicalReady,
    reciprocalHreflangReady: evidence.reciprocalHreflangReady,
    smokeReady: evidence.smokeReady,
  };
  const blockers = Object.entries(checks).flatMap(([name, ready]) => ready ? [] : [name]);
  return { locale, ready: blockers.length === 0, blockers, checks };
}

export function isStrictSeoReleaseLocale(locale: string) {
  return STRICT_SEO_RELEASE_LOCALES.has(locale);
}
