import type { Locale } from "./locales.ts";
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
  if (locale === "ru") return {};
  return Object.fromEntries(
    Object.entries(UI_TRANSLATIONS)
      .map(([source, translations]) => [source, translations[locale]] as const)
      .filter(([, translation]) => Boolean(translation)),
  );
}

const preserveWhitespace = (value: string, translation: string) => {
  const leading = value.match(/^\s*/u)?.[0] || "";
  const trailing = value.match(/\s*$/u)?.[0] || "";
  return `${leading}${translation}${trailing}`;
};

const translateDynamicValue = (value: string, locale: Locale) => {
  const patterns: Array<[RegExp, Record<Exclude<Locale, "ru">, (...values: string[]) => string>]> = [
    [/^(\d+) (?:день|дня|дней)$/u, {
      de: (count) => `${count} Tage`, en: (count) => `${count} days`, uk: (count) => `${count} днів`,
    }],
    [/^(\d+) кредит(?:ов|а)?$/u, {
      de: (count) => `${count} Credits`, en: (count) => `${count} credits`, uk: (count) => `${count} кредитів`,
    }],
    [/^До (\d+) активных объявлений$/u, {
      de: (count) => `Bis zu ${count} aktive Anzeigen`, en: (count) => `Up to ${count} active listings`, uk: (count) => `До ${count} активних оголошень`,
    }],
    [/^(\d+) AI-кредитов каждый месяц$/u, {
      de: (count) => `${count} AI-Credits pro Monat`, en: (count) => `${count} AI credits every month`, uk: (count) => `${count} AI-кредитів щомісяця`,
    }],
    [/^Приоритет дилера: (\d+)$/u, {
      de: (count) => `Händlerpriorität: ${count}`, en: (count) => `Dealer priority: ${count}`, uk: (count) => `Пріоритет дилера: ${count}`,
    }],
    [/^(\d+(?:[.,]\d+)? €) \/ мес\.$/u, {
      de: (price) => `${price} / Monat`, en: (price) => `${price} / month`, uk: (price) => `${price} / міс.`,
    }],
  ];
  for (const [pattern, translators] of patterns) {
    const match = value.match(pattern);
    if (match && locale !== "ru") return translators[locale](...match.slice(1));
  }
  return value;
};

export function translateUiValue(value: string, locale: Locale) {
  if (locale === "ru" || !/[А-Яа-яЁё]/u.test(value)) return value;
  const normalized = value.replace(/\s+/gu, " ").trim();
  const dynamicTranslation = translateDynamicValue(normalized, locale);
  if (dynamicTranslation !== normalized) return preserveWhitespace(value, dynamicTranslation);
  const titleSuffix = " | SiteCraft Auto Market";
  const source = normalized.endsWith(titleSuffix)
    ? normalized.slice(0, -titleSuffix.length)
    : normalized;
  const phraseTranslation = UI_TRANSLATIONS[source]?.[locale];
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
