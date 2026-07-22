import type { DealFinderTranslation } from "./types.ts";

export const DEAL_FINDER_TRANSLATION_TARGETS = ["ru"] as const;

export type TranslationQueueDecision = "cached" | "active" | "create";

export function isAllowedTranslationTarget(value: unknown): value is "ru" {
  return typeof value === "string" && DEAL_FINDER_TRANSLATION_TARGETS.includes(value as "ru");
}

export function chooseTranslationQueueAction(
  translations: DealFinderTranslation[],
  sourceTextHash: string,
): { action: TranslationQueueDecision; translation?: DealFinderTranslation } {
  const matching = translations.find((translation) => (
    translation.target_language === "ru" && translation.source_text_hash === sourceTextHash
  ));
  if (matching?.status === "completed") return { action: "cached", translation: matching };
  if (matching?.status === "pending" || matching?.status === "processing") return { action: "active", translation: matching };
  return { action: "create" };
}

export function translationIsStale(translationHash: string, currentDescriptionHash: string) {
  return Boolean(translationHash) && translationHash !== currentDescriptionHash;
}

export function safeTranslationText(value: unknown) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim() : "";
}
