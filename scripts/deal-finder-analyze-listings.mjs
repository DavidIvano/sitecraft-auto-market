#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULTS = Object.freeze({ dryRun: true, force: false, parallelism: 1, max: 1, stopOnError: true });
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

const booleanValue = (value, fallback) => {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("INVALID_BOOLEAN_OPTION");
};

export function parseBatchArgs(argv) {
  const options = { ...DEFAULTS, ids: [] };
  for (const argument of argv) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--dry-run=")) options.dryRun = booleanValue(argument.split("=")[1], true);
    else if (argument === "--stop-on-error") options.stopOnError = true;
    else if (argument.startsWith("--stop-on-error=")) options.stopOnError = booleanValue(argument.split("=")[1], true);
    else if (argument.startsWith("--ids=")) {
      const ids = argument.slice(6).split(",").filter(Boolean).map(Number);
      if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("INVALID_IDS");
      options.ids = [...new Set(ids)];
    } else if (argument.startsWith("--max=")) {
      options.max = Number(argument.slice(6));
    } else if (argument === "--force") options.force = true;
    else if (argument.startsWith("--force=")) options.force = booleanValue(argument.split("=")[1], false);
    else if (argument.startsWith("--parallelism=")) {
      options.parallelism = Number(argument.slice(14));
    } else throw new Error("UNKNOWN_OPTION");
  }
  if (!Number.isInteger(options.max) || options.max < 1 || options.max > 4) throw new Error("INVALID_MAX");
  if (options.parallelism !== 1) throw new Error("PARALLELISM_NOT_ALLOWED");
  if (options.ids.length > options.max) throw new Error("MAX_EXCEEDED");
  return options;
}

export function normalizeTimestampValue(value) {
  if (typeof value === "string") return Number.isFinite(Date.parse(value)) ? value : null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  try {
    return new Date(value < 100_000_000_000 ? value * 1000 : value).toISOString();
  } catch {
    return null;
  }
}

const plainText = (value, maxLength) => typeof value === "string" && value.length > 0 && value.length <= maxLength && !/<[^>]+>/.test(value);
const cleanBase = (value) => String(value || "").replace(/\/+$/, "");

const requiredEnvironment = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
};

async function fetchJson(url, init, safeCode) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") throw new Error(`${safeCode}_${response.status || 0}`);
  return payload;
}

function validateFrontendListing(payload, expectedId) {
  const listing = payload?.listing;
  if (!listing || Number(listing.id) !== expectedId) throw new Error("PREFLIGHT_FAILED_LISTING");
  if (listing.source_status !== "active") throw new Error("PREFLIGHT_FAILED_SOURCE_STATUS");
  if (!plainText(listing.title, 300)) throw new Error("PREFLIGHT_FAILED_TITLE");
  if (listing.description !== null && listing.description !== undefined && !plainText(listing.description, 6000)) throw new Error("PREFLIGHT_FAILED_DESCRIPTION");
  if (!normalizeTimestampValue(listing.first_seen_at)) throw new Error("PREFLIGHT_FAILED_FIRST_SEEN_AT");
  return listing;
}

function validateInternalPreflight(payload, expectedId, force = false) {
  if (Number(payload.listing_id) !== expectedId) throw new Error("PREFLIGHT_FAILED_LISTING");
  const required = ["source_active", "detail_data", "provider_detail_loaded", "content_hash_present", "title_present"];
  if (required.some((field) => payload[field] !== true)) throw new Error("PREFLIGHT_FAILED");
  if (payload.active_same_hash === true || (!force && payload.completed_same_hash === true)) throw new Error("PREFLIGHT_FAILED_ANALYSIS_EXISTS");
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });
const secretHeaders = (secret) => ({ "X-Deal-Finder-Secret": secret });

async function preflightListing(id, config) {
  const detail = await fetchJson(`${config.apiBase}/deal-finder/listings/${id}`, { headers: authHeaders(config.authToken) }, "PREFLIGHT_FRONTEND");
  validateFrontendListing(detail, id);
  const internal = await fetchJson(`${config.apiBase}/deal-finder/internal/analyses/${id}/preflight`, { headers: secretHeaders(config.xanoSecret) }, "PREFLIGHT_INTERNAL");
  validateInternalPreflight(internal, id, config.force);
}

async function analyzeListing(id, config) {
  const queued = await fetchJson(`${config.apiBase}/deal-finder/listings/${id}/analyze`, {
    method: "POST",
    headers: { ...authHeaders(config.authToken), "Content-Type": "application/json" },
    body: JSON.stringify({ force: config.force }),
  }, "ENQUEUE_FAILED");
  if (Number(queued.analysis?.listing_id) !== id || queued.analysis?.status !== "pending") throw new Error("ENQUEUE_NOT_PENDING");
  const worker = await fetchJson(`${config.workerBase}/analyze`, { method: "POST", headers: secretHeaders(config.triggerSecret) }, "WORKER_FAILED");
  if (worker.processed !== 1 || worker.completed !== 1 || worker.failed !== 0) throw new Error("ANALYSIS_FAILED");
  const detail = await fetchJson(`${config.apiBase}/deal-finder/listings/${id}`, { headers: authHeaders(config.authToken) }, "VERIFY_FAILED");
  if (Number(detail.analysis?.listing_id) !== id || detail.analysis?.status !== "completed" || detail.analysis?.model !== "gpt-5.6-luna") throw new Error("VERIFY_NOT_COMPLETED");
  return {
    listing_id: id,
    status: "completed",
    deal_score: detail.analysis.deal_score,
    risk_score: detail.analysis.risk_score,
    liquidity_score: detail.analysis.liquidity_score,
    confidence_score: detail.analysis.confidence_score,
    recommendation: detail.analysis.recommendation,
  };
}

export async function runBatch(options) {
  if (!options.ids.length) {
    console.log(JSON.stringify({ ok: true, dry_run: true, processed: 0, code: "NO_IDS" }));
    return [];
  }
  if (options.dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, processed: 0, ids: options.ids, max: options.max, parallelism: 1, force: false, stop_on_error: options.stopOnError }));
    return [];
  }

  const apiBase = cleanBase(requiredEnvironment("DEAL_FINDER_API_BASE_URL"));
  const workerBase = cleanBase(requiredEnvironment("DEAL_FINDER_WORKER_URL"));
  const workerUrl = new URL(workerBase);
  if (!LOOPBACK_HOSTS.has(workerUrl.hostname)) throw new Error("LOCAL_WORKER_REQUIRED");
  const config = {
    apiBase,
    workerBase,
    authToken: requiredEnvironment("DEAL_FINDER_AUTH_TOKEN"),
    xanoSecret: requiredEnvironment("XANO_DEAL_FINDER_INGEST_SECRET"),
    triggerSecret: requiredEnvironment("DEAL_FINDER_WORKER_TRIGGER_SECRET"),
    force: options.force,
  };

  for (const id of options.ids) await preflightListing(id, config);

  const results = [];
  for (const id of options.ids) {
    try {
      const result = await analyzeListing(id, config);
      results.push(result);
      console.log(JSON.stringify({ event: "analysis_completed", ...result }));
    } catch (error) {
      console.error(JSON.stringify({ event: "batch_stopped", listing_id: id, code: error instanceof Error ? error.message : "UNKNOWN_ANALYSIS_ERROR" }));
      if (options.stopOnError) throw error;
    }
  }
  return results;
}

async function main() {
  try {
    const options = parseBatchArgs(process.argv.slice(2));
    await runBatch(options);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error instanceof Error ? error.message : "UNKNOWN_ANALYSIS_ERROR" }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
