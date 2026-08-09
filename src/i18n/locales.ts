import {
  DEFAULT_LOCALE as CONFIG_DEFAULT_LOCALE,
  LEGACY_PUBLIC_LOCALE,
  LOCALE_COOKIE_NAME,
  getLocaleDefinition,
  localeRegistry,
  type LocaleCode,
} from "./config.ts";

// Compatibility list for dictionaries already shipped in the current UI. New
// locales are configured in config.ts and are not public until their dictionary
// and backend readiness checks pass.
export const SUPPORTED_LOCALES = ["de", "ru", "uk", "en", "ar", "tr"] as const;
export type LegacyUiLocale = typeof SUPPORTED_LOCALES[number];
export type Locale = LocaleCode;

// Compatibility default for old query-based routes. The authoritative default
// for locale-prefixed public routes remains German in config.ts.
export const DEFAULT_LOCALE = LEGACY_PUBLIC_LOCALE;
export const PUBLIC_DEFAULT_LOCALE = CONFIG_DEFAULT_LOCALE;
export const LOCALE_COOKIE = LOCALE_COOKIE_NAME;

export const LOCALE_LABELS = Object.fromEntries(
  [...localeRegistry].map(([code, definition]) => [code, definition.nativeName]),
) as Record<string, string>;

export const LOCALE_TAGS = Object.fromEntries(
  [...localeRegistry].map(([code]) => [code, code]),
) as Record<string, string>;

export const LOCALE_DIRECTIONS = Object.fromEntries(
  [...localeRegistry].map(([code, definition]) => [code, definition.direction]),
) as Record<string, "ltr" | "rtl">;

export function isLocale(value: unknown): value is Locale {
  return Boolean(getLocaleDefinition(value)?.isActive);
}

export function isLegacyUiLocale(value: unknown): value is LegacyUiLocale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as LegacyUiLocale);
}

export function resolveLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  const exact = getLocaleDefinition(value);
  if (exact?.isActive) return exact.code;

  if (typeof value === "string") {
    const base = value.trim().toLowerCase().split(/[-_]/)[0];
    const matched = [...localeRegistry.values()].find(
      (definition) => definition.isActive && (definition.code.toLowerCase() === base || definition.baseLanguage === base),
    );
    if (matched) return matched.code;
  }

  return getLocaleDefinition(fallback)?.isActive ? fallback : DEFAULT_LOCALE;
}

// Query/cookie resolution exists only for old unprefixed URLs during migration.
export function resolveRequestLocale(url: URL, cookieLocale?: unknown): Locale {
  const resolved = resolveLocale(url.searchParams.get("lang") || url.searchParams.get("locale") || cookieLocale, LEGACY_PUBLIC_LOCALE);
  return isLegacyUiLocale(resolved) ? resolved : LEGACY_PUBLIC_LOCALE;
}
