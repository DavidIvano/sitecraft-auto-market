import type { Locale } from "./locales.ts";
import { resolveContentLocale } from "./locales.ts";
import { AR_TR_TRANSLATIONS } from "./arTrTranslations.ts";
import {
  EU_WAVE_TRANSLATIONS,
} from "./euWaveTranslations.ts";
import {
  EU_WAVE_LOCALES,
  translateEuWavePhrase,
  type EuWaveLocale,
} from "./euWaveCoreTranslations.ts";
import { FR_TRANSLATIONS } from "./frTranslations.ts";
import { UI_PHRASE_TRANSLATIONS } from "./uiPhraseTranslations.ts";
import { UI_PHRASE_TRANSLATIONS_DYNAMIC } from "./uiPhraseTranslationsDynamic.ts";
import { UI_PHRASE_TRANSLATIONS_SUPPLEMENTAL } from "./uiPhraseTranslationsSupplemental.ts";

const UI_TRANSLATIONS = {
  ...UI_PHRASE_TRANSLATIONS,
  ...UI_PHRASE_TRANSLATIONS_SUPPLEMENTAL,
  ...UI_PHRASE_TRANSLATIONS_DYNAMIC,
};

const SAFE_TRANSLATED_ATTRIBUTES = new Set([
  "alt",
  "aria-label",
  "data-close-label",
  "data-open-label",
  "placeholder",
  "title",
]);

export function getUiPhraseMap(locale: Locale): Record<string, string> {
  const contentLocale = resolveContentLocale(locale);
  if (contentLocale === "ru") return {};
  return Object.fromEntries(
    Object.entries(UI_TRANSLATIONS)
      .map(([source, translations]) => [
        source,
        translations[contentLocale]
          || AR_TR_TRANSLATIONS[source]?.[contentLocale as "ar" | "tr"]
          || (contentLocale === "fr" ? FR_TRANSLATIONS[source] : undefined)
          || EU_WAVE_TRANSLATIONS[source]?.[contentLocale as EuWaveLocale],
      ] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
}

const preserveWhitespace = (value: string, translation: string) => {
  const leading = value.match(/^\s*/u)?.[0] || "";
  const trailing = value.match(/\s*$/u)?.[0] || "";
  return `${leading}${translation}${trailing}`;
};

const euWaveDynamic = (template: string, placeholder: string) => Object.fromEntries(
  EU_WAVE_LOCALES.map((locale) => [
    locale,
    (value: string) => translateEuWavePhrase(template, locale).replaceAll(`{${placeholder}}`, value),
  ]),
);

const translateDynamicValue = (value: string, locale: Locale) => {
  const patterns: Array<[RegExp, Partial<Record<string, (...values: string[]) => string>>]> = [
    [/^(\d+) (?:день|дня|дней)$/u, {
      ...euWaveDynamic("{count} дней", "count"),
      de: (count) => `${count} Tage`, en: (count) => `${count} days`, uk: (count) => `${count} днів`,
      ar: (count) => `${count} أيام`, tr: (count) => `${count} gün`,
      fr: (count) => `${count} jours`,
      nl: (count) => `${count} dagen`, da: (count) => `${count} dage`, sv: (count) => `${count} dagar`, fi: (count) => `${count} päivää`,
      es: (count) => `${count} días`, pt: (count) => `${count} dias`, it: (count) => `${count} giorni`,
    }],
    [/^(\d+) кредит(?:ов|а)?$/u, {
      ...euWaveDynamic("{count} кредитов", "count"),
      de: (count) => `${count} Credits`, en: (count) => `${count} credits`, uk: (count) => `${count} кредитів`,
      ar: (count) => `${count} رصيد`, tr: (count) => `${count} kredi`,
      fr: (count) => `${count} crédits`,
      nl: (count) => `${count} credits`, da: (count) => `${count} kreditter`, sv: (count) => `${count} krediter`, fi: (count) => `${count} krediittiä`,
      es: (count) => `${count} créditos`, pt: (count) => `${count} créditos`, it: (count) => `${count} crediti`,
    }],
    [/^До (\d+) активных объявлений$/u, {
      ...euWaveDynamic("До {count} активных объявлений", "count"),
      de: (count) => `Bis zu ${count} aktive Anzeigen`, en: (count) => `Up to ${count} active listings`, uk: (count) => `До ${count} активних оголошень`,
      ar: (count) => `حتى ${count} إعلانات نشطة`, tr: (count) => `${count} adede kadar aktif ilan`,
      fr: (count) => `Jusqu’à ${count} annonces actives`,
      nl: (count) => `Tot ${count} actieve advertenties`, da: (count) => `Op til ${count} aktive annoncer`, sv: (count) => `Upp till ${count} aktiva annonser`, fi: (count) => `Enintään ${count} aktiivista ilmoitusta`,
      es: (count) => `Hasta ${count} anuncios activos`, pt: (count) => `Até ${count} anúncios ativos`, it: (count) => `Fino a ${count} annunci attivi`,
    }],
    [/^(\d+) AI-кредитов каждый месяц$/u, {
      ...euWaveDynamic("{count} AI-кредитов каждый месяц", "count"),
      de: (count) => `${count} AI-Credits pro Monat`, en: (count) => `${count} AI credits every month`, uk: (count) => `${count} AI-кредитів щомісяця`,
      ar: (count) => `${count} رصيد AI كل شهر`, tr: (count) => `Her ay ${count} AI kredisi`,
      fr: (count) => `${count} crédits IA par mois`,
      nl: (count) => `${count} AI-credits per maand`, da: (count) => `${count} AI-kreditter om måneden`, sv: (count) => `${count} AI-krediter per månad`, fi: (count) => `${count} AI-krediittiä kuukaudessa`,
      es: (count) => `${count} créditos de IA al mes`, pt: (count) => `${count} créditos de IA por mês`, it: (count) => `${count} crediti AI al mese`,
    }],
    [/^Приоритет дилера: (\d+)$/u, {
      ...euWaveDynamic("Приоритет дилера: {count}", "count"),
      de: (count) => `Händlerpriorität: ${count}`, en: (count) => `Dealer priority: ${count}`, uk: (count) => `Пріоритет дилера: ${count}`,
      ar: (count) => `أولوية التاجر: ${count}`, tr: (count) => `Bayi önceliği: ${count}`,
      fr: (count) => `Priorité du concessionnaire : ${count}`,
      nl: (count) => `Dealerprioriteit: ${count}`, da: (count) => `Forhandlerprioritet: ${count}`, sv: (count) => `Återförsäljarprioritet: ${count}`, fi: (count) => `Jälleenmyyjän prioriteetti: ${count}`,
      es: (count) => `Prioridad del concesionario: ${count}`, pt: (count) => `Prioridade do concessionário: ${count}`, it: (count) => `Priorità concessionario: ${count}`,
    }],
    [/^(\d+(?:[.,]\d+)? €) \/ мес\.$/u, {
      ...euWaveDynamic("{price} / мес.", "price"),
      de: (price) => `${price} / Monat`, en: (price) => `${price} / month`, uk: (price) => `${price} / міс.`,
      ar: (price) => `${price} / شهر`, tr: (price) => `${price} / ay`,
      fr: (price) => `${price} / mois`,
      nl: (price) => `${price} / maand`, da: (price) => `${price} / måned`, sv: (price) => `${price} / månad`, fi: (price) => `${price} / kk`,
      es: (price) => `${price} / mes`, pt: (price) => `${price} / mês`, it: (price) => `${price} / mese`,
    }],
  ];
  for (const [pattern, translators] of patterns) {
    const match = value.match(pattern);
    const translator = translators[locale];
    if (match && locale !== "ru" && translator) return translator(...match.slice(1));
  }
  return value;
};

export function translateUiValue(value: string, locale: Locale) {
  const contentLocale = resolveContentLocale(locale);
  if (contentLocale === "ru" || !/[А-Яа-яЁё]/u.test(value)) return value;
  const normalized = value.replace(/\s+/gu, " ").trim();
  const dynamicTranslation = translateDynamicValue(normalized, contentLocale);
  if (dynamicTranslation !== normalized) return preserveWhitespace(value, dynamicTranslation);
  const titleSuffix = " | SiteCraft Auto Market";
  const source = normalized.endsWith(titleSuffix)
    ? normalized.slice(0, -titleSuffix.length)
    : normalized;
  const phraseTranslation = UI_TRANSLATIONS[source]?.[contentLocale]
    || AR_TR_TRANSLATIONS[source]?.[contentLocale as "ar" | "tr"]
    || (contentLocale === "fr" ? FR_TRANSLATIONS[source] : undefined)
    || EU_WAVE_TRANSLATIONS[source]?.[contentLocale as EuWaveLocale];
  const translation = phraseTranslation
    ? `${phraseTranslation}${normalized.endsWith(titleSuffix) ? titleSuffix : ""}`
    : undefined;
  return translation ? preserveWhitespace(value, translation) : value;
}

export function translateUiData<T>(value: T, locale: Locale): T {
  if (typeof value === "string") return translateUiValue(value, locale) as T;
  if (Array.isArray(value)) return value.map((item) => translateUiData(item, locale)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateUiData(item, locale)])) as T;
  }
  return value;
}

const translateTagAttributes = (tag: string, locale: Locale) => {
  if (/^<\/?(?:script|style|code|pre|textarea)\b/iu.test(tag)) return tag;
  const isMeta = /^<meta\b/iu.test(tag);
  return tag.replace(/\b([\w-]+)=("([^"]*)"|'([^']*)')/gu, (match, name, quoted, doubleValue, singleValue) => {
    const normalizedName = String(name).toLowerCase();
    if (!SAFE_TRANSLATED_ATTRIBUTES.has(normalizedName) && !(isMeta && normalizedName === "content")) return match;
    const value = doubleValue ?? singleValue ?? "";
    const translated = translateUiValue(value, locale);
    if (translated === value) return match;
    const quote = quoted[0];
    return `${name}=${quote}${translated}${quote}`;
  });
};

export function translateUiHtml(html: string, locale: Locale) {
  if (locale === "ru") return html;
  const tokens = html.match(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>|[^<]+/giu) || [html];
  const voidElements = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const stack: Array<{ name: string; skip: boolean }> = [];

  return tokens.map((token) => {
    if (/^<(?:script|style)\b/iu.test(token)) return token;
    if (!token.startsWith("<")) {
      return stack.some((entry) => entry.skip) ? token : translateUiValue(token, locale);
    }

    const closeMatch = token.match(/^<\/\s*([\w-]+)/u);
    if (closeMatch) {
      const wasSkipped = stack.some((entry) => entry.skip);
      const index = stack.map((entry) => entry.name).lastIndexOf(closeMatch[1].toLowerCase());
      if (index >= 0) stack.splice(index);
      return wasSkipped ? token : translateTagAttributes(token, locale);
    }

    const openMatch = token.match(/^<\s*([\w-]+)/u);
    if (!openMatch || /^<!|^<\?/u.test(token)) return token;
    const name = openMatch[1].toLowerCase();
    const parentSkipped = stack.some((entry) => entry.skip);
    const skipsTranslation = parentSkipped || /\bdata-i18n-skip(?:\s*=|\s|>)/iu.test(token);
    const translated = skipsTranslation ? token : translateTagAttributes(token, locale);
    if (!voidElements.has(name) && !/\/\s*>$/u.test(token)) {
      stack.push({ name, skip: skipsTranslation });
    }
    return translated;
  }).join("");
}
