import {
  DEFAULT_LOCALE as CONFIG_DEFAULT_LOCALE,
  LEGACY_PUBLIC_LOCALE,
  LOCALE_COOKIE_NAME,
  getLocaleDefinition,
  localeRegistry,
  type LocaleCode,
} from "./config.ts";
import { getLocaleFromAcceptLanguage } from "./locale.ts";

// Compatibility list for dictionaries already shipped in the current UI. New
// locales are configured in config.ts and are not public until their dictionary
// and backend readiness checks pass.
export const SUPPORTED_LOCALES = ["de", "ru", "uk", "en", "ar", "tr", "fr"] as const;
export type LegacyUiLocale = typeof SUPPORTED_LOCALES[number];
export type Locale = LocaleCode;

// Xano's current public endpoint contract accepts these six values. UI locales
// can ship independently and safely reuse English listing payloads until the
// corresponding Xano locale is enabled.
export const XANO_SUPPORTED_LOCALES = ["de", "ru", "uk", "en", "ar", "tr"] as const;
export type XanoLocale = typeof XANO_SUPPORTED_LOCALES[number];

export const EU_OFFICIAL_LOCALES = [
  "bg", "hr", "cs", "da", "nl", "en", "et", "fi", "fr", "de", "el", "hu",
  "ga", "it", "lv", "lt", "mt", "pl", "pt", "ro", "sk", "sl", "es", "sv",
] as const;

// The six reviewed dictionaries stay the authoritative translated set. The
// remaining official EU languages are selectable with an explicit English
// fallback until their reviewed dictionaries and Xano translations are ready.
export const SELECTABLE_LOCALES = Object.freeze([
  ...SUPPORTED_LOCALES,
  ...EU_OFFICIAL_LOCALES.filter((code) => !SUPPORTED_LOCALES.includes(code as LegacyUiLocale)),
]);
export type SelectableLocale = typeof SELECTABLE_LOCALES[number];

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

export function isSelectableLocale(value: unknown): value is SelectableLocale {
  return typeof value === "string" && SELECTABLE_LOCALES.includes(value as SelectableLocale);
}

export function resolveContentLocale(value: unknown): LegacyUiLocale {
  const resolved = resolveLocale(value, "en");
  return isLegacyUiLocale(resolved) ? resolved : "en";
}

export function resolveBackendLocale(value: unknown): XanoLocale {
  const resolved = resolveLocale(value, "en");
  return XANO_SUPPORTED_LOCALES.includes(resolved as XanoLocale) ? resolved as XanoLocale : "en";
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
export function resolveRequestLocale(
  url: URL,
  cookieLocale?: unknown,
  acceptLanguage?: string | null,
  countryCode?: string | null,
): Locale {
  const candidates = [
    url.searchParams.get("lang") || url.searchParams.get("locale"),
    cookieLocale,
    getLocaleFromAcceptLanguage(acceptLanguage),
  ];

  for (const candidate of candidates) {
    const resolved = resolveLocale(candidate, "en");
    if (candidate && isSelectableLocale(resolved)) return resolved;
  }

  const countryFallbacks: Record<string, SelectableLocale> = {
    AT: "de",
    DE: "de",
    FR: "fr",
    RU: "ru",
  };
  const regionalLocale = countryFallbacks[String(countryCode || "").trim().toUpperCase()];
  if (regionalLocale) return regionalLocale;

  // English is the safe UI fallback for device languages that the site does
  // not support yet. It also avoids silently falling back to the source data
  // language when no preference is available.
  return "en";
}
