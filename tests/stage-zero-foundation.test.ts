import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAccessStateForHttpError, resolveDealFinderAccess } from "../src/lib/accessState.ts";
import {
  FREE_AI_CREDITS_CAP,
  FREE_AI_CREDITS_DAILY_GRANT,
  canAffordAiAction,
  getCreditActionPolicy,
  normalizeCreditWallets,
} from "../src/lib/credits/model.ts";

const root = new URL("..", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, root), "utf8");

test("Deal Finder access states distinguish session, role, module and temporary failures", () => {
  assert.equal(resolveDealFinderAccess({ enabled: false, hasToken: true, hasUser: true, hasRole: true }).code, "module_disabled");
  assert.equal(resolveDealFinderAccess({ enabled: true, hasToken: false, hasUser: false, hasRole: false }).code, "sign_in_required");
  assert.equal(resolveDealFinderAccess({ enabled: true, hasToken: true, hasUser: true, hasRole: false }).code, "role_required");
  assert.equal(resolveDealFinderAccess({ enabled: true, hasToken: true, hasUser: false, hasRole: false, authFailed: true }).code, "temporarily_unavailable");
  assert.equal(resolveDealFinderAccess({ enabled: true, hasToken: true, hasUser: true, hasRole: true }).code, "ready");
  assert.equal(getAccessStateForHttpError(429).code, "rate_limited");
  assert.equal(getAccessStateForHttpError(503, "MODULE_DISABLED").code, "module_disabled");
});

test("credit normalization accepts canonical and legacy Xano payloads", () => {
  const canonical = normalizeCreditWallets({
    free_ai_credits: 5,
    paid_ai_credits: 10,
    ai_credits_total: 15,
    ai_credits_used_total: 4,
    provider_credits_daily_limit: 5,
  });
  assert.deepEqual(canonical.ai, {
    free: 5,
    paid: 10,
    unallocated: 0,
    total: 15,
    used: 4,
    dailyGrant: FREE_AI_CREDITS_DAILY_GRANT,
    freeCap: FREE_AI_CREDITS_CAP,
  });
  assert.equal(canonical.provider.dailyLimit, 5);

  const legacy = normalizeCreditWallets({ ai_credits: 7 });
  assert.equal(legacy.ai.total, 7);
  assert.equal(legacy.ai.unallocated, 7);
  assert.equal(legacy.ai.free, 0);
  assert.equal(legacy.ai.paid, 0);
});

test("free product actions never require AI or provider credits", () => {
  ["page_view", "filter_change", "local_sort", "save_listing", "hide_listing", "mark_viewed"].forEach((action) => {
    const policy = getCreditActionPolicy(action as Parameters<typeof getCreditActionPolicy>[0]);
    assert.equal(policy.cost, 0);
    assert.equal(policy.wallet, null);
  });

  assert.deepEqual(getCreditActionPolicy("deal_finder_analysis"), {
    wallet: "ai",
    cost: 1,
    chargeOnSuccess: true,
  });
  assert.equal(canAffordAiAction(normalizeCreditWallets({ ai_credits_total: 0 }), "deal_finder_analysis"), false);
  assert.equal(canAffordAiAction(normalizeCreditWallets({ ai_credits_total: 1 }), "deal_finder_analysis"), true);
});

test("product analytics keeps a strict non-PII property allowlist", () => {
  const events = readProjectFile("src/lib/analytics/events.ts");
  const privacy = readProjectFile("src/pages/privacy.astro");
  const cookieNotice = readProjectFile("src/components/CookieNotice.astro");
  const i18nMessages = readProjectFile("src/i18n/messages.ts");
  assert.match(events, /MAX_QUEUED_EVENTS = 50/);
  assert.match(events, /ALLOWED_PROPERTY_KEYS/);
  assert.match(events, /if \(!ALLOWED_PROPERTY_KEYS\.has\(key\)\) return \[\]/);
  assert.doesNotMatch(events, /"email"|"phone"|"raw_query"|"description"/);
  assert.match(events, /Analytics must never interrupt a product action/);
  assert.match(privacy, /до 50 технических событий/);
  assert.match(privacy, /без email, телефона, имени/);
  assert.match(cookieNotice, /messages\.cookieText/);
  assert.match(i18nMessages, /Рекламных и аналитических cookie нет/);
});
