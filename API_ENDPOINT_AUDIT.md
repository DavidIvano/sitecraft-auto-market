# SiteCraft Auto Market: API Endpoint Audit

> Исторический аудит от 23 июля 2026 года. Актуальные статусы, включая выпущенный translate-description и strict multilingual ограничения, находятся в `docs/xano/CURRENT_ENDPOINT_MANIFEST_RU.md` (11 августа 2026 года).

Audit date: 2026-07-23; Security updates: 2026-07-25. Xano API group: `sitecraft-auto-market` (421515), canonical prefix `api:jAAj839u`. Registration/credits stop-risk endpoints and the ten admin/AI endpoints listed in `ADMIN_SECURITY_AND_TEST_CREDITS_REMEDIATION.md` are now published. Endpoint IDs are included so findings can be located without relying on route-name searches.

## Summary

- Actual Xano endpoints inventoried: **57** (57 unique endpoint IDs in the tables below).
- Core marketplace endpoints: mostly `WORKING`.
- Frontend references with no matching Xano endpoint: commerce, dealer administration, several moderation image actions, and Deal Finder Stage 3 writes/delivery.
- `src/lib/apiRoutes.ts:80-102` is stale: `BACKEND_ROUTES_REQUIRING_XANO_WORK` labels several now-existing APIs as unfinished and omits newer gaps.

## Authentication and Identity

| ID | Method | Path | Auth | Status | Audit note |
| ---: | --- | --- | --- | --- | --- |
| 3968548 | POST | `/auth/login` | no | PARTIAL | functional; no observed rate limiting |
| 3968549 | POST | `/auth/register` | no | PARTIAL | takeover fixed: existing password/OAuth identities return HTTP 409 before writes; rate limiting and protected linking remain |
| 3968077 | GET | `/auth/me` | yes | WORKING | canonical session verification |
| 3968076 | GET | Google OAuth init | no | PARTIAL | no demonstrated state/PKCE contract |
| 3968099 | POST | Google OAuth continue | no | PARTIAL | redirect allowlist/provider restrictions unknown |

Registration now rejects existing password and OAuth-only identities with stable conflict codes and preserves all existing state. Remaining changes: add rate limits and a separate authenticated single-use account-link challenge; verify OAuth `state`/PKCE.

Admin security update: the two AI credit endpoints and all eight listed moderation/admin endpoints now authorize with `$auth.id` and the server-owned `admin` role only; active email and one-billion-credit bypasses were removed.

## Public Catalog, Analytics, and Search

| ID | Method | Path | Auth | Status | Audit note |
| ---: | --- | --- | --- | --- | --- |
| 3966698 | GET | `/cars` | no | WORKING | approved/public listing projection |
| 3966699 | GET | `/cars/{slug}` | no | WORKING | detail projection and intended seller contact |
| 3985671 | GET | `/cars/{slug}/seller-listings` | no | WORKING | related public inventory |
| 3981281 | POST | `/analytics/listing-view` | no | WORKING | public view event |
| 3981451 | POST | `/ai/search/intent` | no | BROKEN | provider-backed public AI, no credit charge/rate limit observed |
| 3981320 | POST | `/saved-searches` | yes | WORKING | authenticated saved search creation |

## Listing Creation, Drafts, and AI

| ID | Method | Path | Auth | Status | Audit note |
| ---: | --- | --- | --- | --- | --- |
| 3966700 | POST | `/cars` | yes | WORKING | manual listing creation |
| 3966701 | PATCH | `/cars/{id}/submit` | yes | WORKING | submits for moderation |
| 3974045 | POST | `/ai/generate-listing` | yes | PARTIAL | legacy flow; charges credit |
| 3979609 | POST | `/ai/listing/analyze-photos` | yes | WORKING | charges one credit and logs transaction |
| 3981498 | POST | `/ai/listing/generate-description` | yes | PARTIAL | implemented but no consistent charge |
| 3981478 | POST | `/ai/listing/quality-score` | yes | PARTIAL | implemented but no consistent charge |
| 3981578 | POST | `/ai/moderation/check-listing` | yes | PARTIAL | implemented; UI can fall back locally |
| 3982637 | POST | `/listings/create-draft` | yes | WORKING | AI draft entry |
| 3982675 | POST | `/listings/submit-moderation` | yes | WORKING | AI workflow submission |
| 3974028 | GET | `/dashboard/drafts/{id}` | yes | WORKING | owner draft read |
| 3974029 | PATCH | `/dashboard/drafts/{id}` | yes | WORKING | owner draft update |
| 3974031 | POST | `/dashboard/drafts/{id}/publish` | yes | WORKING | draft publishing |

Provider/model environment variables and live quotas are `UNKNOWN`; automated tests validate code contracts rather than making provider calls.

## Seller Dashboard, Credits, and Promotion

| ID | Method | Path | Auth | Status | Audit note |
| ---: | --- | --- | --- | --- | --- |
| 3968100 | GET | `/dashboard/listings` | yes | WORKING | user listings |
| 3995774 | GET | `/dashboard/listings/{id}` | yes | WORKING | owner-scoped detail |
| 3969714 | PATCH | `/dashboard/listings/{id}` | yes | WORKING | edit |
| 3983598 | PATCH | `/dashboard/listings/{id}/delete` | yes | WORKING | soft delete |
| 3995775 | POST | `/dashboard/listings/{id}/promote` | yes | WORKING | transaction, lock, idempotency, ledger |
| 3995777 | GET | `/dashboard/summary` | yes | PARTIAL | creates missing wallet with zero, unlike register/me credits |
| 3974027 | GET | `/me/credits` | yes | PARTIAL | read-only owner wallet response; no role/grant/email branches; missing wallet returns zero, while initialization still differs from register/summary |
| 3995776 | GET | `/dashboard/credits/transactions` | yes | WORKING | transaction history |

The current `user_credits` table has a single `ai_credits` balance. It cannot implement the documented free/paid/provider wallet policy without schema and ledger changes.

## Moderation and Administration

| ID | Method | Path | Auth | Status | Audit note |
| ---: | --- | --- | --- | --- | --- |
| 3966702 | GET | `/admin/moderation` | yes | WORKING | role-protected queue |
| 3966703 | PATCH | `/admin/cars/{id}/approve` | yes | WORKING | moderation action |
| 3966704 | PATCH | `/admin/cars/{id}/reject` | yes | WORKING | moderation action |
| 3979595 | PATCH | `/admin/cars/{id}/block` | yes | WORKING | moderation action |
| 3975051 | PATCH | `/admin/cars/{id}/delete` | yes | WORKING | moderation action |
| 3975107 | PATCH | `/admin/cars/{id}/sold` | yes | WORKING | moderation action |
| 3968561 | PATCH | `/admin/cars/{id}/assign-owner` | yes | WORKING | owner assignment |

Missing despite UI references:

| Method/path expected by UI | Status | Evidence/problem |
| --- | --- | --- |
| archive/restore listing endpoints | MISSING | actions represented in moderation UI, no Xano match |
| image delete | MISSING | `src/pages/admin/moderation.astro:890-973` |
| image primary/main | BROKEN | UI uses `/main`, route constant says `/primary`, neither exists |
| image add | MISSING | moderation upload cannot be persisted |
| GET `/admin/dealers` | MISSING | `src/pages/admin/dealers.astro` is UI/fallback only |
| paid product CRUD | MISSING | `src/pages/admin/paid-products.astro` fallback only |
| purchase admin list/actions | MISSING | `src/pages/admin/purchases.astro` fallback only |

## Deal Finder Internal Worker API

These routes are intended for Worker-to-Xano use. Scripts expect a shared secret even where Xano metadata marks auth false.

| ID | Method | Purpose | Status |
| ---: | --- | --- | --- |
| 3988244 | GET | active searches | WORKING |
| 3988250 | GET | existing source IDs | WORKING |
| 3988251 | POST | ingest listing | WORKING |
| 3988644 | POST | touch seen | WORKING |
| 3990129 | GET | pending analyses | WORKING |
| 3990130 | POST | claim analysis | WORKING |
| 3990131 | POST | complete analysis | WORKING |
| 3990132 | POST | fail analysis | WORKING |
| 3991402 | GET | preflight | WORKING |

`UNKNOWN`: live Worker secret values, deployment version, and cron execution were not available from repository/Xano metadata.

## Deal Finder Frontend API

| ID | Method | Path | Auth | Status |
| ---: | --- | --- | --- | --- |
| 3988688 | GET | `/deal-finder/stats` | yes | WORKING |
| 3988689 | GET | `/deal-finder/listings` | yes | PARTIAL: N+1 analysis lookup |
| 3988690 | GET | `/deal-finder/listings/{id}` | yes | WORKING |
| 3988692 | POST | listing view action | yes | WORKING |
| 3988693 | POST | save | yes | WORKING |
| 3988694 | POST | unsave | yes | WORKING |
| 3988695 | POST | hide | yes | WORKING |
| 3988696 | POST | restore | yes | WORKING |
| 3990128 | POST | analyze | yes | PARTIAL: queues, does not apply documented credit cost |
| 3988691 | GET | `/deal-finder/searches` | yes | PARTIAL: read only |

Missing Deal Finder contracts:

- POST/PATCH/DELETE search profiles: `MISSING`.
- POST translate description: `MISSING`.
- GET/PATCH workspace: `MISSING` (localStorage fallback in `src/lib/deal-finder/api.ts:316-339`).
- Server comparison storage: `MISSING`.
- Notification preferences and delivery records: `MISSING`.
- Inbox/email retrieval: `MISSING` (`getDealFinderEmails` returns `[]`, `src/lib/deal-finder/api.ts:348-351`).
- Sync logs/reporting: `MISSING`.

## Commerce and Dealer API Gaps

| Required contract | Status | Current caller |
| --- | --- | --- |
| POST `/purchases/create` | MISSING | legacy promotion/payment code |
| POST `/purchases/apply` | MISSING | `src/pages/payment/success.astro` |
| GET `/me/purchases` | MISSING | billing/purchase history expectation |
| Create checkout/payment session | MISSING | pricing has no working checkout |
| Verify payment webhook | MISSING | no provider integration found |
| Refund/chargeback/reconciliation | MISSING | no state machine found |
| GET/POST dealer profile | MISSING | `src/pages/dashboard/dealer.astro` |
| Subscription entitlement API | MISSING | dealer plans are UI-only |

Generic Xano `products`, `orders`, and `order_items` tables exist, but no endpoint in this API group connects them to Auto Market. Classify them as `BACKEND_ONLY/UNKNOWN`, not as completed commerce.

## Contract Drift and Required Cleanup

1. Regenerate `src/lib/apiRoutes.ts` from a reviewed endpoint manifest; remove the stale `BACKEND_ROUTES_REQUIRING_XANO_WORK` list (`src/lib/apiRoutes.ts:80-102`).
2. Add CI contract tests that compare frontend route constants with exported Xano metadata for method/path/auth requirements.
3. Keep unavailable commands out of production UI until their endpoints exist.
4. Version the Xano contract and record the required version in each frontend/Worker release.
5. Add staging integration tests for auth, listing lifecycle, moderation, credit deductions, promotion idempotency, and Deal Finder actions.

## Frontend and Worker Call-Site Map

| API family | Principal caller(s) | Response/state consumer |
| --- | --- | --- |
| auth login/register | `src/pages/login.astro:115-245`; `src/pages/register.astro:104-180` | `src/lib/authClient.ts` stores token/user and redirects |
| Google OAuth | `src/pages/login.astro`; `src/pages/auth/google/callback.astro:81-211` | callback stores session then resolves `next` route |
| public cars/detail | `src/pages/index.astro`; `src/pages/cars/index.astro:17-105`; `src/pages/cars/[slug].astro:17-84` | catalog cards, canonical detail, related listings |
| views/saved search/AI intent | `src/pages/cars/index.astro:694-1000`; `src/pages/cars/[slug].astro:820-840` | filters/explanation, saved-search message, analytics fire-and-forget |
| manual listing | `src/pages/dashboard/new.astro:3180-3428` | success/validation state and dashboard redirect |
| AI listing/drafts | `src/pages/dashboard/new.astro:2527-3140`; `functions/dashboard/drafts/[id].ts` | draft state, AI fields, balance/message, moderation submit |
| seller listing lifecycle | `src/pages/dashboard/listings.astro:90-145`; `src/pages/dashboard/listings/edit.astro:502-727` | list cards, edit/review/delete state |
| summary/credits/history | `src/pages/dashboard/index.astro:33-90`; `src/pages/dashboard/billing.astro:1-67` | counters, balance, transaction history |
| promotion | `src/pages/dashboard/cars/promote.astro:65-266` | confirmation, resulting balance, badges/toast |
| moderation | `src/pages/admin/moderation.astro:665-973` | queue/detail/action refresh and AI advice |
| Deal Finder frontend | `src/lib/deal-finder/api.ts:50-352`; `src/lib/deal-finder/client.ts` | feed, stats, detail, actions, filters and local fallbacks |
| Deal Finder internal | `workers/deal-finder-sync/src/xano-client.ts`; `workers/deal-finder-sync/src/index.ts:97-152` | sync counters, queue claims, completed/failed analyses |

All authenticated calls use `Authorization: Bearer <token>` through shared helpers or page-local fetch code. Xano remains responsible for owner/role checks; UI gating is not treated as authorization.

## API Definition of Done

- [ ] Every frontend mutation has one documented server endpoint with matching method/path.
- [ ] Authentication and role checks are server-enforced and covered by negative tests.
- [ ] Money/credits mutations are idempotent, transactional, and ledgered.
- [ ] Provider-backed endpoints have authentication, rate limits, budgets, and observability.
- [ ] Error schemas distinguish validation, unauthenticated, forbidden, conflict, quota, provider, and transient errors.
- [ ] Endpoint metadata is exported and validated in CI.
- [ ] Deprecated endpoints and callers have an owner and removal date.
