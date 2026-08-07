import { de } from "./dictionaries/de.ts";
import { en } from "./dictionaries/en.ts";
import { ru } from "./dictionaries/ru.ts";
import { uk } from "./dictionaries/uk.ts";
import { zhHans } from "./dictionaries/zh-Hans.ts";
import { getLocaleFallbackChain } from "./locale.ts";

export type UiDictionary = Readonly<Record<string, string>>;

const dictionaries = new Map<string, UiDictionary>([
  ["de", de],
  ["en", en],
  ["ru", ru],
  ["uk", uk],
  ["zh-Hans", zhHans],
]);

export function registerDictionary(locale: string, dictionary: UiDictionary) {
  dictionaries.set(locale, Object.freeze({ ...dictionary }));
}

export function translate(
  locale: string,
  key: string,
  parameters: Record<string, string | number> = {},
) {
  let message = "";
  for (const candidate of getLocaleFallbackChain(locale)) {
    message = dictionaries.get(candidate)?.[key] || "";
    if (message) break;
  }
  if (!message) return key;

  return Object.entries(parameters).reduce(
    (output, [name, value]) => output.replaceAll(`{${name}}`, String(value)),
    message,
  );
}

export const t = translate;
