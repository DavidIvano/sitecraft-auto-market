export type TranslationLocale = "de" | "en" | "fr" | "tr" | "ar" | "uk"
  | "nl" | "da" | "sv" | "fi" | "es" | "pt" | "it"
  | "pl" | "cs" | "sk" | "sl" | "bg" | "hr" | "ro" | "hu" | "el"
  | "et" | "lv" | "lt" | "mt" | "ga";

export type TranslationWorkerEnv = {
  XANO_API_BASE_URL?: string;
  XANO_TRANSLATION_WORKER_SECRET?: string;
  TRANSLATION_WORKER_TRIGGER_SECRET?: string;
  TRANSLATION_QUEUE_ENABLED?: string;
  TRANSLATION_QUEUE_DRY_RUN?: string;
  TRANSLATION_QUEUE_SCHEDULED_ENABLED?: string;
  TRANSLATION_TARGET_LOCALE?: string;
  TRANSLATION_ALLOWED_LOCALES?: string;
  TRANSLATION_MAX_JOBS_PER_RUN?: string;
  TRANSLATION_SCHEDULED_LOCALES_PER_RUN?: string;
  TRANSLATION_HTTP_TIMEOUT_MS?: string;
};

export type TranslationJob = {
  id: number;
  entity_id: number;
  source_locale: string;
  target_locale: string;
  source_hash: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
};

export type PendingJobsResponse = {
  jobs?: TranslationJob[];
  count?: number;
};

export type ClaimResponse = {
  job?: TranslationJob;
  outcome?: "claimed" | "completed" | "outdated" | "not_public";
  should_translate?: boolean;
};

export type ProviderTranslationResponse = {
  translation?: {
    title?: string;
    description?: string;
  };
  model?: string;
  provider_response_id?: string | null;
};

export type RunOptions = {
  targetLocale: TranslationLocale;
  limit: number;
  dryRun: boolean;
  source: "manual" | "scheduled";
};
