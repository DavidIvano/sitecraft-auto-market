import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildSeoHealthSnapshot, onRequestGet } from "../functions/api/admin/seo-health.ts";
import { summarizeSearchAnalytics, summarizeSitemaps } from "../src/lib/server/googleSearchConsole.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const generation = "seo-test-generation";
const locales = ["ar", "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr", "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "tr", "uk"];
const healthPayload = {
  queue: { pending: 0, processing: 0, completed: 12, failed: 0, last_completed_at: "2026-08-22T01:00:00Z", last_completed_generation: generation },
  generation: {
    active: generation,
    public_locales: 28,
    manifests: locales.map((locale) => ({ locale, generation, listing_total: 11, shard_count: 1 })),
    listing_index: 308,
    facets: 32,
    edges: 2576,
    stats: 896,
    related: 2688,
  },
};
const sitemapXml = `<?xml version="1.0"?><sitemapindex>${locales.flatMap((locale) => [
  `<sitemap><loc>https://automarket.sitecraft.agency/sitemaps/${locale}.xml</loc></sitemap>`,
  `<sitemap><loc>https://automarket.sitecraft.agency/sitemaps/${locale}/listings/${generation}/1.xml</loc></sitemap>`,
]).join("")}</sitemapindex>`;

function env() {
  return {
    XANO_API_URL: "https://xano.example/api:test",
    PUBLIC_SITE_URL: "https://automarket.sitecraft.agency",
    XANO_SEO_MATERIALIZER_SECRET: "secret",
  };
}

test("SEO health snapshot validates 28-locale generation, queue and sitemap", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/seo/internal/health")) return Response.json(healthPayload);
    if (url.endsWith("/sitemap.xml")) return new Response(sitemapXml, { headers: { "Content-Type": "application/xml" } });
    throw new Error(`unexpected fetch ${url}`);
  };
  const result = await buildSeoHealthSnapshot(env());
  assert.equal(result.ok, true);
  assert.equal(result.summary.status, "attention");
  assert.equal(result.generation.listing_index, 308);
  assert.equal(result.sitemap.locale_maps, 28);
  assert.equal(result.sitemap.listing_shards, 28);
  assert.equal(result.search_console.status, "not_configured");
});

test("admin SEO health endpoint rejects anonymous and non-admin requests", async () => {
  const anonymous = await onRequestGet({ request: new Request("https://example.test/api/admin/seo-health"), env: env() });
  assert.equal(anonymous.status, 401);

  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/auth/me")) return Response.json({ id: 7, role: "user" });
    throw new Error("unexpected fetch");
  };
  const forbidden = await onRequestGet({
    request: new Request("https://example.test/api/admin/seo-health", { headers: { Authorization: "Bearer user-token" } }),
    env: env(),
  });
  assert.equal(forbidden.status, 403);
});

test("admin SEO health endpoint returns aggregated data without secrets", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) return Response.json({ id: 1, role: "admin" });
    if (url.endsWith("/seo/internal/health")) return Response.json(healthPayload);
    if (url.endsWith("/sitemap.xml")) return new Response(sitemapXml);
    throw new Error(`unexpected fetch ${url}`);
  };
  const response = await onRequestGet({
    request: new Request("https://example.test/api/admin/seo-health", { headers: { Authorization: "Bearer admin-token" } }),
    env: env(),
  });
  const raw = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(raw, /admin-token|"secret"/u);
  assert.equal(JSON.parse(raw).generation.active, generation);
});

test("Search Console summaries use weighted metrics and exact sitemap URL", () => {
  const analytics = summarizeSearchAnalytics([
    { clicks: 2, impressions: 100, position: 4 },
    { clicks: 3, impressions: 300, position: 8 },
  ]);
  assert.deepEqual(analytics, { clicks: 5, impressions: 400, ctr: 0.0125, average_position: 7, days_with_data: 2 });

  const sitemap = summarizeSitemaps([{
    path: "https://automarket.sitecraft.agency/sitemap.xml",
    errors: "0",
    warnings: "1",
    contents: [{ submitted: "308", indexed: "250" }],
  }], "https://automarket.sitecraft.agency/sitemap.xml");
  assert.equal(sitemap.submitted, true);
  assert.equal(sitemap.submitted_urls, 308);
  assert.equal(sitemap.indexed_urls, 250);
});
