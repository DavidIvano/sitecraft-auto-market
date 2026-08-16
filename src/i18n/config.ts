export type LocaleCode = string;

export type LocaleDirection = "ltr" | "rtl";

export type LocaleDefinition = Readonly<{
  code: LocaleCode;
  baseLanguage: string;
  nativeName: string;
  englishName: string;
  direction: LocaleDirection;
  fallbackLocale?: LocaleCode;
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
}>;

export const DEFAULT_LOCALE = "de";
export const LEGACY_PUBLIC_LOCALE = "ru";
export const LOCALE_COOKIE_NAME = "sitecraft-locale";

const rawDefinitions: LocaleDefinition[] = [
  { code: "de", baseLanguage: "de", nativeName: "Deutsch", englishName: "German", direction: "ltr", isActive: true, isPublic: true, isDefault: true, sortOrder: 10 },
  { code: "en", baseLanguage: "en", nativeName: "English", englishName: "English", direction: "ltr", fallbackLocale: "de", isActive: true, isPublic: true, isDefault: false, sortOrder: 20 },
  { code: "ru", baseLanguage: "ru", nativeName: "Русский", englishName: "Russian", direction: "ltr", fallbackLocale: "de", isActive: true, isPublic: true, isDefault: false, sortOrder: 30 },
  { code: "uk", baseLanguage: "uk", nativeName: "Українська", englishName: "Ukrainian", direction: "ltr", fallbackLocale: "de", isActive: true, isPublic: true, isDefault: false, sortOrder: 40 },
  { code: "tr", baseLanguage: "tr", nativeName: "Türkçe", englishName: "Turkish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 50 },
  { code: "ar", baseLanguage: "ar", nativeName: "العربية", englishName: "Arabic", direction: "rtl", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 60 },
  { code: "zh-Hans", baseLanguage: "zh", nativeName: "简体中文", englishName: "Simplified Chinese", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: false, isDefault: false, sortOrder: 70 },

  // All 24 official EU languages are configured here, but only locales with
  // isPublic=true may be indexed or selected on public routes.
  { code: "bg", baseLanguage: "bg", nativeName: "Български", englishName: "Bulgarian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 100 },
  { code: "hr", baseLanguage: "hr", nativeName: "Hrvatski", englishName: "Croatian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 110 },
  { code: "cs", baseLanguage: "cs", nativeName: "Čeština", englishName: "Czech", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 120 },
  { code: "da", baseLanguage: "da", nativeName: "Dansk", englishName: "Danish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 130 },
  { code: "nl", baseLanguage: "nl", nativeName: "Nederlands", englishName: "Dutch", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 140 },
  { code: "et", baseLanguage: "et", nativeName: "Eesti", englishName: "Estonian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 150 },
  { code: "fi", baseLanguage: "fi", nativeName: "Suomi", englishName: "Finnish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 160 },
  { code: "fr", baseLanguage: "fr", nativeName: "Français", englishName: "French", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 170 },
  { code: "el", baseLanguage: "el", nativeName: "Ελληνικά", englishName: "Greek", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 180 },
  { code: "hu", baseLanguage: "hu", nativeName: "Magyar", englishName: "Hungarian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 190 },
  { code: "ga", baseLanguage: "ga", nativeName: "Gaeilge", englishName: "Irish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 200 },
  { code: "it", baseLanguage: "it", nativeName: "Italiano", englishName: "Italian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 210 },
  { code: "lv", baseLanguage: "lv", nativeName: "Latviešu", englishName: "Latvian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 220 },
  { code: "lt", baseLanguage: "lt", nativeName: "Lietuvių", englishName: "Lithuanian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 230 },
  { code: "mt", baseLanguage: "mt", nativeName: "Malti", englishName: "Maltese", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 240 },
  { code: "pl", baseLanguage: "pl", nativeName: "Polski", englishName: "Polish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 250 },
  { code: "pt", baseLanguage: "pt", nativeName: "Português", englishName: "Portuguese", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 260 },
  { code: "ro", baseLanguage: "ro", nativeName: "Română", englishName: "Romanian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 270 },
  { code: "sk", baseLanguage: "sk", nativeName: "Slovenčina", englishName: "Slovak", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 280 },
  { code: "sl", baseLanguage: "sl", nativeName: "Slovenščina", englishName: "Slovenian", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 290 },
  { code: "es", baseLanguage: "es", nativeName: "Español", englishName: "Spanish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 300 },
  { code: "sv", baseLanguage: "sv", nativeName: "Svenska", englishName: "Swedish", direction: "ltr", fallbackLocale: "en", isActive: true, isPublic: true, isDefault: false, sortOrder: 310 },
];

export function validateLocaleDefinitions(definitions: readonly LocaleDefinition[]) {
  const errors: string[] = [];
  const codes = new Set<string>();

  for (const definition of definitions) {
    let canonical = "";
    try {
      canonical = Intl.getCanonicalLocales(definition.code)[0] || "";
    } catch {
      errors.push(`Invalid BCP-47 locale: ${definition.code}`);
    }
    if (canonical && canonical !== definition.code) errors.push(`Locale ${definition.code} must use canonical form ${canonical}`);
    if (codes.has(definition.code)) errors.push(`Duplicate locale: ${definition.code}`);
    codes.add(definition.code);
    if (definition.baseLanguage !== definition.baseLanguage.toLowerCase()) errors.push(`Invalid base language: ${definition.baseLanguage}`);
    if (definition.direction !== "ltr" && definition.direction !== "rtl") errors.push(`Invalid direction for ${definition.code}`);
  }

  const defaults = definitions.filter((definition) => definition.isDefault);
  if (defaults.length !== 1) errors.push(`Expected exactly one default locale, received ${defaults.length}`);
  if (defaults[0]?.code !== DEFAULT_LOCALE) errors.push(`Default locale must be ${DEFAULT_LOCALE}`);

  for (const definition of definitions) {
    if (definition.fallbackLocale && !codes.has(definition.fallbackLocale)) {
      errors.push(`Unknown fallback ${definition.fallbackLocale} for ${definition.code}`);
    }
    if (definition.isPublic && !definition.isActive) errors.push(`Public locale ${definition.code} must be active`);
  }

  return errors;
}

const validationErrors = validateLocaleDefinitions(rawDefinitions);
if (validationErrors.length) throw new Error(`Invalid locale registry:\n${validationErrors.join("\n")}`);

export const localeDefinitions = Object.freeze(
  rawDefinitions
    .map((definition) => Object.freeze({ ...definition }))
    .sort((left, right) => left.sortOrder - right.sortOrder),
);

export const localeRegistry: ReadonlyMap<string, LocaleDefinition> = new Map(
  localeDefinitions.map((definition) => [definition.code, definition] as const),
);

export const activeLocaleDefinitions = Object.freeze(localeDefinitions.filter((definition) => definition.isActive));
export const publicLocaleDefinitions = Object.freeze(localeDefinitions.filter((definition) => definition.isActive && definition.isPublic));

export function getLocaleDefinition(locale: unknown) {
  if (typeof locale !== "string") return undefined;
  try {
    const canonical = Intl.getCanonicalLocales(locale.replaceAll("_", "-"))[0];
    return localeRegistry.get(canonical);
  } catch {
    return undefined;
  }
}

/** @deprecated Test/bootstrap compatibility. Production locale changes must be reviewed in this registry. */
export function registerLocale(definition: LocaleDefinition) {
  const errors = validateLocaleDefinitions([
    ...localeDefinitions.filter((candidate) => candidate.code !== definition.code && !candidate.isDefault),
    definition.isDefault ? definition : { ...definition, isDefault: false },
    localeRegistry.get(DEFAULT_LOCALE)!,
  ]);
  if (errors.some((error) => error.startsWith("Invalid BCP-47") || error.startsWith("Locale "))) {
    throw new Error(errors.join("; "));
  }
  (localeRegistry as Map<string, LocaleDefinition>).set(definition.code, Object.freeze({ ...definition }));
}
