export type LocaleCode = string;

export type LocaleDirection = "ltr" | "rtl";

export type LocaleDefinition = {
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
};

export const DEFAULT_LOCALE = "de";
export const LEGACY_PUBLIC_LOCALE = "ru";
export const LOCALE_COOKIE_NAME = "sitecraft-locale";

const definitions: LocaleDefinition[] = [
  {
    code: "de",
    baseLanguage: "de",
    nativeName: "Deutsch",
    englishName: "German",
    direction: "ltr",
    isActive: true,
    isPublic: false,
    isDefault: true,
    sortOrder: 10,
  },
  {
    code: "en",
    baseLanguage: "en",
    nativeName: "English",
    englishName: "English",
    direction: "ltr",
    fallbackLocale: "de",
    isActive: true,
    isPublic: false,
    isDefault: false,
    sortOrder: 20,
  },
  {
    code: "ru",
    baseLanguage: "ru",
    nativeName: "Русский",
    englishName: "Russian",
    direction: "ltr",
    fallbackLocale: "de",
    isActive: true,
    isPublic: false,
    isDefault: false,
    sortOrder: 30,
  },
  {
    code: "uk",
    baseLanguage: "uk",
    nativeName: "Українська",
    englishName: "Ukrainian",
    direction: "ltr",
    fallbackLocale: "de",
    isActive: true,
    isPublic: false,
    isDefault: false,
    sortOrder: 40,
  },
  {
    code: "zh-Hans",
    baseLanguage: "zh",
    nativeName: "简体中文",
    englishName: "Simplified Chinese",
    direction: "ltr",
    fallbackLocale: "en",
    isActive: true,
    isPublic: false,
    isDefault: false,
    sortOrder: 50,
  },
];

export const localeDefinitions = Object.freeze(
  [...definitions].sort((left, right) => left.sortOrder - right.sortOrder),
);

export const localeRegistry = new Map(
  localeDefinitions.map((definition) => [definition.code, definition] as const),
);

export function registerLocale(definition: LocaleDefinition) {
  localeRegistry.set(definition.code, Object.freeze({ ...definition }));
}
