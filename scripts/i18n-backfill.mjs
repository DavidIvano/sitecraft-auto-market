import { pathToFileURL } from "node:url";
import { hashTranslationSource } from "../src/i18n/sourceHash.ts";
import { mapLegacyVehicleValue } from "../src/migrations/legacyVehicleValueMap.ts";

export const MIGRATION_VERSION = "stage10-release-2-2-v1";
const TABLES = {
  listings: 861468,
  locales: 873236,
  translations: 873240,
  jobs: 873241,
  logs: 873242,
};
const TAXONOMY_FIELDS = [
  "vehicle_type",
  "body_type",
  "fuel_type",
  "transmission",
  "drivetrain",
  "color",
  "vehicle_condition",
  "seller_type",
];
const SUPPORTED_LOCALES = new Set(["de", "en", "ru", "uk", "zh-Hans"]);
const DETECTION_THRESHOLD = 0.75;

export function parseBackfillArgs(argv) {
  const options = {
    apply: false,
    dryRun: true,
    limit: 10,
    batchSize: 10,
    resumeCursor: 0,
    listingIds: [],
  };

  for (const argument of argv) {
    if (argument === "--apply") {
      options.apply = true;
      options.dryRun = false;
    } else if (argument === "--dry-run") {
      options.apply = false;
      options.dryRun = true;
    } else if (argument.startsWith("--limit=")) {
      options.limit = Number(argument.slice("--limit=".length));
    } else if (argument.startsWith("--batch-size=")) {
      options.batchSize = Number(argument.slice("--batch-size=".length));
    } else if (argument.startsWith("--resume-cursor=")) {
      options.resumeCursor = Number(argument.slice("--resume-cursor=".length));
    } else if (argument.startsWith("--listing-ids=")) {
      options.listingIds = argument.slice("--listing-ids=".length)
        .split(",")
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0);
    } else if (argument) {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100");
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 25) {
    throw new Error("--batch-size must be an integer from 1 to 25");
  }
  if (!Number.isInteger(options.resumeCursor) || options.resumeCursor < 0) {
    throw new Error("--resume-cursor must be a non-negative integer");
  }
  return options;
}

const normalizeDetectionText = (value) => String(value ?? "")
  .normalize("NFC")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim();

export function detectListingSourceLocale(listing) {
  const explicit = String(listing.source_locale ?? "").trim();
  if (SUPPORTED_LOCALES.has(explicit)) {
    return { locale: explicit, score: 1, method: "stored_source_locale", needsReview: false };
  }

  const text = normalizeDetectionText(`${listing.title ?? ""} ${listing.description ?? ""}`);
  const letters = [...text].filter((character) => /\p{L}/u.test(character));
  if (!letters.length) {
    return { locale: null, score: 0, method: "insufficient_text", needsReview: true };
  }

  const words = new Set(text.split(/\s+/).filter(Boolean));
  const cyrillic = letters.filter((character) => /\p{Script=Cyrillic}/u.test(character)).length / letters.length;
  const han = letters.filter((character) => /\p{Script=Han}/u.test(character)).length / letters.length;
  const hasUkrainianLetters = /[іїєґ]/u.test(text);
  const hasRussianLetters = /[ыэъё]/u.test(text);
  const germanMarkers = ["der", "die", "das", "und", "fahrzeug", "verkaufe", "wagen", "tüv", "automatik"];
  const englishMarkers = ["the", "and", "vehicle", "selling", "car", "automatic", "mileage"];
  const germanHits = germanMarkers.filter((word) => words.has(word)).length;
  const englishHits = englishMarkers.filter((word) => words.has(word)).length;

  let result = { locale: null, score: 0.5, method: "language_detection", needsReview: true };
  if (han >= 0.35) result = { locale: "zh-Hans", score: Math.min(0.99, 0.75 + han / 4), method: "script_detection", needsReview: false };
  else if (cyrillic >= 0.35 && hasUkrainianLetters) result = { locale: "uk", score: 0.9, method: "script_and_marker_detection", needsReview: false };
  else if (cyrillic >= 0.35 && hasRussianLetters) result = { locale: "ru", score: 0.9, method: "script_and_marker_detection", needsReview: false };
  else if (cyrillic >= 0.35) result = { locale: null, score: 0.65, method: "ambiguous_cyrillic", needsReview: true };
  else if (germanHits >= 2 || /[äöüß]/u.test(text)) result = { locale: "de", score: Math.min(0.95, 0.78 + germanHits * 0.04), method: "marker_detection", needsReview: false };
  else if (englishHits >= 2) result = { locale: "en", score: Math.min(0.92, 0.76 + englishHits * 0.04), method: "marker_detection", needsReview: false };

  return { ...result, needsReview: result.needsReview || result.score < DETECTION_THRESHOLD };
}

export function normalizeListingTaxonomy(listing) {
  const normalizedValues = {};
  const warnings = [];
  for (const field of TAXONOMY_FIELDS) {
    const result = mapLegacyVehicleValue(field, listing[field]);
    if (result.code) normalizedValues[field] = result.code;
    if (result.migration_status === "needs_review") {
      warnings.push({ field, legacy_value: result.legacy_value, code: "unknown_legacy_enum" });
    }
  }
  return { normalizedValues, warnings };
}

export async function buildBackfillPlan(listing, activeLocales, state = {}) {
  const detection = detectListingSourceLocale(listing);
  const taxonomy = normalizeListingTaxonomy(listing);
  const existingTranslations = state.translations ?? [];
  const existingJobs = state.jobs ?? [];
  const existingLog = state.log ?? null;

  if (!detection.locale || detection.needsReview) {
    return {
      listingId: Number(listing.id),
      sourceLocale: detection.locale,
      detectionMethod: detection.method,
      detectionScore: detection.score,
      sourceHash: null,
      translationVersion: Number(listing.translation_version) || 0,
      originalAction: "skipped",
      jobActions: [],
      normalizedValues: taxonomy.normalizedValues,
      warnings: [{ field: "source_locale", code: "low_language_confidence" }, ...taxonomy.warnings],
      migrationStatus: "needs_review",
      logAction: existingLog ? "update" : "create",
    };
  }

  const sourceHash = await hashTranslationSource({
    title: listing.title,
    description: listing.description,
    seo_title: listing.seo_title,
    seo_description: listing.seo_description,
    image_alt_texts: listing.image_alt_texts,
    search_keywords: listing.search_keywords,
    source_locale: detection.locale,
  });
  const oldHash = String(listing.translation_source_hash ?? "").trim();
  const hashChanged = oldHash !== sourceHash;
  const taxonomyChanged = Object.entries(taxonomy.normalizedValues)
    .some(([field, value]) => listing[field] !== value);
  const translationVersion = oldHash
    ? (hashChanged ? Math.max(1, Number(listing.translation_version) || 1) + 1 : Math.max(1, Number(listing.translation_version) || 1))
    : 1;
  const original = existingTranslations.find((row) => (
    Number(row.car_listing_id) === Number(listing.id)
    && row.locale_code === detection.locale
  ));
  const originalAction = !original ? "create" : original.source_hash === sourceHash ? "no_changes" : "update";
  const jobActions = activeLocales
    .filter((locale) => locale !== detection.locale)
    .map((targetLocale) => {
      const idempotencyKey = `car_listing:${listing.id}:${targetLocale}:${sourceHash}`;
      return {
        targetLocale,
        idempotencyKey,
        action: existingJobs.some((job) => job.idempotency_key === idempotencyKey) ? "no_changes" : "create",
      };
    });
  const staleTranslationIds = existingTranslations
    .filter((row) => row.locale_code !== detection.locale && row.source_hash !== sourceHash)
    .map((row) => Number(row.id))
    .filter(Number.isInteger);
  const staleJobIds = existingJobs
    .filter((job) => job.source_hash !== sourceHash && ["pending", "processing"].includes(job.status))
    .map((job) => Number(job.id))
    .filter(Number.isInteger);
  const warnings = taxonomy.warnings;
  const migrationStatus = warnings.length ? "needs_review" : hashChanged || taxonomyChanged || originalAction !== "no_changes" || jobActions.some((job) => job.action === "create")
    ? "updated"
    : "already_migrated";

  return {
    listingId: Number(listing.id),
    sourceLocale: detection.locale,
    detectionMethod: detection.method,
    detectionScore: detection.score,
    sourceHash,
    translationVersion,
    originalAction,
    jobActions,
    normalizedValues: taxonomy.normalizedValues,
    warnings,
    migrationStatus,
    hashChanged,
    taxonomyChanged,
    staleTranslationIds,
    staleJobIds,
    logAction: existingLog ? "update" : "create",
  };
}

class XanoMetadataClient {
  constructor({ baseUrl, workspaceId, token }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.workspaceId = workspaceId;
    this.token = token;
  }

  contentUrl(tableId, suffix = "") {
    return `${this.baseUrl}/workspace/${this.workspaceId}/table/${tableId}/content${suffix}`;
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(`Xano metadata request failed with HTTP ${response.status}`);
    return data;
  }

  async list(tableId, perPage = 100) {
    const items = [];
    let page = 1;
    while (page) {
      const result = await this.request(this.contentUrl(tableId, `?per_page=${perPage}&page=${page}`));
      items.push(...(Array.isArray(result?.items) ? result.items : []));
      page = result?.nextPage || 0;
    }
    return items;
  }

  create(tableId, data) {
    return this.request(this.contentUrl(tableId), { method: "POST", body: JSON.stringify(data) });
  }

  update(tableId, id, data) {
    return this.request(this.contentUrl(tableId, `/${id}`), { method: "PUT", body: JSON.stringify(data) });
  }
}

function groupByEntity(rows, field) {
  const grouped = new Map();
  for (const row of rows) {
    const key = Number(row[field]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

async function applyPlan(client, listing, plan, state, activeLocales) {
  const now = new Date().toISOString();
  if (!plan.sourceLocale) {
    const logData = {
      updated_at: now,
      entity_type: "car_listing",
      entity_id: plan.listingId,
      migration_version: MIGRATION_VERSION,
      status: "needs_review",
      source_locale: null,
      normalized_values: { source_locale_detection_method: plan.detectionMethod, language_detection_score: plan.detectionScore },
      warnings: plan.warnings,
      completed_at: now,
    };
    return state.log ? client.update(TABLES.logs, state.log.id, logData) : client.create(TABLES.logs, { ...logData, created_at: now, started_at: now });
  }

  if (plan.hashChanged || plan.taxonomyChanged || !listing.translation_source_hash) {
    await client.update(TABLES.listings, listing.id, {
      ...plan.normalizedValues,
      source_locale: plan.sourceLocale,
      translation_source_hash: plan.sourceHash,
      translation_version: plan.translationVersion,
      translations_ready: false,
      translation_updated_at: now,
    });
  }

  const originalData = {
    updated_at: now,
    car_listing_id: listing.id,
    locale_code: plan.sourceLocale,
    title: String(listing.title ?? "").trim(),
    description: String(listing.description ?? "").trim(),
    seo_title: listing.seo_title || null,
    seo_description: listing.seo_description || null,
    image_alt_texts: listing.image_alt_texts || null,
    search_keywords: listing.search_keywords || null,
    translation_status: "original",
    translation_source: "original",
    source_locale: plan.sourceLocale,
    source_hash: plan.sourceHash,
    language_detection_score: plan.detectionScore,
  };
  const existingOriginal = state.translations.find((row) => row.locale_code === plan.sourceLocale);
  if (plan.originalAction === "create") await client.create(TABLES.translations, { ...originalData, created_at: now });
  else if (plan.originalAction === "update") await client.update(TABLES.translations, existingOriginal.id, originalData);

  for (const translationId of plan.staleTranslationIds) {
    await client.update(TABLES.translations, translationId, {
      updated_at: now,
      translation_status: "outdated",
    });
  }
  for (const jobId of plan.staleJobIds) {
    await client.update(TABLES.jobs, jobId, {
      updated_at: now,
      status: "outdated",
    });
  }

  for (const locale of activeLocales) {
    if (locale === plan.sourceLocale) continue;
    const action = plan.jobActions.find((job) => job.targetLocale === locale);
    if (!action || action.action !== "create") continue;
    await client.create(TABLES.jobs, {
      created_at: now,
      updated_at: now,
      entity_type: "car_listing",
      entity_id: listing.id,
      source_locale: plan.sourceLocale,
      target_locale: locale,
      source_hash: plan.sourceHash,
      idempotency_key: action.idempotencyKey,
      status: "pending",
      priority: 0,
      attempt_count: 0,
      max_attempts: 3,
    });
  }

  const logData = {
    updated_at: now,
    entity_type: "car_listing",
    entity_id: listing.id,
    migration_version: MIGRATION_VERSION,
    status: plan.migrationStatus,
    source_locale: plan.sourceLocale,
    legacy_values: Object.fromEntries(TAXONOMY_FIELDS.map((field) => [field, listing[field] ?? null])),
    normalized_values: { ...plan.normalizedValues, source_locale_detection_method: plan.detectionMethod, language_detection_score: plan.detectionScore },
    translations_created: plan.jobActions.filter((job) => job.action === "create").map((job) => job.targetLocale),
    warnings: plan.warnings,
    completed_at: now,
  };
  return state.log ? client.update(TABLES.logs, state.log.id, logData) : client.create(TABLES.logs, { ...logData, created_at: now, started_at: now });
}

export async function runBackfill(options, env = process.env) {
  const required = ["XANO_META_TOKEN", "XANO_INSTANCE_META_URL", "XANO_WORKSPACE_ID"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing required environment: ${missing.join(", ")}`);
  const client = new XanoMetadataClient({
    token: env.XANO_META_TOKEN,
    baseUrl: env.XANO_INSTANCE_META_URL,
    workspaceId: env.XANO_WORKSPACE_ID,
  });
  const [allListings, localeRows, translations, jobs, logs] = await Promise.all([
    client.list(TABLES.listings, options.batchSize),
    client.list(TABLES.locales, 20),
    client.list(TABLES.translations),
    client.list(TABLES.jobs),
    client.list(TABLES.logs),
  ]);
  const requestedIds = new Set(options.listingIds);
  const listings = allListings
    .filter((listing) => Number(listing.id) > options.resumeCursor)
    .filter((listing) => !requestedIds.size || requestedIds.has(Number(listing.id)))
    .sort((left, right) => Number(left.id) - Number(right.id))
    .slice(0, options.limit);
  const activeLocales = localeRows.filter((locale) => locale.is_active === true).map((locale) => locale.code);
  const translationsByListing = groupByEntity(translations, "car_listing_id");
  const jobsByListing = groupByEntity(jobs.filter((job) => job.entity_type === "car_listing"), "entity_id");
  const logByListing = new Map(logs
    .filter((log) => log.entity_type === "car_listing" && log.migration_version === MIGRATION_VERSION)
    .map((log) => [Number(log.entity_id), log]));
  const results = [];

  for (const listing of listings) {
    const state = {
      translations: translationsByListing.get(Number(listing.id)) || [],
      jobs: jobsByListing.get(Number(listing.id)) || [],
      log: logByListing.get(Number(listing.id)) || null,
    };
    try {
      const plan = await buildBackfillPlan(listing, activeLocales, state);
      if (options.apply) await applyPlan(client, listing, plan, state, activeLocales);
      results.push(plan);
    } catch (error) {
      results.push({ listingId: Number(listing.id), migrationStatus: "failed", error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return {
    mode: options.apply ? "apply" : "dry-run",
    migrationVersion: MIGRATION_VERSION,
    selected: results.length,
    completed: results.filter((result) => ["updated", "already_migrated"].includes(result.migrationStatus)).length,
    needsReview: results.filter((result) => result.migrationStatus === "needs_review").length,
    failed: results.filter((result) => result.migrationStatus === "failed").length,
    nextCursor: results.at(-1)?.listingId || options.resumeCursor,
    results: results.map((result) => ({
      listing_id: result.listingId,
      source_locale: result.sourceLocale ?? null,
      detection_method: result.detectionMethod ?? null,
      detection_score: result.detectionScore ?? null,
      source_hash: result.sourceHash ?? null,
      translation_version: result.translationVersion ?? null,
      original_translation: result.originalAction ?? null,
      created_jobs: result.jobActions?.filter((job) => job.action === "create").map((job) => job.targetLocale) ?? [],
      outdated_translations: result.staleTranslationIds?.length ?? 0,
      outdated_jobs: result.staleJobIds?.length ?? 0,
      normalized_enums: result.normalizedValues ?? {},
      warnings: result.warnings ?? [],
      migration_status: result.migrationStatus,
      error: result.error ?? null,
    })),
  };
}

async function main() {
  const options = parseBackfillArgs(process.argv.slice(2));
  const report = await runBackfill(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
