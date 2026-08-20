export const SITE_NAME = "SiteCraft Auto Market";
export const SITE_DESCRIPTION = "Премиальная простая доска объявлений авто";
export const XANO_API_URL = import.meta.env.PUBLIC_XANO_API_URL;
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || "https://automarket.sitecraft.agency";
export const DEAL_FINDER_ENABLED = import.meta.env.PUBLIC_DEAL_FINDER_ENABLED === "true";
export const DEAL_FINDER_USE_MOCK_DATA = import.meta.env.PUBLIC_DEAL_FINDER_USE_MOCK_DATA === "true";
// Contract-first rollout for bounded programmatic SEO reads. Both flags are
// intentionally off by default until the additive Xano endpoints are released.
export const SEO_TAXONOMY_API_ENABLED = import.meta.env.PUBLIC_SEO_TAXONOMY_API_ENABLED === "true";
export const SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED =
  import.meta.env.PUBLIC_SEO_TAXONOMY_COMPATIBILITY_FALLBACK_ENABLED === "true";
export const SEO_CATALOG_API_ENABLED = import.meta.env.PUBLIC_SEO_CATALOG_API_ENABLED === "true";
export const SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED =
  import.meta.env.PUBLIC_SEO_CATALOG_COMPATIBILITY_FALLBACK_ENABLED === "true";
export const SEO_SITEMAP_SHARDS_ENABLED = import.meta.env.PUBLIC_SEO_SITEMAP_SHARDS_ENABLED === "true";
export const SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED =
  import.meta.env.PUBLIC_SEO_SITEMAP_COMPATIBILITY_FALLBACK_ENABLED === "true";

import { isPreviewEnvironment } from "../i18n/release3";
import { isPublicLocaleRouteEnabled, readRelease4Flags } from "../i18n/release4";

export const I18N_PREVIEW_NOINDEX = isPreviewEnvironment(import.meta.env);
export const RELEASE4_FLAGS = readRelease4Flags(import.meta.env);
export const I18N_ENABLED = RELEASE4_FLAGS.I18N_ENABLED;
export const I18N_API_READ_ENABLED = RELEASE4_FLAGS.I18N_API_READ_ENABLED;
export const I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED = RELEASE4_FLAGS.I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED;
export const I18N_DUAL_WRITE_ENABLED = RELEASE4_FLAGS.I18N_DUAL_WRITE_ENABLED;
export const I18N_PUBLIC_ROUTES_ENABLED = RELEASE4_FLAGS.I18N_PUBLIC_ROUTES_ENABLED;
export const I18N_AI_TRANSLATION_ENABLED = RELEASE4_FLAGS.I18N_AI_TRANSLATION_ENABLED;
export const GERMAN_PUBLIC_ROUTES_ENABLED = isPublicLocaleRouteEnabled("de", RELEASE4_FLAGS);
