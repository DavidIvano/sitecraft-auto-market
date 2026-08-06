import { writeFileSync } from "node:fs";

import { BACKEND_VALUE_CATALOG } from "../../src/i18n/backendValues.ts";
import { getCatalogMessages } from "../../src/i18n/catalogMessages.ts";
import { getDetailMessages } from "../../src/i18n/detailMessages.ts";
import { getMessages } from "../../src/i18n/messages.ts";
import { UI_PHRASE_TRANSLATIONS } from "../../src/i18n/uiPhraseTranslations.ts";
import { UI_PHRASE_TRANSLATIONS_DYNAMIC } from "../../src/i18n/uiPhraseTranslationsDynamic.ts";
import { UI_PHRASE_TRANSLATIONS_SUPPLEMENTAL } from "../../src/i18n/uiPhraseTranslationsSupplemental.ts";

const outputPath = new URL("../../src/i18n/arTrTranslations.ts", import.meta.url);
const targetLocales = ["ar", "tr"];
const separator = "|||||";
const batchSize = 12;

const backendRussianLabels = Object.values(BACKEND_VALUE_CATALOG)
  .flatMap((items) => items.map((item) => item.labels.ru));
const sources = [...new Set([
  ...Object.keys(UI_PHRASE_TRANSLATIONS),
  ...Object.keys(UI_PHRASE_TRANSLATIONS_DYNAMIC),
  ...Object.keys(UI_PHRASE_TRANSLATIONS_SUPPLEMENTAL),
  ...Object.values(getMessages("ru")),
  ...Object.values(getCatalogMessages("ru")),
  ...Object.values(getDetailMessages("ru")),
  ...backendRussianLabels,
])].sort((left, right) => left.localeCompare(right));

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

async function translateBatch(batch, targetLocale) {
  const protectedItems = batch.map(protectPlaceholders);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "ru");
  url.searchParams.set("tl", targetLocale);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", protectedItems.map((item) => item.protectedValue).join(`\n${separator}\n`));

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`translation request failed: ${response.status}`);
      const payload = await response.json();
      const translated = payload[0].map((part) => part[0]).join("");
      const items = translated.split(separator).map((item) => item.trim());
      if (items.length !== batch.length) {
        throw new Error(`translation batch mismatch for ${targetLocale}: ${items.length}/${batch.length}`);
      }
      return items.map((value, index) => restorePlaceholders(value, protectedItems[index].placeholders));
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

const translations = Object.fromEntries(sources.map((source) => [source, {}]));
for (const locale of targetLocales) {
  for (let offset = 0; offset < sources.length; offset += batchSize) {
    const batch = sources.slice(offset, offset + batchSize);
    const translated = await translateBatch(batch, locale);
    translated.forEach((value, index) => {
      translations[batch[index]][locale] = value;
    });
  }
}

for (const translation of Object.values(translations)) {
  translation.tr = translation.tr
    .replaceAll("Reklam", "İlan")
    .replaceAll("reklam", "ilan");
}

const editorialOverrides = {
  "Главная": { ar: "الرئيسية", tr: "Ana sayfa" },
  "Авто": { ar: "السيارات", tr: "Arabalar" },
  "Автомобили": { ar: "السيارات", tr: "Arabalar" },
  "Кабинет": { ar: "حسابي", tr: "Hesabım" },
  "Продать авто": { ar: "بيع سيارة", tr: "Araba sat" },
  "Тарифы": { ar: "الأسعار", tr: "Fiyatlandırma" },
  "Модерация": { ar: "الإشراف", tr: "Moderasyon" },
  "Приватность": { ar: "الخصوصية", tr: "Gizlilik" },
  "Поддержка": { ar: "الدعم", tr: "Destek" },
  "Войти": { ar: "تسجيل الدخول", tr: "Giriş yap" },
  "Выйти": { ar: "تسجيل الخروج", tr: "Çıkış yap" },
  "Регистрация": { ar: "إنشاء حساب", tr: "Kayıt ol" },
  "Добавить объявление": { ar: "إضافة إعلان", tr: "İlan ekle" },
  "Язык": { ar: "اللغة", tr: "Dil" },
  "Каталог автомобилей": { ar: "كتالوج السيارات", tr: "Araç kataloğu" },
  "Результаты": { ar: "النتائج", tr: "Sonuçlar" },
  "{count} авто": { ar: "{count} سيارة", tr: "{count} araç" },
  "{count} объявл.": { ar: "{count} إعلان", tr: "{count} ilan" },
  "{count} активных объявлений": { ar: "{count} إعلان نشط", tr: "{count} aktif ilan" },
  "Легковой автомобиль": { ar: "سيارة ركوب", tr: "Binek otomobil" },
  "Механика": { ar: "يدوي", tr: "Manuel" },
  "Автомат": { ar: "أوتوماتيكي", tr: "Otomatik" },
  "Коробка": { ar: "ناقل الحركة", tr: "Şanzıman" },
  "Б/у": { ar: "مستعملة", tr: "İkinci el" },
  "Бензин": { ar: "بنزين", tr: "Benzin" },
  "Город": { ar: "المدينة", tr: "Şehir" },
  "Год": { ar: "السنة", tr: "Yıl" },
  "Пробег": { ar: "المسافة المقطوعة", tr: "Kilometre" },
  "Топливо": { ar: "الوقود", tr: "Yakıt" },
  "Цена": { ar: "السعر", tr: "Fiyat" },
  "Описание автомобиля": { ar: "وصف السيارة", tr: "Araç açıklaması" },
  "Связаться с продавцом": { ar: "اتصل بالبائع", tr: "Satıcıyla iletişime geç" },
  "Смотреть объявления": { ar: "عرض الإعلانات", tr: "İlanları görüntüle" },
  "{brand} {model} {year} купить в {city}": { ar: "شراء {brand} {model} {year} في {city}", tr: "{city} konumunda {brand} {model} {year} satın al" },
  "Премиальная доска объявлений авто": { ar: "سوق سيارات مميز", tr: "Premium otomobil ilan platformu" },
  "Купите или продайте авто быстрее с AI-помощником": { ar: "اشترِ أو بِع سيارة بشكل أسرع بمساعدة الذكاء الاصطناعي", tr: "Yapay zekâ asistanıyla daha hızlı araba alın veya satın" },
  "Создать объявление по фото": { ar: "إنشاء إعلان من صورة", tr: "Fotoğraftan ilan oluştur" },
  "Подобрать авто с AI": { ar: "ابحث عن سيارة بالذكاء الاصطناعي", tr: "Yapay zekâ ile araba bul" },
  "AI помогает с данными объявления, но финальную информацию подтверждает продавец.": { ar: "يساعد الذكاء الاصطناعي في بيانات الإعلان، لكن البائع يؤكد المعلومات النهائية.", tr: "Yapay zekâ ilan verilerine yardımcı olur; son bilgileri satıcı onaylar." },
  "Премиум": { ar: "مميز", tr: "Premium" },
  "Электро": { ar: "كهربائية", tr: "Elektrikli" },
  "Понятно": { ar: "حسنًا", tr: "Anladım" },
  "Cookie и приватность": { ar: "ملفات تعريف الارتباط والخصوصية", tr: "Çerezler ve gizlilik" },
  "Подробнее": { ar: "المزيد من التفاصيل", tr: "Daha fazla bilgi" },
  "Неважно": { ar: "أي خيار", tr: "Fark etmez" },
};
Object.assign(translations, editorialOverrides);

const output = `// Generated by scripts/i18n/generate-ar-tr-translations.mjs.\n`
  + `// Contains interface and taxonomy text only; never add user or listing content.\n\n`
  + `export type ArTrLocale = "ar" | "tr";\n\n`
  + `export const AR_TR_TRANSLATIONS: Record<string, Record<ArTrLocale, string>> = ${JSON.stringify(translations, null, 2)};\n\n`
  + `export function translateArTrPhrase(source: string, locale: ArTrLocale): string {\n`
  + `  return AR_TR_TRANSLATIONS[source]?.[locale] || source;\n`
  + `}\n\n`
  + `export function translateArTrRecord<T extends Record<string, string>>(source: T, locale: ArTrLocale): T {\n`
  + `  return Object.fromEntries(\n`
  + `    Object.entries(source).map(([key, value]) => [key, translateArTrPhrase(value, locale)]),\n`
  + `  ) as T;\n`
  + `}\n`;

writeFileSync(outputPath, output);
process.stdout.write(`Generated ${sources.length} Arabic/Turkish interface translations.\n`);
