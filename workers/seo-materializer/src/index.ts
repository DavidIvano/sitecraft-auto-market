import { constantTimeSecretEqual, getSeoMaterializerConfig } from "./env.ts";
import { buildMaterializedRows, resolveLocalizedListings } from "./materialize.ts";
import type { MaterializedRows, MaterializerListing, SeoMaterializerEnv, SnapshotTranslation } from "./types.ts";
import {
  activateGeneration,
  checkpointJobs,
  claimJobs,
  failJobs,
  loadSnapshotPage,
  SeoMaterializerXanoError,
  stageFacets,
  stageRows,
} from "./xano-client.ts";

const MAX_STAGE_TASKS_PER_RUN = 36;

const json = (value: Record<string, unknown>, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const chunks = <T>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");

export async function buildMaterializerGeneration(snapshot: {
  listings: MaterializerListing[];
  translations: SnapshotTranslation[];
  locales: string[];
}) {
  const identity = {
    locales: [...snapshot.locales].sort(),
    listings: [...snapshot.listings]
      .sort((left, right) => Number(left.id) - Number(right.id))
      .map((row) => [row.id, row.status, row.moderation_status, row.translation_source_hash, row.translation_version, row.updated_at]),
    translations: [...snapshot.translations]
      .sort((left, right) => left.car_listing_id - right.car_listing_id || left.locale_code.localeCompare(right.locale_code))
      .map((row) => [row.car_listing_id, row.locale_code, row.source_hash, row.translation_status, row.updated_at, row.title, row.description]),
  };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(identity)));
  return `seo-${hex(digest).slice(0, 32)}`;
}
const runBounded = async (tasks: Array<() => Promise<unknown>>, concurrency: number, delayMs: number) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      if (task) {
        await task();
        if (cursor < tasks.length) await sleep(delayMs);
      }
    }
  });
  await Promise.all(runners);
};

export function evaluateMaterializerParity(
  locales: string[],
  expectedListingsPerLocale: number,
  listingIndex: Record<string, unknown>[],
) {
  const listingsPerLocale = Object.fromEntries(locales.map((locale) => [
    locale,
    listingIndex.filter((row) => row.locale_code === locale).length,
  ]));
  const releaseReady = locales.length === 28
    && expectedListingsPerLocale > 0
    && locales.every((locale) => listingsPerLocale[locale] === expectedListingsPerLocale);
  return {
    release_ready: releaseReady,
    expected_listings_per_locale: expectedListingsPerLocale,
    listings_per_locale: listingsPerLocale,
  };
}

export function resolveMaterializerCursor(
  jobs: Array<{ materialization_generation?: string; materialization_cursor?: number }>,
  generation: string,
) {
  if (!jobs.length || jobs.some((job) => job.materialization_generation !== generation)) return 0;
  return Math.min(...jobs.map((job) => Math.max(0, Math.trunc(Number(job.materialization_cursor) || 0))));
}

async function loadSnapshot(env: SeoMaterializerEnv, limit: number, timeoutMs: number) {
  const listings: MaterializerListing[] = [];
  const translations: SnapshotTranslation[] = [];
  let locales: string[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const payload = await loadSnapshotPage(env, page, limit, timeoutMs);
    listings.push(...payload.listings);
    translations.push(...payload.translations);
    locales = [...new Set([...locales, ...payload.locales])].sort();
    totalPages = Number(payload.pagination.total_pages);
    if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 100_000) throw new SeoMaterializerXanoError("INVALID_SNAPSHOT_PAGINATION", 502);
    page += 1;
  } while (page <= totalPages);
  if (locales.length !== 28) throw new SeoMaterializerXanoError("LOCALE_PARITY_INCOMPLETE", 409);
  return { listings, translations, locales };
}

async function uploadGeneration(
  env: SeoMaterializerEnv,
  rows: MaterializedRows,
  generation: string,
  batchSize: number,
  concurrency: number,
  requestDelayMs: number,
  timeoutMs: number,
  startCursor: number,
) {
  const facetIds = new Map<string, number>();
  for (const batch of chunks(rows.facets, batchSize)) {
    // Xano treats a missing JSON property differently from an explicit null.
    // Normalize every optional facet field before the bounded batch call.
    const normalizedBatch = batch.map((row) => ({
      key: row.key,
      taxonomy_type: row.taxonomy_type,
      slug: row.slug,
      parent_slug: row.parent_slug ?? null,
      label: row.label,
      region_slug: row.region_slug ?? null,
      code: row.code ?? null,
      price_min: row.price_min ?? null,
      price_max: row.price_max ?? null,
      price_max_exclusive: row.price_max_exclusive ?? true,
    }));
    const staged = await stageFacets(env, generation, normalizedBatch, timeoutMs);
    for (const item of staged.items) facetIds.set(item.key, item.id);
  }
  if (facetIds.size !== rows.facets.length) throw new SeoMaterializerXanoError("FACET_ID_MAP_INCOMPLETE", 502);
  const resolveFacetIds = (values: Record<string, unknown>[]) => values.map((row) => {
    const result = { ...row };
    if (result.facet_key) {
      result.facet_id = facetIds.get(String(result.facet_key));
      delete result.facet_key;
    }
    if (result.source_facet_key) {
      result.source_facet_id = facetIds.get(String(result.source_facet_key));
      delete result.source_facet_key;
    }
    if (result.related_facet_key) {
      result.related_facet_id = facetIds.get(String(result.related_facet_key));
      delete result.related_facet_key;
    }
    return result;
  });
  const sets: [string, Record<string, unknown>[]][] = [
    ["listing_index", rows.listing_index],
    ["edges", resolveFacetIds(rows.edges)],
    ["stats", resolveFacetIds(rows.stats)],
    ["related", resolveFacetIds(rows.related)],
    ["manifests", rows.manifests],
  ];
  const tasks = sets.flatMap(([kind, values]) => chunks(values, batchSize).map((batch, batchIndex) => (
    async () => {
      try {
        await stageRows(env, generation, kind, batch, timeoutMs);
      } catch (error) {
        if (error instanceof SeoMaterializerXanoError) {
          throw new SeoMaterializerXanoError(`${error.code}:${kind}:${batchIndex}`, error.status);
        }
        throw error;
      }
    }
  )));
  const cursor = Math.max(0, Math.min(Math.trunc(startCursor), tasks.length));
  const selectedTasks = tasks.slice(cursor, cursor + MAX_STAGE_TASKS_PER_RUN);
  await runBounded(selectedTasks, concurrency, requestDelayMs);
  const nextCursor = cursor + selectedTasks.length;
  return { cursor, nextCursor, totalTasks: tasks.length, complete: nextCursor >= tasks.length };
}

export async function runSeoMaterializer(env: SeoMaterializerEnv, options: { dryRun: boolean }) {
  const config = getSeoMaterializerConfig(env);
  if (!config.configured) return { ok: false, code: "CONFIGURATION_ERROR" };
  if (!options.dryRun && (!config.enabled || config.dryRun)) return { ok: false, code: "LIVE_PROCESSING_DISABLED" };
  const workerId = `seo-materializer:${crypto.randomUUID()}`;
  const claimed = await claimJobs(env, workerId, config.timeoutMs);
  const jobs = Array.isArray(claimed.jobs) ? claimed.jobs : [];
  if (!jobs.length) return { ok: true, processed: 0, outcome: "idle" };
  const jobIds = jobs.map((job) => Number(job.id)).filter(Number.isInteger);
  try {
    const snapshot = await loadSnapshot(env, config.batchSize, config.timeoutMs);
    const generation = await buildMaterializerGeneration(snapshot);
    const localized = resolveLocalizedListings(snapshot.listings, snapshot.translations, snapshot.locales);
    const materialized = buildMaterializedRows({ generation, localized });
    const parity = evaluateMaterializerParity(snapshot.locales, snapshot.listings.length, materialized.listing_index);
    const report = {
      generation,
      jobs: jobIds.length,
      locales: snapshot.locales.length,
      listings: snapshot.listings.length,
      listing_locale_rows: materialized.listing_index.length,
      facets: materialized.facets.length,
      edges: materialized.edges.length,
      stats: materialized.stats.length,
      related: materialized.related.length,
      manifests: materialized.manifests.length,
      quality: materialized.quality,
      parity,
    };
    if (options.dryRun) {
      await failJobs(env, jobIds, "DRY_RUN_RELEASED", config.timeoutMs);
      return { ok: true, dry_run: true, processed: jobs.length, ...report };
    }
    if (!parity.release_ready) throw new SeoMaterializerXanoError("LOCALE_LISTING_PARITY_INCOMPLETE", 409);
    const startCursor = resolveMaterializerCursor(jobs, generation);
    const progress = await uploadGeneration(
      env,
      materialized,
      generation,
      config.batchSize,
      config.concurrency,
      config.requestDelayMs,
      config.timeoutMs,
      startCursor,
    );
    if (!progress.complete) {
      await checkpointJobs(env, jobIds, generation, progress.nextCursor, config.timeoutMs);
      return {
        ok: true,
        processed: jobs.length,
        outcome: "checkpoint",
        progress,
        ...report,
      };
    }
    await activateGeneration(env, {
      generation,
      job_ids: jobIds,
      expected: {
        listing_index: materialized.listing_index.length,
        facets: materialized.facets.length,
        edges: materialized.edges.length,
        stats: materialized.stats.length,
        related: materialized.related.length,
        manifests: materialized.manifests.length,
        locales: snapshot.locales.length,
      },
    }, config.timeoutMs);
    return { ok: true, processed: jobs.length, outcome: "activated", progress, ...report };
  } catch (error) {
    const code = error instanceof SeoMaterializerXanoError ? error.code : "SEO_MATERIALIZER_ERROR";
    await failJobs(env, jobIds, code, config.timeoutMs).catch(() => undefined);
    return { ok: false, code, processed: jobs.length };
  }
}

export async function handleRequest(request: Request, env: SeoMaterializerEnv) {
  const url = new URL(request.url);
  const config = getSeoMaterializerConfig(env);
  if (url.pathname === "/health") return json({
    ok: true,
    service: "sitecraft-seo-materializer",
    configured: config.configured,
    enabled: config.enabled,
    dry_run: config.dryRun,
    scheduled_enabled: config.scheduledEnabled,
  });
  if (url.pathname !== "/run") return json({ ok: false, code: "NOT_FOUND" }, 404);
  if (request.method !== "POST") return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
  if (!constantTimeSecretEqual(request.headers.get("X-Seo-Materializer-Trigger-Secret"), env.SEO_MATERIALIZER_TRIGGER_SECRET)) {
    return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const dryRun = body.dry_run === true || config.dryRun || !config.enabled;
  const result = await runSeoMaterializer(env, { dryRun });
  return json(result, result.ok ? 200 : 503);
}

export default {
  fetch: handleRequest,
  async scheduled(_event: { cron?: string }, env: SeoMaterializerEnv) {
    const config = getSeoMaterializerConfig(env);
    if (!config.configured || !config.enabled || config.dryRun || !config.scheduledEnabled) return;
    const result = await runSeoMaterializer(env, { dryRun: false });
    console.log(JSON.stringify({ service: "sitecraft-seo-materializer", event: "batch", ...result }));
  },
};
