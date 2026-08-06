export const SUPPORTED_LOCALES = ["de", "ru", "uk", "en", "ar", "tr"] as const;

export type Locale = typeof SUPPORTED_LOCALES[number];

// Keep Russian as the compatibility default until localized routes are released.
// The production default can move to German only after every public route exists in /de.
export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_LABELS: Record<Locale, string> = {
  de: "Deutsch",
  ru: "Русский",
  uk: "Українська",
  en: "English",
  ar: "العربية",
  tr: "Türkçe",
};

export const LOCALE_TAGS: Record<Locale, string> = {
  de: "de-DE",
  ru: "ru-RU",
  uk: "uk-UA",
  en: "en-GB",
  ar: "ar",
  tr: "tr-TR",
};

export const LOCALE_DIRECTIONS: Record<Locale, "ltr" | "rtl"> = {
  de: "ltr",
  ru: "ltr",
  uk: "ltr",
  en: "ltr",
  ar: "rtl",
  tr: "ltr",
};

export const LOCALE_COOKIE = "sitecraft-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function resolveLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (isLocale(value)) return value;
  if (typeof value === "string") {
    const base = value.trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return fallback;
}

export function resolveRequestLocale(url: URL, cookieLocale?: unknown): Locale {
  return resolveLocale(url.searchParams.get("lang") || cookieLocale, DEFAULT_LOCALE);
}
