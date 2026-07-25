# SiteCraft Auto Market: Production Readiness Audit

Audit date: 2026-07-23; Security Stop-Risk update: 2026-07-25
Audited commit: `cdb94115892fa275f6670094a9ff2c0645530694` (`origin/main`, production build metadata matched)
Scope: repository, Cloudflare Pages configuration, read-only Xano metadata, and non-destructive production smoke checks.
Status vocabulary: `WORKING`, `PARTIAL`, `UI_ONLY`, `BACKEND_ONLY`, `BROKEN`, `MISSING`, `UNKNOWN`, `DISABLED`.

## Executive Summary

The project builds cleanly and its core marketplace is substantially implemented. Public inventory, vehicle detail pages, manual listing creation, R2 image upload, seller listing management, moderation basics, and credit-funded listing promotion have real frontend and backend contracts. The production commit passed `astro check`, the build, and all 222 automated tests.

The product is not yet ready for unrestricted production acquisition or paid monetization. The previously identified account-takeover path in Xano registration was closed in production on 2026-07-25, `/me/credits` is read-only, and the known AI/admin email and one-billion-credit bypasses are removed. The documented credit policy is still materially different from the deployed backend, and the pricing/billing UI has no complete checkout, payment, webhook, or purchase-fulfilment path. Deal Finder's core feed is operational, but search writes, translation, shared workspaces, notification delivery, and inbox delivery remain absent or local-only.

## Readiness Scorecard

The percentages are weighted engineering estimates, not telemetry. Each score considers implementation, server enforcement, test coverage, and production operability.

| Capability | Status | Readiness | Evidence |
| --- | --- | ---: | --- |
| Build, type safety, CI | WORKING | 95% | `package.json:6-16`; `.github/workflows/cloudflare-pages.yml:1-69`; 222/222 tests and clean build/check |
| Public catalog and vehicle detail | WORKING | 90% | `src/pages/cars/index.astro:17-105`; `src/pages/cars/[slug].astro:17-84`; Xano GET `/cars`, `/cars/{slug}` |
| Authentication and session continuity | PARTIAL | 75% | Xano POST `/auth/register` 3968549 now rejects existing password/OAuth identities before writes; rate limiting and protected account linking remain absent |
| Manual listing creation | WORKING | 90% | `src/pages/dashboard/new.astro:3180-3428`; Xano POST `/cars`, PATCH `/cars/{id}/submit` |
| AI-assisted listing creation | PARTIAL | 80% | `src/pages/dashboard/new.astro:2527-3140`; five real AI/draft endpoints, but inconsistent charging and local fallbacks |
| Seller dashboard and listing lifecycle | WORKING | 85% | `src/pages/dashboard/listings/edit.astro:502-727`; Xano dashboard list/edit/delete endpoints |
| Images and R2 | WORKING | 85% | `functions/api/upload-listing-images.ts:24-320`; `functions/api/r2-images/[[key]].ts:1-42`; orphan lifecycle absent |
| Moderation | PARTIAL | 70% | `src/pages/admin/moderation.astro:665-973`; core moderation endpoints exist, image/archive actions do not |
| Credits policy and ledger | BROKEN | 40% | `/me/credits` 3974027 is now read-only, but `src/lib/credits/model.ts:1-55`, `user_credits`, grants, and summary initialization still differ from policy |
| Listing promotion | WORKING | 85% | `src/pages/dashboard/cars/promote.astro:65-266`; Xano POST `/dashboard/listings/{id}/promote` 3995775 is transactional |
| Billing and checkout | UI_ONLY | 20% | `src/pages/pricing.astro:5-93`; `src/pages/dashboard/billing.astro:1-67`; purchase endpoints are missing |
| Dealer subscriptions | UI_ONLY | 10% | `src/pages/dashboard/dealer.astro`; `src/pages/admin/dealers.astro`; no matching tables/endpoints |
| Deal Finder core feed/actions | PARTIAL | 65% | `src/lib/deal-finder/api.ts:50-352`; Xano list/detail/stats/actions/analyze/search GET exist |
| Deal Finder Stage 3 collaboration | UI_ONLY | 20% | comparison/notifications/workspace are local-only; inbox returns `[]` |
| SEO and discoverability | WORKING | 85% | `src/layouts/BaseLayout.astro:24-58`; `src/pages/sitemap.xml.ts:1-90`; `src/pages/robots.txt.ts:1-22` |
| Security hardening | PARTIAL | 60% | known registration/admin credit bypasses fixed; public unmetered AI search, OAuth controls, JS-readable token, security headers and rate limiting remain |
| Production operations/observability | PARTIAL | 55% | Pages CI exists; Deal Finder Worker deploy and live secrets/cron remain independently managed and unverified |
| **Overall MVP readiness** | **PARTIAL** | **63%** | Weighted across the capabilities above |

## Architecture

### Application

- `WORKING`: Astro 7 static output with Cloudflare adapter (`astro.config.mjs:6-11`). Dynamic Pages Functions and on-demand routes provide server behavior.
- `WORKING`: Cloudflare Pages Advanced Mode is assembled by `scripts/prepare-cloudflare-pages.mjs:14-73` and deployed from `.github/workflows/cloudflare-pages.yml:1-69`.
- `WORKING`: Xano API URL is centralized in `src/lib/config.ts:1-6` and route names in `src/lib/apiRoutes.ts:1-73`.
- `PARTIAL`: frontend, Pages Functions, Xano, R2, and a separately deployed Deal Finder Worker form five operational surfaces. There is no single release manifest proving all versions/secrets are compatible.
- `UNKNOWN`: current Cloudflare Worker deployment version, cron state, and production secrets cannot be established from the repository.

### Production vs Preview

- The production custom domain and technical `pages.dev` domain serve the same Pages project/build, but they are different browser origins. Authentication storage, cookies, and localStorage are not shared between them.
- Canonical URLs use `PUBLIC_SITE_URL`/layout URL logic and should point to `https://automarket.sitecraft.agency`. Cloudflare/DNS redirect behavior from the old host was not proven by repository code and is `UNKNOWN`.
- CI deploys `main` with `PUBLIC_DEAL_FINDER_ENABLED=true` and mock data disabled (`.github/workflows/cloudflare-pages.yml:33-69`). Preview environment values can differ in Cloudflare dashboard and were not independently enumerated.
- `PUBLIC_DEAL_FINDER_USE_MOCK_DATA=true` activates `src/lib/deal-finder/mock-data.ts`; production workflow evidence and CI indicate it should be false. This fixture is `DISABLED` in production, not dead code.

### Data Stores

Read-only Xano metadata confirmed the following application tables:

| Domain | Tables | Status |
| --- | --- | --- |
| Users/auth | `automarket_users` (861779) | WORKING |
| Listings | `car_listings` (861468), `car_listing_images` (861469) | WORKING |
| Drafts/AI | `car_drafts` (863714), `car_draft_images` (863715), `ai_generation_logs` (863716), `ai_listing_checks` (866229), `ai_description_generations` (866234), `ai_search_logs` (866224) | WORKING |
| Credits | `user_credits` (863717), `credit_transactions` (863718) | PARTIAL: schema cannot represent the documented wallet model |
| Analytics/searches | `listing_views` (866168), `saved_searches` (866178) | WORKING |
| Deal Finder | `deal_finder_emails` (868285), `deal_finder_sync_logs` (868286), `deal_finder_searches` (868287), `deal_finder_listings` (868288), `deal_finder_analyses` (868289) | PARTIAL: tables exist, delivery/workspace APIs do not |
| Commerce | generic `products`, `orders`, `order_items` (806126/806127/806129) | BACKEND_ONLY/UNKNOWN: no Auto Market purchase API uses them |
| Dealers/subscriptions | none dedicated | MISSING |

## Core Workflows

### Authentication

- `WORKING`: email login, registration, Google OAuth continuation, and `/auth/me` are real Xano endpoints.
- `WORKING`: client retries one `401`, caches auth for five minutes, and does not erase a valid local session on transient server/network failures (`src/lib/authClient.ts:111-243`).
- `WORKING` (P0 remediated 2026-07-25): POST `/auth/register` (Xano endpoint 3968549) returns HTTP 409 for existing password and OAuth-only identities before any write, preserves password/role/OAuth/wallet state, and issues no token. Protected account linking is intentionally not implemented yet.
- `PARTIAL`: OAuth has no demonstrated `state` validation or PKCE. The redirect URI is supplied through the flow; provider-console restrictions are `UNKNOWN`.
- `PARTIAL`: login/register endpoints have no observed rate limit and server-side password policy is minimal.
- `WORKING` (stop-risk scope): GET `/me/credits` (3974027) requires auth, reads only `$auth.id`, performs no database mutation, returns zero for a missing wallet, and returns 401 without a token. Wallet initialization still differs from registration and `/dashboard/summary`.
- `PARTIAL`: token storage in localStorage and a JavaScript-readable cookie (`src/lib/authClient.ts:1-75`) makes XSS equivalent to session theft. No CSP was observed in production.

### Catalog and Listing Detail

- `WORKING`: public list/detail Xano endpoints return approved/public records and privacy-reduced projections.
- `WORKING`: catalog search, filters, sorting, AI intent parsing, and saved-search creation are implemented (`src/pages/cars/index.astro:246-1036`).
- `WORKING`: vehicle pages include canonical metadata, Vehicle/Offer structured data, seller contact links, related listings, and seller inventory (`src/pages/cars/[slug].astro:169-746`).
- `PARTIAL`: catalog logic is duplicated between server markup and a 1,038-line client implementation, raising drift risk.
- `BROKEN` (cost/security): POST `/ai/search/intent` is public, invokes AI, has no observed rate limiting, and deducts no credits. Anonymous callers can create provider cost.

### Listing Creation and Editing

- `WORKING`: manual creation validates form/contact data, uploads R2 images, creates a listing, and submits it to moderation (`src/pages/dashboard/new.astro:3180-3428`).
- `WORKING`: AI photo analysis, draft creation/update, description generation, quality scoring, and moderation submission have real Xano endpoints (`src/pages/dashboard/new.astro:2527-3140`).
- `PARTIAL`: only some AI operations deduct credits. Local deterministic fallbacks can make the UI appear successful while provider-backed execution did not happen.
- `PARTIAL`: `src/pages/dashboard/new.astro` is 3,389 lines, mixing two workflows, DOM state, validation, uploads, AI, credits, and submission. This is a maintainability and regression hotspot.
- `WORKING`: seller edit, submit-for-review, soft-delete, and dashboard summaries have real owner-scoped endpoints.

### Images and R2

- `WORKING`: upload accepts at most 8 images, 1 MB each/8 MB batch, validates MIME and origin, verifies Xano auth, uses user-scoped keys, and cleans partial batch failures (`functions/api/upload-listing-images.ts:24-320`).
- `WORKING`: public image delivery sanitizes keys and emits immutable cache headers (`functions/api/r2-images/[[key]].ts:1-42`).
- `PARTIAL`: if R2 upload succeeds but Xano listing/draft creation later fails, no compensating cleanup or scheduled orphan collector exists.
- `PARTIAL`: `R2_PUBLIC_BASE_URL` in `wrangler.toml:24-32` points to the old `pages.dev` hostname rather than the custom production host. It still resolves but creates avoidable domain coupling.

### Moderation

- `WORKING`: list, approve, reject, delete, sold, block, assign-owner, and AI moderation endpoints exist and enforce backend auth/roles.
- `PARTIAL`: the UI exposes archive/restore and image add/delete/primary operations for which no Xano endpoints exist (`src/pages/admin/moderation.astro:890-973`).
- `BROKEN`: the UI calls `/images/{id}/main`, while route constants describe `/primary`; neither endpoint exists. This is both a contract mismatch and missing backend.
- `PARTIAL`: AI moderation has a deterministic local fallback, so operators need a visible distinction between provider verdict and fallback verdict.

### Credits, Promotion, and Billing

- `WORKING`: listing promotion is owner-scoped, uses a transaction and row lock, checks status/balance, supports idempotency, extends an active period, deducts credits, and writes a ledger entry. Products cost 5/12/20 credits (`src/lib/promotions/model.ts:3-40`; Xano endpoint 3995775).
- `BROKEN`: documented policy says 5 free credits/day with cap 50 and distinct free/paid/provider concepts (`src/lib/credits/model.ts:1-55`; `docs/product/credits-policy.md:14-74`). Deployed Xano has one `ai_credits` balance, grants 10 welcome credits, and has no daily replenishment/cap job.
- `BROKEN`: AI photo analysis and legacy generation charge one credit; description, quality score, AI search, and Deal Finder analysis do not. Costs shown to users are not a reliable contract.
- `UI_ONLY`: pricing links and billing history render, but checkout, payment intent/session, webhook verification, purchase fulfilment, refunds, and `/purchases/*` endpoints are missing.
- `UI_ONLY`: dealer plans/profile/admin screens have no dedicated table or API.
- `BROKEN`: `src/lib/monetization.ts:4-58` defines AI credits and dealer plans but omits the promotion SKUs that `src/pages/pricing.astro:5-93` tries to filter. The page therefore advertises a purchase journey it cannot execute.

### Deal Finder

- `WORKING`: authenticated stats, listings, detail, view/save/hide/restore actions, analysis queueing, and search listing have real Xano endpoints.
- `WORKING`: a separate Worker contains secret-protected sync/analysis routes, bounded source limits, cron handlers, and health reporting (`workers/deal-finder-sync/src/index.ts:97-152`).
- `PARTIAL`: POST/PATCH/DELETE search profiles, translation, workspace persistence, server-side comparison, notification preferences/deliveries, sync-log views, and inbox delivery endpoints are missing.
- `UI_ONLY`: comparison and notifications use localStorage. Inbox API returns an empty array unconditionally (`src/lib/deal-finder/api.ts:316-351`; `src/lib/deal-finder/notifications.ts:1-165`).
- `PARTIAL`: list/stats Xano scripts query latest analyses inside listing loops, creating N+1 and 2N+1 query patterns. This will degrade as inventory grows.
- `UNKNOWN`: Pages CI does not deploy the Worker. Current production Worker code, secrets, cron schedules, and AI provider availability were not changed or destructively tested.

### AI Implementation Details

| Function | Status | Contract and controls |
| --- | --- | --- |
| Legacy listing generation | PARTIAL | Xano POST `/ai/generate-listing` 3974045; charges credit, retained as legacy path |
| Photo analysis/spec extraction | WORKING | POST `/ai/listing/analyze-photos` 3979609; authenticated, deducts one credit |
| Description generation | PARTIAL | POST `/ai/listing/generate-description` 3981498; authenticated, charge/refund policy incomplete |
| Listing quality score | PARTIAL | POST `/ai/listing/quality-score` 3981478; authenticated, charge policy incomplete |
| Moderation advice | PARTIAL | POST `/ai/moderation/check-listing` 3981578; local fallback can replace provider response |
| Buyer intent parsing | BROKEN | POST `/ai/search/intent` 3981451 is public and unmetered |
| Deal Finder analysis | PARTIAL | Worker Responses API call plus Xano queue/results; no user credit deduction and live deployment unknown |
| Price/comparable valuation | MISSING | no verified comparable-data endpoint; Deal Finder explicitly caps confidence without comparables |

Deal Finder AI is the most auditable provider integration in the repository. `workers/deal-finder-sync/src/analysis.ts:153-164` uses the Responses API with `store:false`, `max_output_tokens:1500`, `reasoning.effort:"low"`, and strict JSON Schema Structured Outputs. `workers/deal-finder-sync/src/openai-client.ts:21-61` applies a 30-second bounded timeout, classifies auth/rate-limit/timeout/invalid/upstream failures, validates parsed JSON, stores response ID and safe token usage, and does not blindly accept model output. Agent-source requests have one retry for selected transient statuses (`workers/deal-finder-sync/src/kleinanzeigen-agent-client.ts:20-31`).

The configured Worker model is `DEAL_FINDER_OPENAI_MODEL` with repository default/current Wrangler value `gpt-5.6-luna` (`workers/deal-finder-sync/src/env.ts:53-61`; `workers/deal-finder-sync/wrangler.toml:18-26`). Whether that model identifier is enabled in the production OpenAI account is `UNKNOWN`; repository configuration alone does not prove a successful live call. Worker secrets required are `OPENAI_API_KEY`, `KLEINANZEIGEN_AGENT_API_KEY`, `XANO_API_BASE_URL`, `XANO_DEAL_FINDER_INGEST_SECRET`, and `DEAL_FINDER_WORKER_TRIGGER_SECRET`.

### SEO and Legal

- `WORKING`: global canonical, Open Graph, Twitter, JSON-LD support, robots policy, and dynamic sitemap exist.
- `WORKING`: Deal Finder and private routes are kept out of public discovery.
- `PARTIAL`: static sitemap routes receive the current time on every request, producing noisy `lastmod` signals.
- `PARTIAL`: pricing structured data can imply purchasable offers although no checkout is available.
- `PARTIAL`: `impressum` is linked but absent from the explicit static sitemap list (`src/pages/sitemap.xml.ts:1-90`).

## Security Findings

| Priority | Status | Finding | Required remediation |
| --- | --- | --- | --- |
| P0 | WORKING | Registration account-claim path closed in production (Xano 3968549) | Keep conflict regression tests; build future account linking as a separate authenticated, verified challenge |
| P0 | BROKEN | Public unmetered AI search can create unlimited provider cost (Xano 3981451) | Require auth or strict IP/user rate limits, quotas, provider budget guard, and auditable metering |
| P1 | WORKING | `/me/credits` role/1B-credit side effects removed in production (3974027) | Keep GET read-only and move all grants/roles to audited commands |
| P1 | WORKING | Hardcoded email privilege/1B-credit branches removed from the two AI and eight admin endpoints; owners use server role plus idempotent audit ledger | Keep the role-only regression scan and private rollback backups |
| P1 | PARTIAL | No observed login/register rate limiting | Add per-IP and per-identity throttles, lockout/backoff, monitoring |
| P1 | PARTIAL | OAuth state/PKCE not demonstrated | Generate/store/validate single-use `state`; add PKCE; allowlist redirect URIs server-side |
| P1 | PARTIAL | Bearer token is readable by JavaScript | Prefer Secure HttpOnly SameSite cookie with CSRF protection, short-lived access/rotating refresh token |
| P1 | PARTIAL | Production lacks observed CSP, HSTS, frame and Permissions-Policy headers | Add Cloudflare `_headers`, test on custom domain, keep required sources explicit |
| P2 | PARTIAL | Public R2 objects have no retention/orphan policy | Define intended public visibility, lifecycle retention, orphan reconciliation and deletion audit |

## Page, API, and Data Maps

The complete route-by-route record is in `ROUTE_READINESS_MATRIX.md`; the method/path/auth inventory is in `API_ENDPOINT_AUDIT.md`; user sequences are in `PROJECT_WORKFLOW_MAP.md`. These are audit evidence, not proposed endpoints.

Key route conclusions:

- `WORKING`: `/`, `/cars/`, `/cars/[slug]/`, `/sell/`, seller dashboard/listings, canonical promotion, legal/support, robots.
- `PARTIAL`: `/dashboard/new/`, `/admin/moderation/`, billing history, and Deal Finder core routes.
- `UI_ONLY`: dealer administration/profile, paid-product/purchase administration, Deal Finder comparison/notifications/inbox.
- `BROKEN`: paid pricing/checkout journey and payment-success fulfilment. Registration takeover is remediated; abuse controls and protected linking remain partial.
- `PARTIAL/DEPRECATED`: `/cars/detail/` and the legacy dynamic promotion page duplicate or are superseded by canonical routes.

The frontend API client uses `PUBLIC_XANO_API_URL` through `src/lib/config.ts:1-6`; the canonical deployed group is `api:jAAj839u`. Images use Pages Functions and the `CAR_IMAGES` R2 binding. Deal Finder additionally needs `PUBLIC_DEAL_FINDER_ENABLED`, Worker Xano/agent/OpenAI secrets, and cron deployment; exact live secret values are intentionally `UNKNOWN`.

## Authentication Workflow Detail

| Step | Status | Evidence/result |
| --- | --- | --- |
| Open/validate email form | WORKING | `src/pages/login.astro:115-245`; `src/pages/register.astro:104-180` |
| POST credentials | WORKING | Xano `/auth/login` 3968548, `/auth/register` 3968549 |
| Create/find user | WORKING | new user is server-owned `user`; existing password/OAuth identities return safe 409 conflicts without mutation |
| Return/store token | WORKING | 60-day Xano token; localStorage + JS cookie in `src/lib/authClient.ts:1-75` |
| Redirect and load `/auth/me` | WORKING | GET `/auth/me` 3968077; cached/retried by `fetchCurrentUser` |
| Persist after refresh | PARTIAL | works on one origin; localStorage/cookies do not cross from `pages.dev` to custom domain |
| Logout | WORKING/PARTIAL | local credentials are cleared; server revocation semantics were not confirmed |
| Google init/callback | PARTIAL | endpoints and callback work, but state/PKCE enforcement is not demonstrated |

### Known “AI draft redirects to login” path

The current creation page passes the same Bearer token to R2 upload and Xano AI/draft calls (`src/lib/listingImageUpload.ts:94-150`; `src/pages/dashboard/new.astro:2536-2749`). The earlier broad failure interpretation has been narrowed: `recoverAuthOrRelogin` now calls `/auth/me` and redirects only when expiry is confirmed; a valid session gets a temporary-service message (`src/pages/dashboard/new.astro:826-840`). The upload Function also distinguishes Xano 5xx/invalid auth response as `503 AUTH_SERVICE_UNAVAILABLE`, not `401` (`functions/api/upload-listing-images.ts:133-187`).

Remaining risks:

- A real 401 from individual AI calls still starts recovery (`src/pages/dashboard/new.astro:2603-2626`, `2864-2901`, `2999-3000`). This is correct only if `/auth/me` is authoritative and available.
- The dynamic draft Function uses `sitecraft_auto_market_auth_user` instead of shared `sitecraft_auto_market_user` (`functions/dashboard/drafts/[id].ts:169-187`). Token key matches, so this is a user-cache inconsistency rather than the primary redirect cause.
- Moving between `sitecraft-auto-market.pages.dev` and `automarket.sitecraft.agency` necessarily creates separate browser storage. Production links should stay on the custom origin.

## Listing State Machine

Canonical status logic is in `src/lib/listingStatus.ts:1-236`. It normalizes legacy `pending -> pending_review` and `active -> published`, separates lifecycle from moderation status, and detects conflicting combinations.

| Current status | Action/actor | Next status | Status |
| --- | --- | --- | --- |
| `draft` / `ai_draft` | seller submit | `pending_review` | WORKING |
| `pending_review` | admin approve | `approved`/`published` | WORKING |
| `pending_review` / `needs_fix` | admin reject | `rejected`/`needs_fix` | WORKING |
| `rejected` / `needs_fix` | seller edit + resubmit | `pending_review` | WORKING |
| approved/published | admin mark sold | `sold` | WORKING |
| eligible nonterminal | admin block/delete | `blocked`/`deleted` | WORKING |
| approved/published | admin archive | `archived` | UI_ONLY/MISSING endpoint |
| archived | admin restore | prior/public state | UI_ONLY/MISSING endpoint |

Public status policy includes `approved`, `published`, and `sold`; private status policy includes drafts, pending, fix/reject, blocked, deleted, and archived (`src/lib/listingStatus.ts:150-165`). A sold listing remains publicly visible with sold disclosure. Conflict detection blocks moderation actions when lifecycle and moderation columns disagree (`src/lib/listingStatus.ts:69-119`). The frontend model includes `ready_for_review`, but it is a presentation/workflow label rather than a confirmed Xano terminal state.

## Listing Workflow Detail

| Step | Manual | AI | API/table | Remaining issue |
| --- | --- | --- | --- | --- |
| Choose mode and validate | WORKING | WORKING | frontend | monolithic page complexity |
| Upload photos | WORKING | WORKING | Pages Function -> R2; image URLs later stored in listing/draft tables | no final-operation orphan cleanup |
| Create draft | PARTIAL | WORKING | AI: POST `/listings/create-draft`; `car_drafts`, `car_draft_images` | manual path creates final listing directly rather than a resumable draft |
| Analyze photos | not applicable | WORKING | POST `/ai/listing/analyze-photos`; AI logs/check tables | charges one shared credit |
| Detect make/model/specs | not applicable | WORKING/PARTIAL | same AI response, normalized in `dashboard/new.astro:2527-2630` | provider accuracy/live model not verified |
| Generate description | manual text | PARTIAL | POST `/ai/listing/generate-description` | no consistent charge; fallback may be used |
| Quality review | manual validation | PARTIAL | POST `/ai/listing/quality-score` | no consistent charge; fallback may be used |
| Edit/save | WORKING | WORKING | PATCH draft/listing endpoints | no cross-device draft E2E evidence |
| Submit moderation | WORKING | WORKING | PATCH `/cars/{id}/submit` or POST `/listings/submit-moderation` | idempotent retry not documented |
| Admin decision | WORKING | WORKING | admin moderation endpoints; `car_listings` | image/archive controls missing |
| Public catalog | WORKING | WORKING | GET `/cars`, GET `/cars/{slug}` | requires approved public state, no rebuild for dynamic detail/client list |
| Mark sold | WORKING | WORKING | PATCH admin sold endpoint | seller-self-service sold contract not separately confirmed |

## Dashboard and Vehicle Detail Gaps

- Dashboard summary values for published/pending/draft/promoted listings and active promotion classes come from GET `/dashboard/summary` and are rendered in `src/pages/dashboard/index.astro:33-79`; they are not mock counters.
- Credit history comes from GET `/dashboard/credits/transactions`; purchase history is absent.
- Listing views are collected, but a complete seller analytics dashboard is not present.
- Editing and soft deletion work; archive, restore, and republish are not complete seller workflows.
- Vehicle gallery, thumbnails, lightbox, zoom/fullscreen controls, seller phone/email, description/specifications, related listings, views, canonical, breadcrumbs, Open Graph, and Vehicle/Offer JSON-LD are implemented (`src/pages/cars/[slug].astro:117-746`, `848-900`; `src/lib/media/lightbox.ts:58-170`).
- Favorites and abuse/report actions are `MISSING` on the canonical vehicle page. Similar listings are computed from real catalog data; no dedicated recommendation endpoint is required for the current implementation.

## Promotion Workflow Detail

| Expected step | Status | Evidence/problem |
| --- | --- | --- |
| Select own published listing | WORKING | dashboard actions and server owner check |
| Open promotion products/cost | WORKING | 5/12/20 definitions in `src/lib/promotions/model.ts:3-40` |
| Load current balance | WORKING | dashboard summary/wallet endpoint |
| Confirm operation | WORKING | dialog in `src/pages/dashboard/cars/promote.astro:65-266` |
| Send token, listing ID, product, idempotency key | WORKING | canonical promotion client/backend contract |
| Verify owner and eligible status | WORKING | Xano 3995775 rejects foreign/ineligible listings |
| Atomically check/deduct balance | WORKING | transaction + wallet row lock |
| Write credit transaction | WORKING | `credit_transactions` |
| Set promotion type/start/expiry | WORKING | listing promotion fields; existing expiry is extended |
| Prevent duplicate double-click spend | WORKING | client disable plus backend idempotency |
| Update UI balance/history | WORKING | response reconciliation and history endpoint |
| Affect catalog order/card/detail | WORKING | `src/lib/monetization.ts:2-83`; promotion badges/detail disclosure |
| Expire automatically | PARTIAL | time-based active checks exist; no separately verified expiry cleanup/monitor |

The current canonical credit-funded promotion works. The old `src/pages/dashboard/cars/[id]/promote.astro` purchase/checkout implementation does not: a Pages Function redirects it to the canonical route, and its `/purchases/create` dependency is missing.

## Notifications and External Delivery

| Channel/event | Status | Evidence |
| --- | --- | --- |
| Deal Finder email preferences/history | UI_ONLY | localStorage UI in `src/lib/deal-finder/client.ts:901-954` |
| Web Push | UI_ONLY | no service-worker subscription/VAPID/backend delivery found |
| Moderation outcome email | MISSING | no sender contract/provider found |
| New vehicle/search alert | MISSING | saved search exists; delivery does not |
| Promotion expiry | MISSING | no delivery job |
| Low balance | MISSING | no delivery job |
| SendGrid/Resend/Postmark/SMTP | MISSING | no production provider integration or sender domain found |

The Deal Finder email table alone does not prove outbound delivery. Source inbox reading is also not connected: `getDealFinderEmails` returns `[]` (`src/lib/deal-finder/api.ts:348-351`).

## UI/UX and Design System

- `WORKING/PARTIAL`: common `BaseLayout`, header/sidebar/footer, shared tokens, status badges, buttons, loading/error panels, and 44px promotion controls provide a coherent base.
- `PARTIAL`: protected pages can show a static loading shell before client auth resolves. A forbidden state must only appear after a definitive 403, not a transient service error.
- `PARTIAL`: catalog AI search plus full filters consume excessive vertical space on mobile; progressive disclosure is preferable.
- `PARTIAL`: seller creation and moderation pages are large mixed-responsibility files, making state/error consistency hard to maintain.
- `PARTIAL`: Deal Finder needs explicit 360/768/1024 layout QA; one-column cards are required before city, mileage, and action labels become fragmented.
- `UI_ONLY`: Liquid Glass/macOS styling components exist but several are unreferenced; visual styling is not evidence of a completed workflow.
- `UNKNOWN`: a complete WCAG keyboard/screen-reader audit was not executed. Existing labels, ARIA live regions, focus/touch styling are positive but insufficient proof.

## Unfinished Initiatives

| Initiative | Started | Stop point / dependency | Completion condition |
| --- | --- | --- | --- |
| Credits v2 | policy, UI, wallet, ledger | schema/grants/charges differ | one authoritative wallet/ledger contract and daily job |
| Paid promotion/credits | promotion works, pricing exists | no checkout/webhook/fulfilment | reconciled provider payment and idempotent fulfilment |
| AI Draft | full core UI/API | charge/fallback/provider observability inconsistent | defined costs, source labels, failure refund/retry tests |
| Dealer plans | pricing/profile/admin screens | no tables/endpoints/entitlements | subscription lifecycle and enforced entitlements |
| Deal Finder Stage 3 | compare/notification/workspace UI | localStorage and missing writes/delivery | persistent multi-device APIs and delivery evidence |
| Moderation media | controls designed | method/path mismatch and absent API | authorized add/delete/primary lifecycle + audit |
| Notifications | local preferences/history model | no provider, VAPID, jobs, deliveries | verified opt-in, send, dedupe, retry, unsubscribe |
| R2 lifecycle | secure upload/read | no orphan/deletion reconciliation | reference-aware cleanup and retention monitor |
| Seller analytics | views and summary exist | no detailed reporting | scoped metrics definitions and dashboard |
| Favorites/reports | product expectation | no canonical detail actions/API | tables, authorized endpoints, abuse workflow |
| VIN enrichment/import | listing fields/AI hints | no verified external contract | provider/legal policy, validation, provenance |

Detailed cleanup candidates and dependencies are in `DEAD_CODE_AND_TODO_REPORT.md`.

## Dead Code and Technical Debt

Confirmed unreferenced candidates are the three `src/components/mac/Mac*.astro` components, four unused Deal Finder Astro card/state/image components, `src/lib/mockCars.ts`, unused exports in `src/lib/server/r2.ts`, and the unread `PUBLIC_DEAL_FINDER_STAGE3_API_ENABLED` flag. The legacy dynamic promotion Astro page is superseded by a Pages Function redirect, while `/cars/detail/` duplicates the canonical slug detail route. These are cleanup candidates, not authorization to delete them: route traffic, dynamic consumers, and planned design-system adoption must be checked first. The full evidence, fallback/mock distinction, and safe cleanup order are in `DEAD_CODE_AND_TODO_REPORT.md`.

## Full Module Readiness Matrix

The rubric weights complete UI-to-database workflow (50%), server authorization/integrity (25%), automated/staging evidence (15%), and production operability (10%). A missing critical security control caps the relevant module below production-ready.

| Module | Readiness | Evidence basis |
| --- | ---: | --- |
| Architecture | 85% | Astro/Pages/Xano/R2 separation and CI work; multi-surface release coupling remains |
| Authentication | 75% | primary endpoints/session recovery exist and P0 registration claim is closed; rate limits, OAuth state/PKCE, and protected linking remain |
| Catalog | 88% | real list/filter/sort/search/cards; pagination/AI abuse/duplication reduce score |
| Vehicle page | 90% | dynamic data, gallery/contact/SEO/related/views; favorites/report absent |
| Listing creation | 88% | manual end-to-end path real; orphan/idempotency/monolith risks |
| AI Draft | 78% | real photo/draft/description/score APIs; charging/fallback/provider verification incomplete |
| Moderation | 70% | core decisions server-backed; media/archive/audit gaps |
| Dashboard | 82% | summary/list/edit/delete/promotion/history real; profile/analytics/archive gaps |
| Credits | 40% | balance/ledger exist; policy, grants, wallet separation, charge matrix broken |
| Promotion | 85% | transactional/idempotent flow and catalog treatment; expiry operations need evidence |
| Billing | 20% | balance/history UI only; checkout/webhook/order/fulfilment missing |
| Images/R2 | 85% | validated authenticated upload and delivery; deletion/orphan/derivatives missing |
| Deal Finder | 65% | core Worker/API/feed/actions real; scale, persistence, delivery, deploy evidence incomplete |
| Notifications | 10% | local preview only; no provider/delivery/push backend |
| SEO | 85% | canonical/sitemap/robots/JSON-LD; domain redirect and pricing accuracy need work |
| UI/UX | 72% | shared system and responsive work; dense monoliths/tablet/auth-state issues remain |
| Security | 50% | P0 identity flaw and wallet GET side effects are closed; public AI abuse and other hardcoded privilege/credit branches remain |
| Production readiness | 55% | clean build/tests and live core; security, payments, coordinated operations block launch |

Derived stage scores using those weighted modules:

- **Prototype readiness: 88%** — primary screens and most demonstrations are real.
- **MVP readiness: 63%** — core marketplace works, but security and contract gaps block open launch.
- **Production readiness: 55%** — release mechanics exist; identity, observability, consistency, and unfinished visible controls remain.
- **Commercial launch readiness: 30%** — promotion can spend internal credits, but acquiring paid credits/plans cannot be completed or reconciled.

## Production Verification

Completed without changing production data:

- `npm test`: 222 passed, 0 failed.
- `npm run check`: 167 files, 0 errors, warnings, or hints.
- `npm run build`: successful; Advanced Mode `_worker.js` generated.
- Production build metadata matched commit `cdb94115892fa275f6670094a9ff2c0645530694`.
- Public and protected-shell routes returned HTTP 200, including catalog, detail, auth, dashboard, moderation, billing, Deal Finder, legal, robots, and sitemap routes.
- Public Xano inventory returned 10 records during the audit.

Not verified:

- Authenticated destructive flows in production (register, listing mutation, credit deduction, promotion, moderation).
- Payment provider because no complete payment flow exists.
- Live Deal Finder Worker version, cron execution, or secret set.
- Email/notification delivery because no delivery contract exists.

## Launch Blockers

### Top Three MVP Blockers

1. **P0 account takeover in registration.** Do not open registration broadly until an existing OAuth identity cannot be claimed.
2. **Credit contract mismatch.** Product copy, balance schema, deductions, grants, and scheduled replenishment must agree and be testable.
3. **Incomplete operational contracts.** Finish or hide moderation actions and Stage 3 Deal Finder controls that currently call missing endpoints.

### Top Three Monetization Blockers

1. No checkout/payment/webhook/fulfilment path for credits or plans.
2. No separation of free, paid, and provider-budget balances; promotion currently spends the AI balance.
3. Dealer subscriptions and admin purchase/product management are UI-only, while pricing presents them as products.

## Recommended Roadmap

### Phase 0: Stop-Risk Gate

- Fix account linking/registration takeover and remove role/credit backdoors.
- Add auth and AI abuse controls plus baseline security headers.
- Freeze a written credit contract and mark unavailable products/actions as disabled in UI.

### Phase 1: Core MVP Integrity

- Implement the wallet schema, daily grant job, idempotent ledger, and consistent charge matrix.
- Complete or remove broken moderation image/archive actions.
- Add authenticated integration tests against a staging Xano workspace for listing create/edit/moderate/promote.

### Phase 2: Monetization

- Add product catalog, checkout session, webhook verification, purchase/order state machine, fulfilment, refund/chargeback handling, and admin audit.
- Implement dealer profile/subscription tables and entitlement enforcement.
- Make pricing derive exclusively from the backend product catalog.

### Phase 3: Deal Finder Productization

- Add search writes, translation, workspace, comparison persistence, notification preferences/deliveries, inbox, and sync-log APIs.
- Remove analysis N+1 queries and add pagination/index/load tests.
- Put Pages and Worker deployments under one release checklist with health/cron alarms.

### Dependency-Prioritized Backlog

| Priority | Task | Dependency | Main files/endpoints | Expected result / Definition of Done | Risk |
| --- | --- | --- | --- | --- | --- |
| P0 | Secure duplicate registration/account linking | none | Xano POST `/auth/register` 3968549; login/register/callback pages | OAuth-only account cannot be claimed; role preserved; negative tests pass | identity compromise |
| P0 | Remove wallet GET role/credit backdoor | none | Xano GET `/me/credits` 3974027; `automarket_users`, `user_credits` | GET is side-effect free; roles changed only through audited admin flow | privilege/financial integrity |
| P0 | Bound public AI spend | auth/rate-limit choice | POST `/ai/search/intent` 3981451; catalog | quota and provider budget enforced and observable | unbounded cost |
| P1 | Canonical credit and charge contract | P0 wallet cleanup | `src/lib/credits/model.ts`; Xano wallet/ledger and all AI endpoints | grants/deductions/refunds are atomic, idempotent and match UI | inconsistent balances |
| P1 | Close listing/moderation integrity gaps | credit rules for AI | `dashboard/new.astro`; moderation image/archive endpoints; R2 | create-to-publish and media lifecycle pass staging E2E | data/orphan loss |
| P2 | Build commerce state machine | canonical wallet/product catalog | pricing, billing, checkout/webhook/purchase APIs | sandbox payment can be verified, fulfilled, refunded and reconciled | payment loss/fraud |
| P2 | Dealer subscriptions/entitlements | commerce | dealer pages; new profile/subscription tables/APIs | plan lifecycle changes server-enforced access | false product claims |
| P3 | Scale and complete Deal Finder | stable auth/credits | Worker, list/stats queries, search writes, workspace/delivery APIs | target-load SLO plus persistent multi-device workflow | latency/provider spend |
| P3 | Notifications/observability/SEO accuracy | event contracts | delivery tables/provider/VAPID, sitemap/pricing metadata | opt-in delivery with retries plus accurate public metadata | spam/reputation |
| P4 | UX refactor and extended AI/import/VIN | stable workflows | three monolithic pages, design components, provider contracts | responsive/a11y QA and maintainable state modules | regression/scope growth |

## Definition of Done for Production MVP

- [x] Registration cannot attach credentials to an existing identity without verified authenticated linking.
- [ ] Login/register/OAuth have rate limits, state validation, redirect allowlist, and security tests.
- [ ] Credit balances and all charge/grant rules match the published policy exactly.
- [ ] Every visible command maps to an implemented, authorized, tested endpoint or is visibly disabled.
- [ ] Manual and AI listing flows pass staging E2E tests including R2 cleanup on failure.
- [ ] Moderation actions are role-protected and tested through approve/reject/block/delete/image lifecycle.
- [ ] Promotion is idempotent and ledger/balance/listing expiry remain consistent under concurrency.
- [ ] Paid products have verified checkout, webhook, fulfilment, refund, and reconciliation flows.
- [ ] CSP/HSTS/frame/permissions headers are present on the custom domain.
- [ ] Production monitoring covers Pages, Xano errors, R2 upload failures, AI spend, Worker health, and cron freshness.
- [ ] Rollback procedures and a single release compatibility record cover frontend, Pages Functions, Xano, and Worker.

## Definition of Done for Production

- [ ] All MVP criteria above are met in an isolated staging environment and verified by automated E2E/contract tests.
- [ ] Payment, AI, email/push, Worker cron, R2, and Xano have production dashboards, budgets, alerts, and named responders.
- [ ] Security review closes Critical/High findings; headers, rate limits, OAuth, session, IDOR, upload, and admin tests are evidenced on the custom domain.
- [ ] Backups and restore drills cover Xano data and required R2 metadata; data retention/privacy procedures are documented.
- [ ] Every release records frontend SHA, Xano contract/migrations, Worker SHA, environment checklist, smoke results, and rollback commands.
- [ ] Availability/error/latency targets and business reconciliation checks have operated without critical incident for an agreed soak period.

## Immediate Next Task

Create a follow-up security task to remove the remaining hardcoded email/role/credit branches in AI and admin endpoints, add register/login throttling, and verify OAuth `state`/PKCE and redirect allowlisting in staging. Do not combine that work with the separate wallet-policy migration.
