import { readFileSync } from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node generate-ui-phrase-translations.mjs <phrases.json>");

const phrases = JSON.parse(readFileSync(inputPath, "utf8"));
const targetLocales = ["de", "en", "uk", "ar", "tr"];
// Punctuation-only separators survive the translation endpoint unchanged.
const separator = "|||||";
const batchSize = 18;

async function translateBatch(batch, targetLocale) {
  const query = batch.join(`\n${separator}\n`);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "ru");
  url.searchParams.set("tl", targetLocale);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", query);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const translated = payload[0].map((part) => part[0]).join("");
  const items = translated.split(separator).map((item) => item.trim());
  if (items.length !== batch.length) {
    throw new Error(`Translation batch mismatch for ${targetLocale}: ${items.length}/${batch.length}`);
  }
  return items;
}

const translations = Object.fromEntries(phrases.map((phrase) => [phrase, { ru: phrase }]));
for (const locale of targetLocales) {
  for (let offset = 0; offset < phrases.length; offset += batchSize) {
    const batch = phrases.slice(offset, offset + batchSize);
    const translated = await translateBatch(batch, locale);
    translated.forEach((value, index) => {
      translations[batch[index]][locale] = value;
    });
  }
}

const output = `// Generated from UI literals by scripts/i18n/*. Do not include user or listing content here.\n`
  + `import type { Locale } from "./locales.ts";\n\n`
  + `export const UI_PHRASE_TRANSLATIONS: Record<string, Record<Locale, string>> = ${JSON.stringify(translations, null, 2)};\n`;
process.stdout.write(output);
