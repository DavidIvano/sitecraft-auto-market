import { writeFileSync } from "node:fs";

import { BACKEND_VALUE_CATALOG } from "../../src/i18n/backendValues.ts";
import { getCatalogMessages } from "../../src/i18n/catalogMessages.ts";
import { getDetailMessages } from "../../src/i18n/detailMessages.ts";
import { EU_WAVE_CORE_TRANSLATIONS as existingCoreTranslations } from "../../src/i18n/euWaveCoreTranslations.ts";
import { EU_WAVE_TRANSLATIONS as existingTranslations } from "../../src/i18n/euWaveTranslations.ts";
import { getMessages } from "../../src/i18n/messages.ts";
import { SUPPORTED_LOCALES } from "../../src/i18n/locales.ts";
import { getPublicPageMessages } from "../../src/i18n/publicRoutes.ts";
import { PUBLIC_STATIC_PAGE_CODES, getPublicStaticPage } from "../../src/i18n/staticPages.ts";
import { UI_PHRASE_TRANSLATIONS } from "../../src/i18n/uiPhraseTranslations.ts";
import { UI_PHRASE_TRANSLATIONS_DYNAMIC } from "../../src/i18n/uiPhraseTranslationsDynamic.ts";
import { UI_PHRASE_TRANSLATIONS_SUPPLEMENTAL } from "../../src/i18n/uiPhraseTranslationsSupplemental.ts";
import { vehicleTaxonomyCodes, vehicleTaxonomyLabels } from "../../src/domain/vehicleTaxonomy.ts";

const outputPath = new URL("../../src/i18n/euWaveTranslations.ts", import.meta.url);
const coreOutputPath = new URL("../../src/i18n/euWaveCoreTranslations.ts", import.meta.url);
const publicCardOutputPath = new URL("../../src/i18n/publicCardMessages.generated.ts", import.meta.url);
const backendValuesOutputPath = new URL("../../src/i18n/backendValueTranslations.generated.ts", import.meta.url);
const targetLocales = [
  "nl", "da", "sv", "fi",
  "es", "pt", "it",
  "pl", "cs", "sk", "sl",
  "bg", "hr", "ro", "hu", "el",
  "et", "lv", "lt", "mt", "ga",
];
// Private-use separator survives Google Translate unchanged across every EU language.
const separator = "\uE000";
const batchSize = 18;
const concurrentBatches = 4;

const flattenStrings = (value) => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenStrings);
  return [];
};

const englishSources = [...new Set([
  ...Object.values(getMessages("en")),
  ...Object.values(getCatalogMessages("en")),
  ...Object.values(getDetailMessages("en")),
  ...flattenStrings(getPublicPageMessages("en")),
  ...PUBLIC_STATIC_PAGE_CODES.flatMap((page) => flattenStrings(getPublicStaticPage("en", page))),
  ...Object.values(BACKEND_VALUE_CATALOG).flatMap((items) => items.map((item) => item.labels.en)),
  ...Object.entries(vehicleTaxonomyCodes).flatMap(([taxonomy, codes]) => (
    codes.map((code) => vehicleTaxonomyLabels[taxonomy][code].en)
  )),
])].filter(Boolean).sort((left, right) => left.localeCompare(right));

const russianSources = [...new Set([
  ...Object.keys(UI_PHRASE_TRANSLATIONS),
  ...Object.keys(UI_PHRASE_TRANSLATIONS_DYNAMIC),
  ...Object.keys(UI_PHRASE_TRANSLATIONS_SUPPLEMENTAL),
  "{count} дней",
  "{count} кредитов",
  "До {count} активных объявлений",
  "{count} AI-кредитов каждый месяц",
  "Приоритет дилера: {count}",
  "{price} / мес.",
])].filter(Boolean).sort((left, right) => left.localeCompare(right));

const protectPlaceholders = (value) => {
  const placeholders = [];
  const protectedValue = value.replace(/\{[^{}]+\}/g, (placeholder) => {
    const token = `ZXQPH${placeholders.length}QXZ`;
    placeholders.push([token, placeholder]);
    return token;
  });
  return { protectedValue, placeholders };
};

const restorePlaceholders = (value, placeholders) => placeholders.reduce(
  (result, [token, placeholder]) => result.replaceAll(token, placeholder),
  value,
);

async function translateBatch(batch, sourceLocale, targetLocale) {
  const protectedItems = batch.map(protectPlaceholders);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLocale);
  url.searchParams.set("tl", targetLocale);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", protectedItems.map((item) => item.protectedValue).join(`\n${separator}\n`));

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`translation request failed: ${response.status}`);
      const payload = await response.json();
      const translated = payload[0].map((part) => part[0]).join("");
      const items = translated.split(separator).map((item) => item.trim());
      if (items.length !== batch.length) {
        throw new Error(`translation batch mismatch ${sourceLocale}->${targetLocale}: ${items.length}/${batch.length}`);
      }
      return items.map((value, index) => restorePlaceholders(value, protectedItems[index].placeholders));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  throw lastError;
}

const sourcesByLanguage = [["en", englishSources], ["ru", russianSources]];
const translations = Object.fromEntries(
  [...new Set([...englishSources, ...russianSources])].map((source) => [
    source,
    Object.fromEntries(targetLocales.flatMap((locale) => (
      existingCoreTranslations[source]?.[locale] || existingTranslations[source]?.[locale]
        ? [[locale, existingCoreTranslations[source]?.[locale] || existingTranslations[source][locale]]]
        : []
    ))),
  ]),
);

for (const locale of targetLocales) {
  for (const [sourceLocale, sources] of sourcesByLanguage) {
    const missingSources = sources.filter((source) => !translations[source]?.[locale]);
    const batches = [];
    for (let offset = 0; offset < missingSources.length; offset += batchSize) {
      batches.push(missingSources.slice(offset, offset + batchSize));
    }
    for (let offset = 0; offset < batches.length; offset += concurrentBatches) {
      const group = batches.slice(offset, offset + concurrentBatches);
      const results = await Promise.all(group.map((batch) => translateBatch(batch, sourceLocale, locale)));
      results.forEach((translated, groupIndex) => {
        const batch = group[groupIndex];
        translated.forEach((value, index) => {
          translations[batch[index]][locale] = value;
        });
      });
    }
  }
  process.stdout.write(`Prepared ${locale}.\n`);
}

const editorialOverrides = {
  Home: { nl: "Home", da: "Forside", sv: "Startsida", fi: "Etusivu", es: "Inicio", pt: "Início", it: "Home" },
  Cars: { nl: "Auto's", da: "Biler", sv: "Bilar", fi: "Autot", es: "Coches", pt: "Automóveis", it: "Auto" },
  Dashboard: { nl: "Mijn account", da: "Min konto", sv: "Mitt konto", fi: "Oma tili", es: "Mi cuenta", pt: "A minha conta", it: "Il mio account" },
  "Sell a car": { nl: "Auto verkopen", da: "Sælg en bil", sv: "Sälj en bil", fi: "Myy auto", es: "Vender un coche", pt: "Vender um automóvel", it: "Vendi un'auto" },
  Language: { nl: "Taal", da: "Sprog", sv: "Språk", fi: "Kieli", es: "Idioma", pt: "Idioma", it: "Lingua" },
  "Add listing": { nl: "Advertentie toevoegen", da: "Opret annonce", sv: "Lägg till annons", fi: "Lisää ilmoitus", es: "Añadir anuncio", pt: "Adicionar anúncio", it: "Aggiungi annuncio" },
  "Vehicle type": { nl: "Voertuigtype", da: "Køretøjstype", sv: "Fordonstyp", fi: "Ajoneuvotyyppi", es: "Tipo de vehículo", pt: "Tipo de veículo", it: "Tipo di veicolo" },
  "Passenger car": { nl: "Personenauto", da: "Personbil", sv: "Personbil", fi: "Henkilöauto", es: "Turismo", pt: "Automóvel ligeiro", it: "Autovettura" },
};
for (const [source, values] of Object.entries(editorialOverrides)) {
  translations[source] = { ...(translations[source] || {}), ...values };
}

const coreTranslations = Object.fromEntries(englishSources.map((source) => [source, translations[source]]));
const uiTranslations = Object.fromEntries(russianSources.map((source) => [source, translations[source]]));
const compactRows = (dictionary) => Object.fromEntries(
  Object.entries(dictionary).map(([source, values]) => [source, targetLocales.map((locale) => values[locale])]),
);
const coreRows = compactRows(coreTranslations);
const uiRows = compactRows(uiTranslations);

const coreOutput = `// Generated by scripts/i18n/generate-eu-wave-translations.mjs.\n`
  + `// Contains interface and taxonomy text only; never add user or listing content.\n\n`
  + `export const EU_WAVE_LOCALES = ${JSON.stringify(targetLocales)} as const;\n`
  + `export type EuWaveLocale = typeof EU_WAVE_LOCALES[number];\n\n`
  + `const EU_WAVE_CORE_ROWS: Record<string, readonly string[]> = ${JSON.stringify(coreRows, null, 2)};\n\n`
  + `export const EU_WAVE_CORE_TRANSLATIONS: Record<string, Record<EuWaveLocale, string>> = Object.fromEntries(\n`
  + `  Object.entries(EU_WAVE_CORE_ROWS).map(([source, values]) => [source, Object.fromEntries(EU_WAVE_LOCALES.map((locale, index) => [locale, values[index]]))]),\n`
  + `) as Record<string, Record<EuWaveLocale, string>>;\n\n`
  + `export function translateEuWavePhrase(source: string, locale: EuWaveLocale): string {\n`
  + `  return EU_WAVE_CORE_TRANSLATIONS[source]?.[locale] || source;\n`
  + `}\n\n`
  + `export function translateEuWaveRecord<T extends Record<string, string>>(source: T, locale: EuWaveLocale): T {\n`
  + `  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, translateEuWavePhrase(value, locale)])) as T;\n`
  + `}\n\n`
  + `export function translateEuWaveData<T>(source: T, locale: EuWaveLocale): T {\n`
  + `  if (typeof source === "string") return translateEuWavePhrase(source, locale) as T;\n`
  + `  if (Array.isArray(source)) return source.map((item) => translateEuWaveData(item, locale)) as T;\n`
  + `  if (source && typeof source === "object") return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, translateEuWaveData(value, locale)])) as T;\n`
  + `  return source;\n`
  + `}\n`;

const uiOutput = `// Generated by scripts/i18n/generate-eu-wave-translations.mjs.\n`
  + `// Server-side runtime translations for legacy Russian UI phrases.\n\n`
  + `import { EU_WAVE_LOCALES, type EuWaveLocale } from "./euWaveCoreTranslations.ts";\n`
  + `export { EU_WAVE_LOCALES, type EuWaveLocale };\n\n`
  + `const EU_WAVE_ROWS: Record<string, readonly string[]> = ${JSON.stringify(uiRows, null, 2)};\n\n`
  + `export const EU_WAVE_TRANSLATIONS: Record<string, Record<EuWaveLocale, string>> = Object.fromEntries(\n`
  + `  Object.entries(EU_WAVE_ROWS).map(([source, values]) => [source, Object.fromEntries(EU_WAVE_LOCALES.map((locale, index) => [locale, values[index]]))]),\n`
  + `) as Record<string, Record<EuWaveLocale, string>>;\n`;

const publicCardMessageKeys = [
  "carDefault", "dateMissing", "kilometre", "openListing", "photoMissing",
  "promoted", "promotionBoosted", "promotionFeatured", "promotionPremium",
  "savedOn", "sold", "specFuel", "specMileage", "specTransmission", "specYear",
];
const publicCardDetailKeys = ["forSale", "viewsCount", "save", "removeSaved"];
const publicCardLocales = [...SUPPORTED_LOCALES];
const publicCardRows = Object.fromEntries([
  ...publicCardMessageKeys.map((key) => [key, publicCardLocales.map((locale) => getMessages(locale)[key])]),
  ...publicCardDetailKeys.map((key) => [key, publicCardLocales.map((locale) => getDetailMessages(locale)[key])]),
]);
const publicCardBackendRows = Object.fromEntries(
  ["fuel_type", "transmission"].map((field) => [field, BACKEND_VALUE_CATALOG[field].map((item) => ({
    code: item.code,
    aliases: [...new Set([item.code, ...(item.legacy || []), ...Object.values(item.labels)].map((value) => String(value).trim().toLocaleLowerCase("und")))],
    values: publicCardLocales.map((locale) => item.labels[locale] || item.labels.en),
  }))]),
);
const publicCardOutput = `// Generated by scripts/i18n/generate-eu-wave-translations.mjs.\n`
  + `// Minimal client-safe dictionary used by public vehicle cards.\n\n`
  + `const PUBLIC_CARD_LOCALES = ${JSON.stringify(publicCardLocales)} as const;\n`
  + `const PUBLIC_CARD_MESSAGE_KEYS = ${JSON.stringify([...publicCardMessageKeys, ...publicCardDetailKeys])} as const;\n`
  + `type PublicCardMessageKey = typeof PUBLIC_CARD_MESSAGE_KEYS[number];\n`
  + `export type PublicCardMessages = Record<PublicCardMessageKey, string>;\n\n`
  + `const PUBLIC_CARD_ROWS: Record<PublicCardMessageKey, readonly string[]> = ${JSON.stringify(publicCardRows, null, 2)};\n\n`
  + `type PublicCardBackendField = "fuel_type" | "transmission";\n`
  + `const PUBLIC_CARD_BACKEND_ROWS: Record<PublicCardBackendField, ReadonlyArray<{ code: string; aliases: readonly string[]; values: readonly string[] }>> = ${JSON.stringify(publicCardBackendRows, null, 2)};\n\n`
  + `const localeIndex = (locale: string) => { const index = PUBLIC_CARD_LOCALES.indexOf(locale as typeof PUBLIC_CARD_LOCALES[number]); return index >= 0 ? index : PUBLIC_CARD_LOCALES.indexOf("en"); };\n\n`
  + `export function getPublicCardMessages(locale: string): PublicCardMessages {\n`
  + `  const index = localeIndex(locale);\n`
  + `  return Object.fromEntries(PUBLIC_CARD_MESSAGE_KEYS.map((key) => [key, PUBLIC_CARD_ROWS[key][index]])) as PublicCardMessages;\n`
  + `}\n\n`
  + `export function translatePublicCardBackendValue(field: PublicCardBackendField, input: unknown, locale: string): string {\n`
  + `  const raw = String(input ?? "").trim();\n`
  + `  if (!raw) return "";\n`
  + `  const normalized = raw.toLocaleLowerCase("und");\n`
  + `  const item = PUBLIC_CARD_BACKEND_ROWS[field].find((candidate) => candidate.aliases.includes(normalized));\n`
  + `  return item?.values[localeIndex(locale)] || item?.code || raw;\n`
  + `}\n`;

const backendSources = [...new Set(Object.values(BACKEND_VALUE_CATALOG).flatMap((items) => items.map((item) => item.labels.en)))];
const backendRows = Object.fromEntries(backendSources.map((source) => [source, targetLocales.map((locale) => translations[source][locale])]));
const backendValuesOutput = `// Generated by scripts/i18n/generate-eu-wave-translations.mjs.\n`
  + `// Compact translations for canonical backend taxonomy values.\n\n`
  + `export const BACKEND_VALUE_EU_LOCALES = ${JSON.stringify(targetLocales)} as const;\n`
  + `export type BackendValueEuLocale = typeof BACKEND_VALUE_EU_LOCALES[number];\n`
  + `const BACKEND_VALUE_ROWS: Record<string, readonly string[]> = ${JSON.stringify(backendRows, null, 2)};\n\n`
  + `export function translateEuWaveBackendPhrase(source: string, locale: BackendValueEuLocale): string {\n`
  + `  const index = BACKEND_VALUE_EU_LOCALES.indexOf(locale);\n`
  + `  return BACKEND_VALUE_ROWS[source]?.[index] || source;\n`
  + `}\n`;

writeFileSync(coreOutputPath, coreOutput);
writeFileSync(outputPath, uiOutput);
writeFileSync(publicCardOutputPath, publicCardOutput);
writeFileSync(backendValuesOutputPath, backendValuesOutput);
process.stdout.write(`Generated ${Object.keys(coreTranslations).length} core and ${Object.keys(uiTranslations).length} runtime phrases for ${targetLocales.length} EU locales.\n`);
