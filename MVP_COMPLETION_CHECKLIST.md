# SiteCraft Auto Market: MVP Completion Checklist

This checklist converts the audit into ordered delivery gates. Do not count an item complete because a page renders; server authorization, persistence, failure behavior, and production evidence are part of completion.

## Gate 0: Security Stop-Risk

- [x] **P0** Replace Xano POST `/auth/register` 3968549 behavior: an existing OAuth-only identity must never accept a new password through public registration. Published 2026-07-25.
- [ ] Add an authenticated account-link flow with reauthentication or a single-use verified challenge.
- [x] Preserve existing role and identity fields on duplicate registration attempts.
- [x] Remove hardcoded email role mutation and one-billion-credit grants from GET `/me/credits` 3974027.
- [x] Move the two existing owner roles to an audited, idempotent private migration; active authorization now uses the server role only. Published 2026-07-25.
- [ ] Add per-IP and per-identity login/register throttles, exponential backoff, and alerts.
- [ ] Add OAuth `state`, PKCE, single-use callback validation, and server-side redirect URI allowlist.
- [x] Add compact authorization contract tests for registration, read-only credits, two AI endpoints, eight admin endpoints and frontend role gating. Isolated staging E2E remains required for persisted-state assertions.
- [ ] Protect public provider-backed AI intent parsing with authentication or strict quota/rate/budget controls.
- [ ] Add production CSP, HSTS, `frame-ancestors`/frame policy, Permissions-Policy, and verify them on `automarket.sitecraft.agency`.
- [ ] Decide and document token migration from JS-readable localStorage/cookie to HttpOnly session/refresh design.

**Gate 0 exit:** no unauthenticated identity claim, role change, unlimited credit grant, or unbounded AI provider spend is possible.

## Gate 1: Core Marketplace Integrity

### Authentication and Account

- [ ] Email login/register and Google login pass staging E2E tests on desktop/tablet/mobile.
- [ ] Session survives refresh and internal navigation without false “login required” or “access denied” states.
- [ ] Logout invalidates both local session and server token as designed.
- [ ] Account error states distinguish network outage, expired session, and forbidden role.

### Catalog and Detail

- [x] Approved inventory list and detail endpoints exist.
- [x] Filters, sorting, seller contact, related listings, and view analytics exist.
- [ ] AI search use is metered/limited and included in the credit/provider policy.
- [ ] Remove or redirect legacy `/cars/detail/` after traffic/links are checked.
- [ ] Add API pagination/load tests for realistic inventory volume.

### Listing Creation

- [x] Manual listing create and moderation submission exist.
- [x] R2 upload validates auth, origin, type, and size.
- [x] AI photo analysis, drafts, description, score, and submission endpoints exist.
- [ ] Extract the 3,389-line `dashboard/new.astro` into workflow/state modules and focused components.
- [ ] Add idempotency to final create/submit operations so retries cannot duplicate listings.
- [ ] Add R2 orphan reconciliation/cleanup when Xano persistence fails.
- [ ] Display whether AI output is provider-generated or local fallback.
- [ ] Add staging E2E tests for manual success, AI success, provider failure, upload failure, draft resume, and duplicate submit.

### Seller Dashboard

- [x] List, load, edit, submit, soft-delete, summary, and promotion endpoints exist.
- [ ] Add consistent optimistic/pessimistic mutation handling and refresh reconciliation.
- [ ] Verify cross-user listing access is denied for every endpoint.

**Gate 1 exit:** a seller can create, resume, submit, edit, and manage a listing with no duplicate data or orphaned images, and a buyer can reliably find/contact the seller.

## Gate 2: Moderation and Trust

- [x] Queue, approve, reject, block, delete, sold, assign owner exist.
- [ ] Implement and test archive/restore or remove those controls.
- [ ] Implement image add/delete/set-primary with one canonical method/path, or remove controls.
- [ ] Require reason/audit metadata for destructive moderation actions.
- [ ] Display AI provider result separately from deterministic fallback.
- [ ] Add moderation event/audit-log table if current listing history is insufficient.
- [ ] Add admin E2E tests for roles, queue transitions, concurrent decisions, image changes, and blocked sellers.

**Gate 2 exit:** every visible moderation action is server-authorized, durable, auditable, and reversible where promised.

## Gate 3: Credits and Promotion

### Product Contract

- [ ] Decide whether the policy is 5 free/day capped at 50; publish one canonical matrix of earn/spend rules.
- [ ] Separate free, paid, promotional, and provider-budget concepts, or explicitly document why they share a balance.
- [ ] Extend ledger rows with wallet type, action, idempotency key, related entity, provider request/cost, and resulting balance.
- [ ] Implement idempotent daily replenishment with timezone, cap, retry, and audit semantics.
- [ ] Make registration, `/me/credits`, and `/dashboard/summary` initialize wallets identically.
- [x] Remove GET side effects from `/me/credits`; `/dashboard/summary` initialization remains a separate cleanup item.

### Charge Matrix

- [ ] Define and enforce costs for photo analysis, description, score, AI search, Deal Finder analysis, and promotion.
- [ ] Reserve/deduct/refund credits consistently around provider failures.
- [ ] Show cost before confirmation and resulting balance after completion.
- [ ] Add concurrency tests for two simultaneous spends and duplicate requests.

### Promotion

- [x] Owner, status, balance, transaction, lock, idempotency, expiry extension, and ledger exist.
- [ ] Separate promotion SKU definitions from AI/dealer product drift.
- [ ] Add expiry processing and catalog-ranking verification tests.
- [ ] Add admin reporting for active/expired promotion and credit liability.

**Gate 3 exit:** every displayed balance and price can be reconciled from an immutable ledger under retries and concurrency.

## Gate 4: Monetization

- [ ] Create a backend product catalog as the only source for pricing UI and entitlements.
- [ ] Add checkout/payment-session endpoint with authenticated user and server-side price lookup.
- [ ] Integrate a payment provider without trusting client amount/product fields.
- [ ] Verify signed, replay-safe webhooks and persist raw event IDs.
- [ ] Add order/purchase state machine: pending, paid, fulfilled, failed, refunded, disputed.
- [ ] Make fulfilment idempotent and reconcile payment events against credit ledger/subscriptions.
- [ ] Implement purchase history and admin purchase operations.
- [ ] Implement refunds/chargebacks and remove granted paid credits/entitlements safely.
- [ ] Add dealer profile, plan, subscription, renewal/cancellation, and entitlement enforcement.
- [ ] Correct pricing JSON-LD so only genuinely purchasable offers are advertised.
- [ ] Disable all paid CTAs until the complete path passes staging and provider sandbox tests.

**Gate 4 exit:** a payment can be initiated, verified, fulfilled, refunded, reconciled, and audited without manual database edits.

## Gate 5: Deal Finder Core and Scale

- [x] Worker sync/analysis source code and internal Xano queue contracts exist.
- [x] Authenticated feed, stats, detail, view/save/hide/restore, analyze queue, and search GET exist.
- [ ] Confirm production Worker SHA, secrets, cron schedules, health endpoint, and last-success telemetry.
- [ ] Put Worker deployment in the release workflow or require a versioned release record.
- [ ] Replace list/stats N+1 analysis queries with batch/joined/precomputed data.
- [ ] Add DB indexes and load tests for listings, current analysis, user actions, status, and timestamps.
- [ ] Implement POST/PATCH/DELETE search profiles.
- [ ] Implement description translation with provider budget/credit policy.
- [ ] Add retry/dead-letter visibility for failed source sync and AI analysis.
- [ ] Add stale-source and analysis-queue alarms.

**Gate 5 exit:** Deal Finder remains responsive and observable at target inventory volume, and all core controls persist server-side.

## Gate 6: Deal Finder Collaboration and Notifications

- [ ] Implement workspace GET/PATCH with user/team authorization.
- [ ] Persist comparisons server-side and support multi-device continuity.
- [ ] Implement notification preferences, dedupe keys, deliveries, retries, and unsubscribe controls.
- [ ] Implement email/inbox retrieval or remove the inbox route.
- [ ] Add sync-log/admin diagnostics.
- [ ] Replace localStorage preview states with explicit offline/local labels until server APIs exist.
- [ ] Remove unused `PUBLIC_DEAL_FINDER_STAGE3_API_ENABLED` or make it gate the completed server feature.

**Gate 6 exit:** searches, comparisons, notifications, and inbox work across devices and have delivery/audit evidence.

## Gate 7: UX, SEO, and Accessibility

- [ ] Test all key flows at 360, 768, 1024, and 1440 px with screenshots and overflow assertions.
- [ ] Keep Deal Finder cards single-column when metadata/buttons would split words.
- [ ] Use progressive filter disclosure on mobile catalog and Deal Finder.
- [ ] Normalize authenticated loading/empty/error/forbidden states across routes.
- [ ] Verify keyboard, focus, labels, contrast, reduced motion, and touch targets.
- [ ] Stabilize sitemap `lastmod`, include legal URLs, and remove inaccurate pricing offers.
- [ ] Ensure private/internal routes remain noindex and absent from sitemap.
- [ ] Add Web Vitals and business-action error telemetry.

## Gate 8: Release and Operations

- [ ] Record frontend SHA, Xano contract version, Worker SHA, migrations, secrets checklist, and environment for every release.
- [ ] Add staging environment with isolated Xano data, R2 prefix/bucket, Worker, and payment sandbox.
- [ ] Run check/test/build plus staging E2E and contract tests before production.
- [ ] Add synthetic probes for catalog, auth/me, upload, Xano status, Worker health, and cron freshness.
- [ ] Monitor 4xx/5xx, provider spend, credit imbalance, R2 failures, queue age, and webhook backlog.
- [ ] Document rollback for Pages, Xano scripts/schema, Worker, and product flags.
- [ ] Back up and restore-test critical Xano tables and R2 metadata.

## Recommended Execution Order

1. Gate 0 security stop-risk.
2. Gate 3 credit contract, because AI and monetization depend on it.
3. Finish Gate 1/2 missing integrity operations.
4. Gate 4 checkout/monetization.
5. Gate 5 Deal Finder scale/core writes.
6. Gate 6 collaboration/delivery.
7. Gate 7/8 polish and production operations throughout, with final release gate last.

## MVP Release Decision

Current decision: **NO-GO for unrestricted registration and paid launch**.
Current decision: **CONDITIONAL internal/staging use** for catalog, controlled seller listing workflows, moderation basics, promotion, and Deal Finder core, provided trusted accounts are used and credit/payment claims are not represented as complete.
