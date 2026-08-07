export const TRANSLATION_SOURCE_SCHEMA_VERSION = "listing-i18n-v1";

export type TranslationSourceInput = {
  title?: unknown;
  description?: unknown;
  seo_title?: unknown;
  seo_description?: unknown;
  image_alt_texts?: unknown;
  search_keywords?: unknown;
  source_locale?: unknown;
};

export type TranslationSourceDocument = {
  title: string;
  description: string;
  seo_title: string | null;
  seo_description: string | null;
  image_alt_texts: string[] | null;
  search_keywords: string[] | null;
  source_locale: string;
  schema_version: typeof TRANSLATION_SOURCE_SCHEMA_VERSION;
};

export function normalizeTranslationSourceText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .trim();
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = normalizeTranslationSourceText(value);
  return normalized || null;
}

function normalizeTextList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map(normalizeTranslationSourceText)
    .filter(Boolean);
  return normalized.length ? normalized : null;
}

export function buildTranslationSourceDocument(input: TranslationSourceInput): TranslationSourceDocument {
  return {
    title: normalizeTranslationSourceText(input.title),
    description: normalizeTranslationSourceText(input.description),
    seo_title: normalizeOptionalText(input.seo_title),
    seo_description: normalizeOptionalText(input.seo_description),
    image_alt_texts: normalizeTextList(input.image_alt_texts),
    search_keywords: normalizeTextList(input.search_keywords),
    source_locale: normalizeTranslationSourceText(input.source_locale),
    schema_version: TRANSLATION_SOURCE_SCHEMA_VERSION,
  };
}

export function serializeTranslationSource(input: TranslationSourceInput): string {
  return JSON.stringify(buildTranslationSourceDocument(input));
}

export async function hashTranslationSource(input: TranslationSourceInput): Promise<string> {
  const bytes = new TextEncoder().encode(serializeTranslationSource(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
