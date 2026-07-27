import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAiIdempotencyKey } from "../src/lib/ai/idempotency.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("AI idempotency keys are server-compatible and unique", () => {
  const first = createAiIdempotencyKey("AI Listing Draft");
  const second = createAiIdempotencyKey("AI Listing Draft");
  assert.match(first, /^ai-listing-draft-[a-z0-9-]{12,}$/);
  assert.ok(first.length <= 64);
  assert.notEqual(first, second);
});

test("paid frontend AI calls send stable idempotency keys", () => {
  const catalog = read("src/pages/cars/index.astro");
  const listing = read("src/pages/dashboard/new.astro");
  assert.match(catalog, /pendingAiSearch[\s\S]*idempotency_key: pendingAiSearch\.idempotencyKey/);
  assert.match(listing, /aiPhotoRequestIdempotencyKey \|\|= createAiIdempotencyKey/);
  assert.match(listing, /payload\.set\("idempotency_key", aiPhotoRequestIdempotencyKey\)/);
  assert.match(listing, /dashboard\/drafts\/\$\{draftId\}/);
});

test("active AI Xano scripts use Luna, Responses API privacy and no legacy model", () => {
  const files = [
    "docs/xano-endpoint-post-ai-search-intent.xs",
    "docs/xano-endpoint-post-ai-listing-generate-description.xs",
    "docs/xano-endpoint-post-ai-listing-quality-score.xs",
    "docs/xano-endpoint-post-ai-moderation-check-listing.xs",
    "docs/xano/admin-security-remediation/3979609.after.xs",
    "docs/xano/admin-security-remediation/3981578.after.xs",
    "docs/xano/deal-finder-frontend-translate-description.xs",
  ];
  for (const file of files) {
    const script = read(file);
    assert.match(script, /gpt-5\.6-luna/, file);
    assert.match(script, /api\.openai\.com\/v1\/responses/, file);
    assert.match(script, /store: false/, file);
    assert.doesNotMatch(script, /gpt-(?:5\.4(?:-mini)?|5-mini|4o-mini)|OPENAI_CAR_AI_MODEL/, file);
  }
});

test("paid AI operations charge once after success with an immutable ledger key", () => {
  const search = read("docs/xano-endpoint-post-ai-search-intent.xs");
  const listing = read("docs/xano/admin-security-remediation/3979609.after.xs");
  const queue = read("docs/xano/deal-finder-frontend-analyze.xs");
  const complete = read("docs/xano/deal-finder-internal-analysis-complete.xs");
  for (const script of [search, listing]) {
    assert.match(script, /text idempotency_key\? filters=trim\|lower/);
    assert.match(script, /timeout = 60/);
    assert.match(script, /response\.result\.output":\[\]/);
    assert.match(script, /db\.transaction/);
    assert.match(script, /lock = true/);
    assert.match(script, /db\.add credit_transactions/);
    assert.match(script, /INSUFFICIENT_CREDITS/);
  }
  assert.match(queue, /credits-precheck/);
  assert.match(complete, /deal-finder-analysis-v1-/);
  assert.match(complete, /db\.transaction/);
  assert.match(complete, /type: "deal_finder_analysis"/);
});

test("Deal Finder translation is real, cached, owner-scoped and free by policy", () => {
  const api = read("src/lib/deal-finder/api.ts");
  const endpoint = read("docs/xano/deal-finder-frontend-translate-description.xs");
  const policy = read("docs/product/credits-policy.md");
  assert.match(api, /source_language: "de", target_language: targetLanguage/);
  assert.match(endpoint, /deal_finder_listings\.user_id == \$current_user\.id/);
  assert.match(endpoint, /source_hash/);
  assert.match(endpoint, /gpt-5\.6-luna/);
  assert.doesNotMatch(endpoint, /db\.edit user_credits|db\.add credit_transactions/);
  assert.match(policy, /Перевод описания \| Нет \| 0/);
});
