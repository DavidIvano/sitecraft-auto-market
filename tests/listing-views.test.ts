import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("analytics endpoint validates a public listing and deduplicates for 24 hours", async () => {
  const source = await read("../docs/xano-endpoint-post-analytics-listing-view.xs");
  assert.match(source, /db\.get car_listings/);
  assert.match(source, /Public listing not found/);
  assert.match(source, /add_secs_to_timestamp:-86400/);
  assert.match(source, /listing_views\.car_id == \$car\.id/);
  assert.match(source, /listing_views\.session_id == \$input\.session_id/);
  assert.match(source, /counted:\s*false/);
  assert.match(source, /counted:\s*true/);
  assert.doesNotMatch(source, /\$auth\.id/);
  assert.match(source, /owner exclusion requires a separate protected path/);
  assert.doesNotMatch(source, /add_secs_to_timestamp:-600/);
  assert.doesNotMatch(source, /raw_ip|email|phone|auth_token|user_agent\s*:\s*\$input/i);
});

test("authenticated analytics excludes the owner and keeps the same 24 hour dedupe", async () => {
  const source = await read("../docs/xano-endpoint-post-me-analytics-listing-view.xs");
  assert.match(source, /auth = "automarket_users"/);
  assert.match(source, /\$car\.user_id == \$auth\.id/);
  assert.match(source, /owner_view:\s*true/);
  assert.match(source, /counted\s*:\s*false/);
  assert.match(source, /add_secs_to_timestamp:-86400/);
  assert.match(source, /listing_views\.car_id == \$car\.id/);
});

test("public detail waits for visibility, skips previews, and analytics never blocks rendering", async () => {
  const source = await read("../src/pages/cars/[slug].astro");
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /2_000/);
  assert.match(source, /keepalive: true/);
  assert.match(source, /86_400_000/);
  assert.match(source, /isCloudflarePreview/);
  assert.match(source, /listingViewPending \|\| listingViewCompleted/);
  assert.match(source, /attempt === 0/);
  assert.match(source, /getAuthToken\(\)/);
  assert.match(source, /myListingViewAnalytics/);
  assert.doesNotMatch(source, /views_total\s*:/);
  assert.match(source, /catch \(error\) \{/);
});

test("owner dashboard projection exposes isolated aggregates without a view query per car", async () => {
  const source = await read("../docs/xano-endpoint-get-dashboard-listings.xs");
  assert.match(source, /views_total\s*:\s*\$car_views\|count/);
  assert.match(source, /views_7d\s*:\s*\$car_views_7d\|count/);
  assert.match(source, /views_unique\s*:\s*\$unique_sessions\|count/);
  assert.match(source, /last_viewed_at\s*:\s*\$last_viewed_at/);
  assert.match(source, /where = \$db\.car_listings\.user_id == \$current_user\.id/);
  assert.match(source, /listing_views\.car_id in \$owned_car_ids/);
  assert.match(source, /array\.filter \(\$owner_views\) if \(\$this\.car_id == \$car\.id\)/);

  const carLoop = source.slice(source.indexOf("foreach ($cars) {", source.indexOf("foreach ($cars) {") + 1));
  assert.doesNotMatch(carLoop, /db\.query listing_views/);
});
