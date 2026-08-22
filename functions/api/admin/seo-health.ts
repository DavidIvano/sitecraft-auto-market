import { loadSearchConsoleSnapshot } from "../../../src/lib/server/googleSearchConsole.ts";

type Env = {
  XANO_API_URL?: string;
  PUBLIC_XANO_API_URL?: string;
  PUBLIC_SITE_URL?: string;
  XANO_SEO_MATERIALIZER_SECRET?: string;
  GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SEARCH_CONSOLE_SITE_URL?: string;
};

type PagesContext = { request: Request; env: Env };
type CheckTone = "pass" | "warning" | "fail";
type HealthCheck = { id: string; label: string; tone: CheckTone; detail: string };

type XanoHealthPayload = {
  checked_at?: string;
  queue?: {
    pending?: number;
    actionable_pending?: number;
    exhausted_pending?: number;
    exhausted_active_generation?: number;
    exhausted_stale_generation?: number;
    processing?: number;
    completed?: number;
    failed?: number;
    oldest_pending_at?: string | number | null;
    oldest_actionable_pending_at?: string | number | null;
    last_completed_at?: string | number | null;
    last_completed_generation?: string | null;
    last_failed_at?: string | number | null;
    last_error_code?: string | null;
  };
  generation?: {
    active?: string;
    public_locales?: number;
    manifests?: Array<{
      locale?: string;
      generation?: string;
      listing_total?: number;
      shard_count?: number;
      lastmod?: string | null;
      updated_at?: string | null;
    }>;
    listing_index?: number;
    facets?: number;
    edges?: number;
    stats?: number;
    related?: number;
  };
};

const DEFAULT_SITE_URL = "https://automarket.sitecraft.agency";
const HTTP_TIMEOUT_MS = 12_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function normalizeBaseUrl(value: unknown) {
  return String(value || "").trim().replace(/\/+$/u, "");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, duration_ms: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson<T>(url: string, init: RequestInit = {}) {
  const { response, duration_ms } = await fetchWithTimeout(url, init);
  const payload = await response.json().catch(() => null) as T | null;
  return { ok: response.ok, status: response.status, duration_ms, payload };
}

function authUser(payload: unknown) {
  const value = payload as { id?: unknown; role?: unknown; user?: { id?: unknown; role?: unknown } } | null;
  const id = Number(value?.id ?? value?.user?.id);
  const role = String(value?.role ?? value?.user?.role ?? "").trim().toLowerCase();
  return { id: Number.isInteger(id) && id > 0 ? id : null, role };
}

async function requireAdmin(request: Request, xanoApiUrl: string) {
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+$/iu.test(authorization)) return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
  try {
    const result = await readJson<unknown>(`${xanoApiUrl}/auth/me`, { headers: { Authorization: authorization } });
    if (!result.ok) return { ok: false as const, status: result.status >= 500 ? 503 : 401, code: result.status >= 500 ? "AUTH_UNAVAILABLE" : "UNAUTHORIZED" };
    const user = authUser(result.payload);
    if (!user.id) return { ok: false as const, status: 401, code: "UNAUTHORIZED" };
    if (user.role !== "admin") return { ok: false as const, status: 403, code: "FORBIDDEN" };
    return { ok: true as const, user_id: user.id };
  } catch {
    return { ok: false as const, status: 503, code: "AUTH_UNAVAILABLE" };
  }
}

function timestampMillis(value: unknown) {
  const numericValue = Number(value);
  const timestamp = Number.isFinite(numericValue) && numericValue > 0
    ? numericValue > 10_000_000_000 ? numericValue : numericValue * 1000
    : Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function ageMinutes(value: unknown) {
  const timestamp = timestampMillis(value);
  return timestamp > 0 ? Math.max(0, Math.round((Date.now() - timestamp) / 60_000)) : null;
}

function sitemapLocations(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1] || "");
}

function checkSummary(checks: HealthCheck[]) {
  const failed = checks.filter((check) => check.tone === "fail").length;
  const warnings = checks.filter((check) => check.tone === "warning").length;
  return {
    status: failed > 0 ? "critical" : warnings > 0 ? "attention" : "healthy",
    passed: checks.length - failed - warnings,
    warnings,
    failed,
  };
}

export async function buildSeoHealthSnapshot(env: Env) {
  const xanoApiUrl = normalizeBaseUrl(env.XANO_API_URL || env.PUBLIC_XANO_API_URL);
  const siteUrl = normalizeBaseUrl(env.PUBLIC_SITE_URL || DEFAULT_SITE_URL);
  const sitemapUrl = `${siteUrl}/sitemap.xml`;
  const checks: HealthCheck[] = [];

  let xanoHealth: XanoHealthPayload | null = null;
  let xanoHealthHttp = { status: 0, duration_ms: 0 };
  if (!env.XANO_SEO_MATERIALIZER_SECRET) {
    checks.push({ id: "materializer_secret", label: "Доступ к SEO materializer", tone: "fail", detail: "Server secret не настроен в Cloudflare Pages." });
  } else {
    try {
      const result = await readJson<XanoHealthPayload>(`${xanoApiUrl}/seo/internal/health`, {
        headers: { "X-Seo-Materializer-Secret": env.XANO_SEO_MATERIALIZER_SECRET },
      });
      xanoHealthHttp = { status: result.status, duration_ms: result.duration_ms };
      xanoHealth = result.ok ? result.payload : null;
      checks.push({
        id: "materializer_api",
        label: "Внутренний SEO health contract",
        tone: result.ok && result.payload ? "pass" : "fail",
        detail: result.ok ? `Xano ответил за ${result.duration_ms} мс.` : `Xano вернул HTTP ${result.status}.`,
      });
    } catch {
      checks.push({ id: "materializer_api", label: "Внутренний SEO health contract", tone: "fail", detail: "Xano health endpoint недоступен." });
    }
  }

  const manifests = xanoHealth?.generation?.manifests || [];
  const generations = [...new Set(manifests.map((manifest) => String(manifest.generation || "")).filter(Boolean))];
  const listingTotals = manifests.map((manifest) => Number(manifest.listing_total || 0));
  const minListings = listingTotals.length ? Math.min(...listingTotals) : 0;
  const maxListings = listingTotals.length ? Math.max(...listingTotals) : 0;
  const activeGeneration = String(xanoHealth?.generation?.active || "");
  const generationReady = manifests.length === 28
    && Number(xanoHealth?.generation?.public_locales || 0) === 28
    && generations.length === 1
    && generations[0] === activeGeneration
    && minListings > 0
    && minListings === maxListings
    && Number(xanoHealth?.generation?.listing_index || 0) === minListings * 28;
  checks.push({
    id: "generation_parity",
    label: "Атомарная parity 28 языков",
    tone: generationReady ? "pass" : "fail",
    detail: generationReady
      ? `${minListings} объявлений × 28 локалей, generation ${activeGeneration}.`
      : `${manifests.length}/28 manifests, диапазон объявлений ${minListings}–${maxListings}.`,
  });

  const queue = xanoHealth?.queue || {};
  const pendingAgeMinutes = ageMinutes(queue.oldest_actionable_pending_at);
  const failedJobs = Number(queue.failed || 0);
  const exhaustedJobs = Number(queue.exhausted_pending || 0);
  const lastFailedTimestamp = timestampMillis(queue.last_failed_at);
  const lastCompletedTimestamp = timestampMillis(queue.last_completed_at);
  const unresolvedFailure = failedJobs > 0 && lastFailedTimestamp > lastCompletedTimestamp;
  const queueTone: CheckTone = exhaustedJobs > 0 || unresolvedFailure || (pendingAgeMinutes !== null && pendingAgeMinutes > 60)
    ? "fail"
    : (pendingAgeMinutes !== null && pendingAgeMinutes > 30) ? "warning" : "pass";
  checks.push({
    id: "queue",
    label: "Очередь SEO-обновлений",
    tone: queueTone,
    detail: `${Number(queue.actionable_pending || 0)} ready, ${Number(queue.processing || 0)} processing, ${exhaustedJobs} exhausted${unresolvedFailure ? `; последняя ошибка ${String(queue.last_error_code || "unknown")}` : ""}${pendingAgeMinutes === null ? "" : `; старейшее готовое задание ${pendingAgeMinutes} мин.`}`,
  });

  let sitemap = { status: 0, duration_ms: 0, child_sitemaps: 0, locale_maps: 0, listing_shards: 0 };
  try {
    const result = await fetchWithTimeout(sitemapUrl, { headers: { Accept: "application/xml" } });
    const xml = await result.response.text();
    const locations = sitemapLocations(xml);
    const localeMaps = locations.filter((value) => /^https:\/\/[^/]+\/sitemaps\/[a-z]{2}\.xml$/u.test(value)).length;
    const listingShards = locations.filter((value) => /\/sitemaps\/[a-z]{2}\/listings\/[A-Za-z0-9_-]+\/\d+\.xml$/u.test(value)).length;
    sitemap = { status: result.response.status, duration_ms: result.duration_ms, child_sitemaps: locations.length, locale_maps: localeMaps, listing_shards: listingShards };
    const ready = result.response.ok && /<sitemapindex/u.test(xml) && localeMaps === 28 && listingShards >= 28;
    checks.push({
      id: "sitemap",
      label: "Production sitemap index",
      tone: ready ? "pass" : "fail",
      detail: ready ? `${locations.length} дочерних sitemap, ответ ${result.duration_ms} мс.` : `HTTP ${result.response.status}; locale maps ${localeMaps}/28; listing shards ${listingShards}.`,
    });
  } catch {
    checks.push({ id: "sitemap", label: "Production sitemap index", tone: "fail", detail: "Production sitemap недоступен." });
  }

  const searchConsole = await loadSearchConsoleSnapshot(env, { sitemapUrl });
  if (!searchConsole.configured) {
    checks.push({ id: "search_console", label: "Google Search Console API", tone: "warning", detail: "Service account ещё не подключён; UI property можно использовать отдельно." });
  } else if (searchConsole.status !== "connected") {
    checks.push({ id: "search_console", label: "Google Search Console API", tone: "fail", detail: `Ошибка подключения: ${searchConsole.error}` });
  } else {
    const submitted = Boolean(searchConsole.sitemap.submitted);
    checks.push({
      id: "search_console",
      label: "Google Search Console API",
      tone: submitted && searchConsole.sitemap.errors === 0 ? "pass" : "warning",
      detail: submitted
        ? `Sitemap зарегистрирован; ${searchConsole.sitemap.errors} ошибок, ${searchConsole.sitemap.warnings} предупреждений.`
        : "API подключён, но production sitemap ещё не зарегистрирован.",
    });
  }

  return {
    ok: checks.every((check) => check.tone !== "fail"),
    checked_at: new Date().toISOString(),
    summary: checkSummary(checks),
    checks,
    queue: {
      pending: Number(queue.pending || 0),
      actionable_pending: Number(queue.actionable_pending || 0),
      exhausted_pending: exhaustedJobs,
      processing: Number(queue.processing || 0),
      completed: Number(queue.completed || 0),
      failed: failedJobs,
      oldest_pending_at: queue.oldest_pending_at || null,
      oldest_actionable_pending_at: queue.oldest_actionable_pending_at || null,
      oldest_pending_age_minutes: pendingAgeMinutes,
      last_completed_at: queue.last_completed_at || null,
      last_completed_generation: queue.last_completed_generation || null,
      last_failed_at: queue.last_failed_at || null,
      last_error_code: queue.last_error_code || null,
    },
    generation: {
      active: activeGeneration || null,
      public_locales: Number(xanoHealth?.generation?.public_locales || 0),
      manifest_count: manifests.length,
      listing_total_per_locale: { min: minListings, max: maxListings },
      listing_index: Number(xanoHealth?.generation?.listing_index || 0),
      facets: Number(xanoHealth?.generation?.facets || 0),
      edges: Number(xanoHealth?.generation?.edges || 0),
      stats: Number(xanoHealth?.generation?.stats || 0),
      related: Number(xanoHealth?.generation?.related || 0),
      xano_http: xanoHealthHttp,
    },
    sitemap,
    search_console: searchConsole,
  };
}

export async function onRequestGet({ request, env }: PagesContext) {
  const xanoApiUrl = normalizeBaseUrl(env.XANO_API_URL || env.PUBLIC_XANO_API_URL);
  if (!xanoApiUrl) return json({ ok: false, code: "CONFIGURATION_MISSING" }, 503);
  const auth = await requireAdmin(request, xanoApiUrl);
  if (!auth.ok) return json({ ok: false, code: auth.code }, auth.status);
  try {
    const snapshot = await buildSeoHealthSnapshot(env);
    return json(snapshot, snapshot.ok ? 200 : 503);
  } catch {
    return json({ ok: false, code: "SEO_HEALTH_UNAVAILABLE" }, 503);
  }
}
