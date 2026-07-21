import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDealFinderSyncConfig, type DealFinderSyncEnv } from "../workers/deal-finder-sync/src/env.ts";
import { mapKleinanzeigenAd } from "../workers/deal-finder-sync/src/normalizers.ts";
import { runDealFinderSync } from "../workers/deal-finder-sync/src/sync.ts";
import type { KleinanzeigenSearchResponse } from "../workers/deal-finder-sync/src/types.ts";

const env: DealFinderSyncEnv = {
  KLEINANZEIGEN_AGENT_API_KEY: "test-agent-key",
  XANO_API_BASE_URL: "https://xano.example.test/api:group",
  XANO_DEAL_FINDER_INGEST_SECRET: "test-internal-secret",
  DEAL_FINDER_SYNC_ENABLED: "false",
  DEAL_FINDER_DRY_RUN: "true",
};

type BatchRun = {
  result: Awaited<ReturnType<typeof runDealFinderSync>>;
  detailRequests: string[];
  ingestPayloads: Array<Record<string, unknown>>;
  touchPayloads: Array<Record<string, unknown>>;
  existingPayloads: Array<Record<string, unknown>>;
};

async function runMockBatch(externalIds: string[], existingIds: string[], failedDetailIds: string[] = []): Promise<BatchRun> {
  const originalFetch = globalThis.fetch;
  const detailRequests: string[] = [];
  const ingestPayloads: Array<Record<string, unknown>> = [];
  const touchPayloads: Array<Record<string, unknown>> = [];
  const existingPayloads: Array<Record<string, unknown>> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/deal-finder/internal/searches/active")) {
      return Response.json({ data: [{ id: 1, user_id: 7, name: "Fixture batch", source_type: "kleinanzeigen_agent", is_active: true, sync_enabled: false }] });
    }
    if (url.includes("api.kleinanzeigen-agent.de") && url.includes("/search?")) {
      return Response.json({ success: true, data: { ads: externalIds.map((externalId) => ({ ad_id: externalId, title: `Search ${externalId}`, description: "Search-level payload.", price: { amount: 2_900, currency_code: "EUR" }, ad_url: `https://www.kleinanzeigen.de/s-anzeige/${externalId}`, images: [{ url: `https://images.example.test/search-${externalId}.jpg` }], location: { city: "Ilsede" } })) } });
    }
    if (url.endsWith("/deal-finder/internal/listings/existing-ids")) {
      existingPayloads.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      return Response.json({ existing_ids: existingIds });
    }
    if (url.includes("api.kleinanzeigen-agent.de") && url.includes("/ads/")) {
      const externalId = decodeURIComponent(url.split("/ads/")[1].split("?")[0]);
      detailRequests.push(externalId);
      if (failedDetailIds.includes(externalId)) return Response.json({ success: false, error_code: "DETAIL_UNAVAILABLE" }, { status: 400 });
      return Response.json({ success: true, data: { ad: { ad_id: externalId, title: `Detail ${externalId}`, description: "Detail-enriched payload with the complete vehicle data.", price: { amount: 2_900, currency_code: "EUR" }, ad_url: `https://www.kleinanzeigen.de/s-anzeige/${externalId}`, images: [{ url: `https://images.example.test/detail-${externalId}.jpg` }], location: { city: "Ilsede" }, details: { variant: "Comfort" } } } });
    }
    if (url.endsWith("/deal-finder/internal/listings/touch-seen")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      touchPayloads.push(payload);
      const ids = payload.external_ids as string[];
      return Response.json({ touched: ids.length, missing: 0, missing_external_ids: [] });
    }
    if (url.endsWith("/deal-finder/internal/listings/ingest")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      ingestPayloads.push(payload);
      const listings = payload.listings as unknown[];
      return Response.json({ created: listings.length, updated: 0, duplicates: 0, rejected: 0, created_listing_ids: listings.map((_, index) => index + 1) });
    }
    throw new Error(`Unexpected request: ${init?.method || "GET"} ${url}`);
  }) as typeof fetch;

  try {
    return { result: await runDealFinderSync(env, false, true), detailRequests, ingestPayloads, touchPayloads, existingPayloads };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("Deal Finder sync defaults remain locked to the first-run safety limits", () => {
  const config = getDealFinderSyncConfig(env);
  assert.equal(config.syncEnabled, false);
  assert.equal(config.dryRun, true);
  assert.equal(config.maxSearchesPerRun, 1);
  assert.equal(config.maxSearchResultsPerRun, 100);
  assert.equal(config.maxDetailsPerRun, 4);
  assert.equal(config.maxAiAnalysesPerSync, 0);
});

test("sanitized provider fixture maps German vehicle attributes without seller data", () => {
  const fixture = JSON.parse(readFileSync(new URL("../workers/deal-finder-sync/test/fixtures/search-response.sanitized.json", import.meta.url), "utf8")) as KleinanzeigenSearchResponse;
  const listings = (fixture.data?.ads || []).map((ad) => mapKleinanzeigenAd(ad));

  assert.equal(listings.length, 5);
  assert.ok(listings.every(Boolean));
  assert.ok(listings.every((listing) => listing?.brand));
  assert.ok(listings.every((listing) => listing?.model));
  assert.ok(listings.every((listing) => listing?.year && listing.year >= 1900));
  assert.ok(listings.every((listing) => listing?.mileage && listing.mileage > 0));
  assert.ok(listings.every((listing) => listing?.content_hash.startsWith("df_")));
  assert.ok(listings.every((listing) => listing?.data_level === "search"));
  assert.ok(listings.every((listing) => listing?.provider_detail_loaded === false));
  assert.equal(JSON.stringify(fixture).includes("seller"), false);
});

test("dry-run inspects up to 100 search results and still performs no detail or ingest calls", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    requests.push({ url, method });

    if (url.endsWith("/deal-finder/internal/searches/active")) {
      return Response.json({
        data: [{
          id: 1,
          user_id: 1,
          name: "First run",
          source_type: "kleinanzeigen_agent",
          is_active: true,
          sync_enabled: true,
          price_max: 5_000,
          picture_required: true,
          source_config: { pageSize: 99 },
        }],
      });
    }

    if (url.includes("api.kleinanzeigen-agent.de") && url.includes("/search?")) {
      const size = new URL(url).searchParams.get("size");
      assert.equal(size, "100");
      return Response.json({
        success: true,
        data: {
          meta: { page: 0, size: 7 },
          ads: Array.from({ length: 7 }, (_, index) => ({
            ad_id: `test-${index + 1}`,
            title: `Test car ${index + 1}`,
            description: "Sanitized test listing.",
            price: { amount: 2_900, currency_code: "EUR" },
            ad_url: `https://www.kleinanzeigen.de/s-anzeige/test-${index + 1}`,
            images: [{ url: `https://images.example.test/car-${index + 1}.jpg` }],
            location: { city: "Ilsede" },
          })),
        },
      });
    }

    if (url.endsWith("/deal-finder/internal/listings/existing-ids")) {
      return Response.json({ existing_ids: [] });
    }

    throw new Error(`Unexpected request: ${method} ${url}`);
  }) as typeof fetch;

  try {
    const result = await runDealFinderSync(env, true);
    assert.deepEqual(result, {
      dryRun: true,
      searches: 1,
      candidates: 7,
      newCandidates: 4,
      existingCandidates: 0,
      detailsFetched: 0,
      detailFailures: 0,
      touched: 0,
      touchMissing: 0,
    });
    assert.equal(requests.filter(({ url }) => url.includes("/ads/")).length, 0);
    assert.equal(requests.filter(({ url }) => url.endsWith("/deal-finder/internal/listings/ingest")).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("manual sync may use a disabled profile while scheduled-style sync still skips it", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);

    if (url.endsWith("/deal-finder/internal/searches/active")) {
      return Response.json({
        data: [{
          id: 1,
          user_id: 1,
          name: "Manual first ingest",
          source_type: "kleinanzeigen_agent",
          is_active: true,
          sync_enabled: false,
        }],
      });
    }

    if (url.includes("api.kleinanzeigen-agent.de") && url.includes("/search?")) {
      return Response.json({
        success: true,
        data: {
          ads: [{
            ad_id: "manual-1",
            title: "Manual test car",
            description: "Sanitized test listing.",
            price: { amount: 2_900, currency_code: "EUR" },
            ad_url: "https://www.kleinanzeigen.de/s-anzeige/manual-1",
            images: [{ url: "https://images.example.test/manual-1.jpg" }],
            location: { city: "Ilsede" },
          }],
        },
      });
    }

    if (url.endsWith("/deal-finder/internal/listings/existing-ids")) return Response.json({ existing_ids: [] });
    if (url.includes("/ads/manual-1")) {
      return Response.json({
        success: true,
        data: {
          ad: {
            ad_id: "manual-1",
            title: "Manual test car",
            description: "Sanitized test listing.",
            price: { amount: 2_900, currency_code: "EUR" },
            ad_url: "https://www.kleinanzeigen.de/s-anzeige/manual-1",
            images: [{ url: "https://images.example.test/manual-1.jpg" }],
            location: { city: "Ilsede" },
          },
        },
      });
    }
    if (url.endsWith("/deal-finder/internal/listings/ingest")) {
      return Response.json({ created: 1, updated: 0, duplicates: 0, rejected: 0, created_listing_ids: [1] });
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  try {
    const scheduledStyle = await runDealFinderSync(env, false);
    assert.equal(scheduledStyle.searches, 0);
    assert.equal(requests.some((url) => url.includes("api.kleinanzeigen-agent.de")), false);

    requests.length = 0;
    const manual = await runDealFinderSync(env, false, true);
    assert.equal(manual.searches, 1);
    assert.equal(manual.candidates, 1);
    assert.equal(manual.detailsFetched, 1);
    assert.equal(manual.ingested?.created, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("existing external ids are touched without detail or full ingestion", async () => {
  const run = await runMockBatch(["existing-1"], ["existing-1"]);
  assert.equal(run.result.newCandidates, 0);
  assert.equal(run.result.existingCandidates, 1);
  assert.equal(run.result.detailsFetched, 0);
  assert.equal(run.result.touched, 1);
  assert.equal(run.detailRequests.length, 0);
  assert.equal(run.ingestPayloads.length, 0);
  assert.equal(run.existingPayloads[0].search_id, 1);
  assert.equal(run.touchPayloads.length, 1);
  assert.deepEqual(run.touchPayloads[0].external_ids, ["existing-1"]);
  assert.equal(run.touchPayloads[0].log_sync, true);
  assert.deepEqual(run.touchPayloads[0].sync_metadata, { candidates_found: 1, new_candidates: 0, existing_candidates: 1, details_fetched: 0, detail_failures: 0, touched: 0, rejected: 0 });
  assert.deepEqual(Object.keys(run.touchPayloads[0]).sort(), ["external_ids", "log_sync", "platform", "search_id", "seen_at", "sync_metadata"]);
  assert.equal(JSON.stringify(run.touchPayloads[0]).includes("description"), false);
  assert.equal(JSON.stringify(run.touchPayloads[0]).includes("is_saved"), false);
});

test("existing-id checks are scoped by search owner and never trust Worker user_id", async () => {
  const run = await runMockBatch(["owner-a-id"], []);
  assert.deepEqual(run.existingPayloads[0], {
    platform: "kleinanzeigen",
    search_id: 1,
    external_ids: ["owner-a-id"],
  });
  assert.equal("user_id" in run.existingPayloads[0], false);
  assert.equal(run.result.newCandidates, 1);
  assert.equal(run.ingestPayloads.length, 1);
  assert.equal("user_id" in run.ingestPayloads[0], false);

  const existingScript = readFileSync(new URL("../docs/xano/deal-finder-internal-existing-ids.xs", import.meta.url), "utf8");
  const ingestScript = readFileSync(new URL("../docs/xano/deal-finder-internal-ingest.xs", import.meta.url), "utf8");
  assert.match(existingScript, /deal_finder_listings\.user_id == \$search\.user_id/);
  assert.match(ingestScript, /deal_finder_listings\.user_id == \$search\.user_id/);
  assert.doesNotMatch(ingestScript, /user_id\s*:\s*\$listing/);
});

test("mixed batch ingests only detail-enriched new listings and touches existing ids", async () => {
  const run = await runMockBatch(["new-1", "existing-1", "new-2", "existing-2"], ["existing-1", "existing-2"]);
  assert.deepEqual(run.detailRequests.sort(), ["new-1", "new-2"]);
  assert.equal(run.ingestPayloads.length, 1);
  const listings = run.ingestPayloads[0].listings as Array<Record<string, unknown>>;
  assert.deepEqual(listings.map((listing) => listing.external_id).sort(), ["new-1", "new-2"]);
  assert.ok(listings.every((listing) => listing.data_level === "detail" && listing.provider_detail_loaded === true));
  assert.ok(listings.every((listing) => typeof listing.provider_detail_fetched_at === "string"));
  assert.ok(listings.every((listing) => String(listing.title).startsWith("Detail ")));
  assert.equal(listings.some((listing) => String(listing.external_id).startsWith("existing-")), false);
  assert.deepEqual(run.touchPayloads[0].external_ids, ["existing-1", "existing-2"]);
  assert.equal(run.touchPayloads[0].log_sync, false);
  assert.deepEqual(run.ingestPayloads[0].sync_metadata, { candidates_found: 4, new_candidates: 2, existing_candidates: 2, details_fetched: 2, detail_failures: 0, touched: 2, rejected: 0 });
  assert.equal(run.result.detailsFetched, 2);
  assert.equal(run.result.touched, 2);
});

test("all existing batch performs no details or ingestion and one touch request", async () => {
  const ids = ["existing-1", "existing-2", "existing-3", "existing-4"];
  const run = await runMockBatch(ids, ids);
  assert.equal(run.detailRequests.length, 0);
  assert.equal(run.ingestPayloads.length, 0);
  assert.equal(run.touchPayloads.length, 1);
  assert.equal(run.result.touched, 4);
  assert.equal(run.touchPayloads[0].log_sync, true);
});

test("all new batch ingests four detail records and does not touch existing rows", async () => {
  const ids = ["new-1", "new-2", "new-3", "new-4"];
  const run = await runMockBatch(ids, []);
  assert.equal(run.detailRequests.length, 4);
  assert.equal(run.touchPayloads.length, 0);
  assert.equal(run.ingestPayloads.length, 1);
  assert.equal((run.ingestPayloads[0].listings as unknown[]).length, 4);
  assert.equal(run.result.detailsFetched, 4);
  assert.equal(run.ingestPayloads[0].sync_metadata && (run.ingestPayloads[0].sync_metadata as Record<string, unknown>).existing_candidates, 0);
});

test("detail failure is isolated and search-level fallback is never ingested", async () => {
  const run = await runMockBatch(["new-1", "new-failed", "new-2"], [], ["new-failed"]);
  assert.deepEqual(run.detailRequests, ["new-1", "new-failed", "new-2"]);
  assert.equal(run.result.detailFailures, 1);
  assert.equal(run.result.detailsFetched, 2);
  const listings = run.ingestPayloads[0].listings as Array<Record<string, unknown>>;
  assert.deepEqual(listings.map((listing) => listing.external_id), ["new-1", "new-2"]);
  assert.equal(listings.some((listing) => listing.data_level !== "detail"), false);
  assert.equal((run.ingestPayloads[0].sync_metadata as Record<string, unknown>).detail_failures, 1);
  assert.equal((run.ingestPayloads[0].sync_metadata as Record<string, unknown>).rejected, 1);
});
