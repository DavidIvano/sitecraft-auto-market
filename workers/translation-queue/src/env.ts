import type { TranslationLocale, TranslationWorkerEnv } from "./types.ts";

const SUPPORTED_LOCALES = new Set<TranslationLocale>([
  "de", "en", "fr", "tr", "ar", "uk",
  "nl", "da", "sv", "fi", "es", "pt", "it",
  "pl", "cs", "sk", "sl", "bg", "hr", "ro", "hu", "el",
  "et", "lv", "lt", "mt", "ga",
]);

const boundedInteger = (value: unknown, fallback: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

export function allowedLocales(env: TranslationWorkerEnv): TranslationLocale[] {
  const requested = String(env.TRANSLATION_ALLOWED_LOCALES || "de,en,fr,tr,ar,uk,nl,da,sv,fi,es,pt,it,pl,cs,sk,sl,bg,hr,ro,hu,el,et,lv,lt,mt,ga")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is TranslationLocale => SUPPORTED_LOCALES.has(value as TranslationLocale));
  return [...new Set(requested)];
}

export function normalizeTargetLocale(value: unknown, env: TranslationWorkerEnv): TranslationLocale | null {
  const locale = String(value || env.TRANSLATION_TARGET_LOCALE || "en").trim().toLowerCase() as TranslationLocale;
  return allowedLocales(env).includes(locale) ? locale : null;
}

export function getTranslationWorkerConfig(env: TranslationWorkerEnv) {
  return {
    enabled: env.TRANSLATION_QUEUE_ENABLED === "true",
    dryRun: env.TRANSLATION_QUEUE_DRY_RUN !== "false",
    scheduledEnabled: env.TRANSLATION_QUEUE_SCHEDULED_ENABLED === "true",
    maxJobsPerRun: boundedInteger(env.TRANSLATION_MAX_JOBS_PER_RUN, 2, 3),
    timeoutMs: boundedInteger(env.TRANSLATION_HTTP_TIMEOUT_MS, 65_000, 90_000),
    configured: Boolean(env.XANO_API_BASE_URL && env.XANO_TRANSLATION_WORKER_SECRET),
  };
}

export function constantTimeSecretEqual(provided: string | null, expected: string | undefined) {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}
