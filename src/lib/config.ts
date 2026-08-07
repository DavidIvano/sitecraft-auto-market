export const SITE_NAME = "SiteCraft Auto Market";
export const SITE_DESCRIPTION = "Премиальная простая доска объявлений авто";
export const XANO_API_URL = import.meta.env.PUBLIC_XANO_API_URL;
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || "https://automarket.sitecraft.agency";
export const DEAL_FINDER_ENABLED = import.meta.env.PUBLIC_DEAL_FINDER_ENABLED === "true";
export const DEAL_FINDER_USE_MOCK_DATA = import.meta.env.PUBLIC_DEAL_FINDER_USE_MOCK_DATA === "true";

import {
  assertValidRelease3Config,
  isGermanPublicRouteEnabled,
  isPreviewEnvironment,
  readRelease3Flags,
} from "../i18n/release3";

export const RELEASE3_FLAGS = assertValidRelease3Config(readRelease3Flags(import.meta.env));
export const I18N_ENABLED = RELEASE3_FLAGS.I18N_ENABLED;
export const I18N_API_READ_ENABLED = RELEASE3_FLAGS.I18N_API_READ_ENABLED;
export const I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED = RELEASE3_FLAGS.I18N_ADMIN_TEST_LOCALE_AWARE_READ_ENABLED;
export const I18N_DUAL_WRITE_ENABLED = RELEASE3_FLAGS.I18N_DUAL_WRITE_ENABLED;
export const I18N_PUBLIC_ROUTES_ENABLED = RELEASE3_FLAGS.I18N_PUBLIC_ROUTES_ENABLED;
export const I18N_AI_TRANSLATION_ENABLED = RELEASE3_FLAGS.I18N_AI_TRANSLATION_ENABLED;
export const I18N_LOCALE_DE_ENABLED = RELEASE3_FLAGS.I18N_LOCALE_DE_ENABLED;
export const I18N_LOCALE_EN_ENABLED = RELEASE3_FLAGS.I18N_LOCALE_EN_ENABLED;
export const I18N_LOCALE_UK_ENABLED = RELEASE3_FLAGS.I18N_LOCALE_UK_ENABLED;
export const I18N_LOCALE_ZH_HANS_ENABLED = RELEASE3_FLAGS.I18N_LOCALE_ZH_HANS_ENABLED;
export const GERMAN_PUBLIC_ROUTES_ENABLED = isGermanPublicRouteEnabled(RELEASE3_FLAGS);
export const I18N_PREVIEW_NOINDEX = isPreviewEnvironment(import.meta.env);
