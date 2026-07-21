# SiteCraft Auto Market Integration Audit

Audit date: 2026-07-12  
INT-004 remediation date: 2026-07-13  
Frontend target: local Astro at `http://127.0.0.1:4322`  
Backend target: `https://x8ki-letl-twmt.n7.xano.io/api:jAAj839u`  
Production UI: `https://sitecraft-auto-market.pages.dev`  

The original audit was read-only except for this report, audit screenshots, three public AI search log entries, and one analytics view used to verify deduplication. On 2026-07-12 a narrowly scoped Critical remediation changed six Xano endpoints and the public-listing frontend/build guards described below. On 2026-07-13 the scoped INT-004 remediation added the two seller draft-persistence endpoints. No R2 object, payment code, other High/Medium/Low finding, or frontend production/preview deployment was changed.

## Executive summary

The application builds cleanly and the three Critical authorization/publication defects found by this audit are fixed. Admin reads and mutations now require `automarket_users` auth and a database-backed admin check, while public list/detail routes and static generation share a strict public-state rule. INT-004 is also fixed: the seller AI flow now has protected, ownership-scoped draft persistence and explicit moderation submission. Four previously identified High findings remain open.

## Detail data and AI-score follow-up (2026-07-14)

- **Confirmed root cause:** the Pages production deployment is built from commit `e6b6f0d`, while the expanded Astro detail template was present only in local uncommitted work. The production HTML therefore lacked the new structured detail sections even though the local build contained them. Xano data changes alone cannot update a statically generated Astro detail page.
- **Routing correction:** the first Preview check exposed a second delivery problem: `_routes.json` sent `/cars/*` to a legacy Pages Function and `_redirects` rewrote `/cars/:slug` to `cars/detail`. That obsolete client-rendered template bypassed the generated Astro detail HTML. The function route and rewrites are now removed from the public static path; Pages serves the generated `/cars/[slug]/index.html` directly.
- **Public response fixture:** `GET /cars/mercedes-benz-a-class-2008-56` returns the core vehicle values and seven images, but its legacy row has `null`/empty values for engine volume, drivetrain, seats, first registration, condition, seller type, TÜV/HU, and all three AI scores. The UI must label important missing fields as not supplied by the seller; it must not infer them.
- **Score contract:** nullable `listing_quality_score`, `photo_quality_score`, and `trust_score` were added to `car_drafts` (`863714`) and `car_listings` (`861468`). The draft and moderation-submit endpoints persist/copy those values without defaulting to zero. The public detail endpoint (`3966699`) now returns the three scores, `ai_analysis`, and seller-card photo score. Shared frontend parsing ignores null/empty values, so `AI 0%` is never fabricated.
- **Build traceability:** static HTML now receives non-secret build SHA, timestamp, and environment metadata. Preview verification is required before any production deployment; no production deployment is authorized by this follow-up.

## Critical remediation plan

1. Protect the live Xano moderation read and admin mutation endpoints with `automarket_users` auth plus a database-backed admin role/email check.
2. Enforce one strict public-listing predicate inside live `GET /cars` and `GET /cars/{slug}`.
3. Reuse the same predicate in Astro data access, catalog refreshes, homepage lists, related cars, `getStaticPaths`, sitemap, and structured data.
4. Rebuild from a clean `dist`, inspect generated HTML/XML/bundles for real private records and seller moderation data, then run guest/admin boundary checks.
5. Update only INT-001, INT-002, and INT-003 with verified remediation results; leave High/Medium/Low findings unchanged.

| Severity | Found | Fixed in this stage | Open |
| --- | ---: | ---: | ---: |
| Critical | 3 | 3 | 0 |
| High | 5 | 1 | 4 |
| Medium | 8 | 0 | 8 |
| Low | 5 | 0 | 5 |

## Environment

- Local `.env` points to the expected Xano API and production Pages site.
- `.env.example` keeps Xano and site URLs as placeholders, uses relative `PUBLIC_IMAGE_UPLOAD_URL`, enables new AI endpoints, and disables legacy AI.
- The local `.env` does not explicitly declare the two AI flags. Current code defaults safely to new AI enabled and legacy disabled, but configuration is implicit.
- OpenAI, Xano metadata, and R2 access secrets are not prefixed with `PUBLIC_`.
- The production bundle contains no Xano metadata token, OpenAI key variable, R2 secret variable, localhost URL, or hardcoded `blob:`/`data:image` configuration.
- The legacy `/ai/generate-listing` string is present in the bundle as a dormant route/fallback branch; the compiled behavior keeps it disabled unless explicitly enabled.

## Frontend API map

| Frontend path | Method / auth | Content type and request | Expected response / fallback | Live audit result |
| --- | --- | --- | --- | --- |
| `/auth/me` | GET / Bearer | none | `{user}`; clear auth and redirect on 401 | Protected, guest gets 401 |
| `/auth/register` | POST / public | JSON credentials/profile | auth token and user | Route present; destructive account creation not run |
| `/auth/login` | POST / public | JSON email/password | auth token and user | Route present; no credentials used |
| `/oauth/google/init`, `/oauth/google/continue` | GET / public | query parameters | redirect/auth continuation | Routes present; OAuth not completed in audit |
| `/cars` | GET / public | none | array of public cars | Returns 9 approved rows; no private status or conflicting moderation status is present |
| `/cars/{slug}` | GET / public | none | public car or 404 | Public slug returns 200; tested pending-review and deleted slugs return the same generic 404 |
| `/cars` | POST / Bearer | FormData listing plus R2 URL JSON strings | created car with `id` | Protected; authenticated create not run |
| `/cars/{id}/submit` | PATCH / Bearer | no body | submitted listing | Protected; authenticated submit not run |
| `/dashboard/listings` | GET / Bearer | none | current user's listings with owner-visible `thumbnail_url` | Endpoint 3968100; owner scope, pending thumbnail, active-image priority, and deleted-image exclusion verified live |
| `/dashboard/listings/{id}` | PATCH / Bearer | FormData | updated owned listing | Protected; owner mutation not run |
| `/dashboard/listings/{id}/delete` | PATCH / Bearer | no body | idempotent soft delete of an owned listing | Endpoint 3983598; guest 401, foreign/missing 404, blocked 403, retry 200; seller UI has no admin fallback |
| `/dashboard/drafts/{id}` | GET/PATCH / Bearer | JSON/FormData depending Cloudflare wrapper | draft | Not exercised without a test user |
| `/dashboard/drafts/{id}/publish` | POST / Bearer | draft context | published/submitted result | Not exercised without a test user |
| `/listings/create-draft` | POST / Bearer | FormData; `r2_images`, `image_urls`, `image_keys`, `ai_analysis`, and accepted suggestions are JSON strings | explicit `draft_id`, nullable `listing_id`, status and images | Endpoint 3982637; guest 401; authenticated create/update and ownership/JSON validation passed |
| `/listings/submit-moderation` | POST / Bearer | JSON `{draft_id, listing_id}` | explicit IDs, pending statuses, idempotency flag | Endpoint 3982675; guest 401; valid/incomplete/ownership/retry/public-visibility tests passed |
| `/ai/listing/analyze-photos` | POST / Bearer | FormData; `r2_images` is a JSON string, mode/status are text | normalized fields, confidence, missing fields, suggestions | Protected; authenticated image test not run |
| `/ai/listing/generate-description` | POST / Bearer | JSON `{fields, analysis, r2_images: array, mode}` | description, warnings, recommendations; local description on 404 | Protected; contract matches saved Xano metadata |
| `/ai/listing/quality-score` | POST / Bearer | JSON `{fields, analysis, photo_count, images}` | accepts `score`/`listing_quality_score`, `photo_score`/`photo_quality_score`, `trust_score`; local scorer on 404 | Protected; aliases are handled safely |
| `/ai/search/intent` | POST / public | JSON `{query,current_filters,user_context}` | filters, suggestions, explanation; local parser only on failure | All 3 required examples returned correct live filters without fallback |
| `/ai/moderation/check-listing` | POST / admin Bearer | JSON `{listing_id, listing, images}`; backend must trust `listing_id` and reload data | risk, trust, issues, recommendation, reason; local fallback on 404/network | Guest gets 401; admin result not run without admin credentials |
| `/analytics/listing-view` | POST / public | JSON `{car_id,slug,session_id,source,search_params,viewed_at}` | `{success,deduped}`; errors are silent | First call recorded; second returned `deduped=true` |
| `/saved-searches` | POST / Bearer | JSON; `filters_json` is an object | `{success,saved,updated}` | Guest gets 401; UI displays sign-in invitation |
| `/admin/moderation` | GET / admin Bearer | query `status=all` | minimized moderation rows | Endpoint ID 3966702 uses auth 861779; guest gets 401; published script performs database-backed admin/allowlist authorization and removes seller contacts/name and VIN |
| `/admin/cars/{id}/approve`, `/reject`, `/assign-owner` | PATCH / admin Bearer | no body or verified integer owner ID | changed listing | Endpoint IDs 3966703, 3966704, and 3968561 use auth 861779; guest gets 401; published scripts contain the same database-backed admin check and no `$auth.role` |
| `/admin/cars/{id}/delete`, `/sold`, `/block` | PATCH / admin Bearer | no body | changed listing | Guest gets 401 |
| `/admin/cars/{id}/archive`, `/restore` | PATCH / admin Bearer | no body | changed listing | Not present as matching live routes; frontend maps restore to approve |
| `/admin/cars/{carId}/images/{imageId}/delete`, `/main` | PATCH / admin Bearer | no body | changed image set | Route names do not match `apiRoutes.ts` (`primary`) and are absent from verified live inventory |
| `/admin/cars/{carId}/images` | POST / admin Bearer | JSON `{r2_images: array}` | added image rows | Absent from verified live inventory |
| `/api/upload-listing-images` | POST / Bearer validated via Xano | FormData of 1-8 compressed WebP files and metadata | `{success,images[]}` with public HTTPS URLs and R2 keys | Production smoke: validated upload, public URL, and AI-draft hand-off succeed |

## Auth

- Guest access to `/`, `/cars/`, public AI search, and listing detail works.
- Guest navigation to `/dashboard/new/`, `/dashboard/listings/`, and `/admin/moderation/` redirects to `/login?next=...`.
- Guest header shows registration/login, not logout. The code toggles login/logout after `/auth/me`.
- Bearer headers are attached to seller, saved-search, moderation AI, R2 upload, and protected listing calls.
- Tokens are stored in `localStorage` and a JavaScript-readable cookie. This is operationally convenient but increases XSS impact.
- Frontend admin checks remain only a UI boundary. Live Xano is now authoritative for moderation reads and all verified admin mutations.

## R2 upload

- Browser compression produces WebP, caps each optimized file at 1 MB, and limits a batch to 8 images.
- Upload response URLs must be HTTP(S); blob/data/file URLs are rejected before Xano payload construction.
- R2 response metadata includes key, URL, MIME type, size, dimensions, order, and primary flag.
- Production upload without a token returns 401.
- The function deliberately allows only production and local port 4321. Current local port 4322 receives `Access-Control-Allow-Origin: https://sitecraft-auto-market.pages.dev`, so browser upload is blocked.
- If neither `XANO_API_URL` nor `PUBLIC_XANO_API_URL` is configured in the function environment, any non-empty bearer token is accepted. This is fail-open authorization.

## Seller AI

The frontend sequence is correct up to persistence:

1. Select 1-8 images.
2. Compress to WebP.
3. Upload to R2 and obtain public URLs.
4. Send `r2_images` as a JSON string in FormData to photo analysis.
5. Normalize AI fields for selects, show confidence/missing fields, and let the user accept suggestions.
6. Generate description in six modes using JSON and an R2 image array.
7. Calculate quality with safe score aliases.
8. Persist accepted suggestions and AI analysis in the confirmed draft payload.
9. Save the draft only after explicit confirmation.
10. Submit moderation only after a separate explicit action.

The AI never auto-publishes and does not auto-submit moderation. The legacy endpoint is disabled. Confirmed data is saved only by `POST /listings/create-draft`; only a separate user action calls `POST /listings/submit-moderation`.

## Draft creation

- `POST /listings/create-draft` expects FormData and accepts `draft_id`/`listing_id` for continuation.
- The frontend accepts `draft_id`, `draft.id`, `listing_id`, `car_id`, `car.id`, or `id` in the response.
- `POST /listings/submit-moderation` sends JSON with both IDs, allowing either to be nullable.
- Create-draft writes only `car_drafts`/`car_draft_images`, returns top-level `draft_id`, and leaves `listing_id=null` for a new draft.
- Submit validates backend data, creates or updates at most one owned `car_listings` row per `draft_id`, copies only missing image URL rows, and sets both listing statuses to `pending_review`.
- The existing `/dashboard/drafts/{id}/publish` route was not reused: its current script is not idempotent and targets an obsolete listing-image field. It was not changed in this stage.

## Moderation

- The AI check is separate from approve/reject/block/delete and merely highlights a recommended action.
- A 404 or network failure invokes the deterministic local moderation fallback.
- The page displays risk, trust score, issues, recommendation, and suggested reason when supplied.
- The frontend sends listing context but the implemented backend contract must reload the listing by `listing_id`; this could not be proven with an admin request in this audit.
- `admin/moderation.astro` still uses `car.status` for filtering and badges and does not model `moderation_status`; this separate High finding was intentionally not changed in the Critical-only remediation.
- Delete requires confirmation. Reject, block, sold, and archive are separate clicks but do not all have equivalent confirmation or a reason-submit step.

## Buyer AI

Live tests passed:

- `BMW автомат до 10000 €` -> BMW, automatic, maximum EUR 10,000.
- `дизельный универсал до 7000 € рядом с Braunschweig` -> diesel, estate, maximum EUR 7,000, Braunschweig.
- `семейный минивэн на бензине до 9000 €` -> petrol, minivan, maximum EUR 9,000.

The successful Xano response is used directly and does not invoke the local parser. Query parameters and form controls are synchronized after applying filters. Empty filters do not break rendering. The live response returned `model: null`, which is harmless to the current UI but weakens observability.

## Saved searches

- `filters_json` is sent as a JSON object, matching the Xano input type.
- A guest receives 401 from Xano and the UI shows: sign in to save the search.
- The endpoint supports `updated=true`; the frontend treats created and updated as successful saves.
- Authenticated create/update was not run because no test-user credentials were supplied.

## Listing analytics

- A per-browser session ID is generated and sent without auth.
- Duplicate calls are accepted: the first test returned `deduped=false`, the second `deduped=true`.
- Endpoint errors are intentionally silent in the listing UI.

## Public catalog

- Live `/cars` now returns 9 records, all with `status=approved` and `moderation_status=null`.
- The Xano list and detail endpoints apply the same null-safe public-state predicate. Two known pending-review slugs and one deleted slug return the same generic 404; a known public slug returns 200.
- `isPublicListing()` is reused by `src/lib/xano.ts`, catalog and homepage refreshes, related cars, `getStaticPaths`, Astro/Cloudflare sitemap generation, and the Cloudflare detail function.
- The clean static build emits 9 listing-detail URLs and 9 listing sitemap URLs. No known pending/deleted slug, seller field name, allowlist email, or seller contact action was found in the scanned admin/public artifacts.

## Security

### INT-001 - Critical - Public moderation data and seller PII

- **Status:** Fixed (2026-07-12).

- **Page/file:** Xano `GET /admin/moderation`; `src/pages/admin/moderation.astro`.
- **Expected:** admin Bearer token and server-side admin authorization.
- **Actual:** request without auth returns HTTP 200, 19 rows, and seller contact/name fields.
- **Reproduction:** `GET /admin/moderation?status=all` without Authorization.
- **Recommended fix:** set auth to `automarket_users`, reload the user from the database, enforce admin role/allowlist server-side, and minimize response fields.
- **Fix:** Xano endpoint 3966702 now requires auth 861779 (`automarket_users`), reloads the user via `$auth.id`, allows database role `admin` or the two approved emails, and removes seller email/phone/name and VIN from the response. The Astro route remains an empty shell and calls `/auth/me` before loading moderation data.
- **Verification:** guest request returns 401; published XanoScript status is `ok`; `dist/admin/moderation/index.html` contains no seller fields, pending listing object, or moderation payload. Ordinary-user 403 and admin 200 require disposable authenticated tokens and were not executed in this pass.
- **Publish:** backend fix is live; no frontend production/preview deploy was performed.

### INT-002 - Critical - Public admin mutations

- **Status:** Fixed (2026-07-12).

- **Page/file:** Xano approve/reject/assign-owner endpoints.
- **Expected:** only authenticated admins can reach validation or listing lookup.
- **Actual:** unauthenticated requests to nonexistent IDs return 404/400 rather than 401; verified metadata marks these routes `auth=false`.
- **Reproduction:** PATCH an unused ID without Authorization.
- **Recommended fix:** enable `automarket_users` auth and repeat the same database-backed admin check used by AI moderation. Never trust payload role/user IDs.
- **Fix:** approve 3966703, reject 3966704, and assign-owner 3968561 now require auth 861779 and independently perform the database-backed admin/allowlist check. Assignment accepts only a verified integer owner ID and verifies that owner. Existing delete 3975051 and sold 3975107 protections were rechecked. No endpoint uses `$auth.role`.
- **Verification:** all five mutation endpoints return 401 without auth; all published scripts compile with XanoScript status `ok`. Ordinary-user 403, admin success, and authenticated nonexistent-listing 404 were not executed because no disposable normal/admin tokens were available; no production listing was mutated.
- **Publish:** backend fixes are live; no frontend production/preview deploy was performed.

### INT-003 - Critical - Pending-review listings are public

- **Status:** Fixed (2026-07-12).

- **Page/file:** Xano `GET /cars`, `GET /cars/{slug}`; `src/lib/xano.ts`; `src/pages/cars/index.astro`; static output.
- **Expected:** only approved/published (and explicitly supported sold) listings are public.
- **Actual:** two rows with `moderation_status=pending_review` are in `/cars`, direct slug responses, catalog UI, sitemap/static generation.
- **Reproduction:** fetch `/cars`, select rows with pending `moderation_status`, then fetch their slug; build also emits their HTML.
- **Recommended fix:** enforce a single public-state predicate in both Xano public endpoints, reject conflicting status pairs, and defensively apply `isPublicListing()` before SSR/client rendering and route generation.
- **Fix:** Xano endpoints 3966698 and 3966699 enforce the strict public predicate across `status` and `moderation_status`. A shared frontend helper provides defence in depth for every public list/detail/build surface, and static props omit seller contact fields.
- **Verification:** `/cars` returns 9 public rows and zero private/conflicting rows; one public slug returns 200; two pending slugs and one deleted slug return generic 404. The clean build emits 9 public detail pages/URLs, and scans found zero known private slugs or seller field names in admin/public HTML and sitemap.
- **Publish:** backend fix is live; rebuilt frontend remains local and was not deployed.

### INT-004 - High - New AI draft persistence endpoints are missing live

- **Status:** Fixed (2026-07-13).

- **Page/file:** `src/pages/dashboard/new.astro`; `src/lib/apiRoutes.ts`.
- **Expected:** protected create-draft and submit-moderation routes.
- **Actual:** both live paths return 404.
- **Reproduction:** POST each path at the configured API base; response is `Unable to locate request`.
- **Recommended fix:** publish/attach the prepared Xano endpoints to this exact API group and verify auth, FormData/JSON inputs, and response IDs.
- **Fix:** created protected endpoint 3982637 (`POST /listings/create-draft`) and endpoint 3982675 (`POST /listings/submit-moderation`) in API group `sitecraft-auto-market`, both using auth table 861779. User IDs come only from `$auth.id`; draft/listing ownership is checked server-side. Draft-only persistence, strict submit validation, image de-duplication, and draft-id idempotency are enforced.
- **Schema mapping:** existing `car_drafts` lacks seller/country/currency/VIN/score columns, so auxiliary values are stored in its existing `ai_payload`; core listing fields remain normal columns. Submit falls back to the authenticated user's name/email and project country/currency defaults, then writes the complete pending listing to `car_listings`.
- **Verification:** guest create/submit 401; create 200 with draft status `draft`, one image and no listing; update returns the same draft; cross-user update/submit 403; invalid image JSON 400; incomplete submit 400 with six field errors and no listing; valid submit 200 with both statuses `pending_review`; draft retry and listing-only retry return the same listing with `already_submitted=true`; database contains one listing and one image; public list excludes it and public detail returns 404; AI credit balance stays 10.
- **Cleanup:** two disposable users and every related draft, listing, image, and credit row were deleted after each test run. No test R2 object was created.
- **Frontend:** no frontend source change was required; the existing FormData/JSON contract matches both endpoints.
- **Publish:** Xano endpoints are live as required. No frontend preview or production deploy was performed in this stage.

### INT-005 - High - Moderation queue ignores `moderation_status`

- **Status (2026-07-13):** partially fixed; helper, admin page, fixtures, build, published Xano schema, and aggregate data contract are verified. Updated UI awaits deployment verification, which this stage forbids.
- **Page/file:** `src/lib/listingStatus.ts`; `src/lib/types.ts`; `src/pages/admin/moderation.astro`; `tests/listing-status.test.ts`; `docs/moderation-status-audit.md`.
- **Precedence:** a known non-empty `moderation_status` is authoritative for moderation. Null uses a safe lifecycle fallback. Terminal lifecycle and mismatched/unknown combinations are routed to manual conflict handling.
- **Fix:** filtering, counters, badges, card data attributes, empty states, and action availability now use the same helper model. Legacy `?status=pending_review` normalizes to `pending`. Conflicts show a separate translated badge and receive no normal moderation actions. Restore is hidden and is no longer translated to approve.
- **Published contract:** endpoint `3966702` remains protected by auth `861779`, its XanoScript status is `ok`, guest receives 401, PII/VIN are removed, and table `861468` contains both status fields. No Xano endpoint update was required.
- **Data verification:** 20 rows aggregate to 10 approved and 10 conflicts under the new model, versus the old published UI's 12 approved and 8 deleted. Pending remains 0. No IDs or PII were documented and no row was modified.
- **Tests:** all 10 required fixtures plus a shared filters/counters/labels/actions consistency fixture pass (11/11). `npm run check` and `npm run build` pass.
- **Browser limitation:** the authenticated published page reproduced the old counters, but the changed UI cannot be tested there before a separately authorized deployment. No admin action was executed.
- **Static privacy check:** the rebuilt admin shell embeds no moderation payload or protected listing title. No seller name, phone, or VIN from the table appears in `dist`; the only matching emails are pre-existing admin allowlist constants in the auth client, not moderation response data.

### INT-006 - High - R2 upload authorization and Xano response-shape mismatch

- **Status (2026-07-14):** fixed and production-verified.
- **Page/file:** `functions/api/upload-listing-images.ts`; `src/lib/authClient.ts`; `src/lib/listingImageUpload.ts`; `src/pages/dashboard/new.astro`; `src/pages/dashboard/listings/edit.astro`; `src/pages/admin/moderation.astro`; `tests/upload-listing-images.test.ts`; `tests/listing-image-upload-client.test.ts`; `docs/r2-upload-security.md`.
- **Root cause:** Xano `/auth/me` returns `{ "user": { "id": 123 } }`. The browser client already reads `payload.user || payload`, so its authenticated request succeeds. The deployed R2 Function only read root `response.id`, then returned `401 UNAUTHORIZED` before contacting R2 for the very same bearer token.
- **Implemented:** upload callers take their bearer token from shared `getAuthToken()` immediately before `fetch`. The Function validates only a positive integer from `response.id` or `response.user.id`, and otherwise returns 401. Missing Xano URL returns `503 AUTH_CONFIGURATION_MISSING`; Xano timeout, 5xx, or invalid JSON returns `503 AUTH_SERVICE_UNAVAILABLE`; invalid auth returns `401`. R2 is never called on these paths. FormData is sent without a manually supplied multipart `Content-Type`.
- **Preview verification:** an explicitly configured Pages preview accepted 1, 4, and 8 disposable test images through the Function, returned public HTTPS R2 URLs, and completed `POST /ai/listing/analyze-photos` with a created draft. Preview CORS returned 204 for its exact origin and 403 without an allow-origin header for a denied origin. Browser login and the protected draft route were also verified. The automated browser driver cannot select native local files, so the file-selection gesture itself was covered by source/contract tests and the same multipart request was exercised against the deployed Function.
- **Production smoke:** after production deployment `766d211f-4fd2-48f4-a94f-3fd41562985e`, a disposable authenticated user uploaded one test image. Upload returned 200, the returned public HTTPS URL returned 200, and AI analysis returned 200 with a draft ID. The production preflight returned 204 with the exact production origin and `Authorization, Content-Type`; a malicious origin received 403 without an allow-origin header. An arbitrary or absent bearer remains a 401 path.
- **Verification:** focused tests cover root and nested Xano user IDs, missing token, invalid token, missing configuration, Xano 5xx/invalid payload, successful validated upload, CORS, and R2 cleanup after partial failure. `npm run test` passed 29 tests; `npm run check` and `npm run build` passed. The published bundle was scanned for Xano metadata, R2, and OpenAI secrets with no matches.
- **Privacy:** temporary diagnostics omit bearer values, profiles, image metadata, and raw Xano responses; they retain only header presence, token length, status, normalized response shape, numeric user ID, and internal code.

### INT-007 - High - Admin image management routes do not match live backend

- **Page/file:** `src/pages/admin/moderation.astro:883-955`; `src/lib/apiRoutes.ts:44-47`.
- **Expected:** consistent delete/primary/add endpoints.
- **Actual:** page calls `/main`, route map declares `/primary`, and verified live inventory has neither image action nor add-images route.
- **Reproduction:** compare page fetch paths, route map, and live API inventory.
- **Recommended fix:** choose one contract, implement/protect it in Xano, then reference only `API_ROUTES` from the page.
- **Publish:** no for moderation image editing. Production blocker.

### INT-008 - Resolved - Seller delete and dashboard thumbnail ownership

- **Status (2026-07-13):** fixed in live Xano and covered by focused frontend fixtures.
- **Page/file:** `src/pages/dashboard/listings.astro`; `src/lib/apiRoutes.ts`; `src/lib/dashboardListings.ts`; `tests/dashboard-listings.test.ts`; `docs/xano-endpoint-get-dashboard-listings.xs`; `docs/xano-endpoint-patch-dashboard-listings-delete.xs`.
- **GET contract:** endpoint 3968100 loads only `car_listings.user_id == $auth.id` and returns one `thumbnail_url` per owned listing. Active image priority is `is_main`, then `is_primary`, then lowest `sort_order`/`id`; rows with `is_deleted == true` are excluded. Pending listings and their thumbnails remain visible to the owner through this protected route, while public list/detail routes continue to exclude private statuses.
- **Delete contract:** endpoint 3983598 requires `automarket_users`, combines listing ID and owner ID in one lookup, returns the same 404 for missing and foreign IDs, rejects blocked listings with 403, and is idempotent for already-deleted rows. It updates only `car_listings.status` and `updated_at`; image rows, R2 objects, drafts, credits, and AI records are untouched.
- **Frontend:** dashboard cards use the protected thumbnail, an image-error placeholder, responsive facts, and status-aware actions. Delete calls only the seller endpoint; no admin fallback remains.
- **Live verification:** guest 401; owner delete 200; repeat delete 200 with `already_deleted=true`; cross-user 404; missing 404; blocked 403 with unchanged status; pending and approved owner thumbnails returned; public list/detail omitted the deleted fixture; its `car_listing_images` row and URL remained unchanged.
- **Mobile fixture verification:** at 390 x 844 the document and viewport are both 390 px wide, cards are 366 px wide, and media is 340 x 191 (16:9). A long title/city produced no horizontal overflow. The HTTPS fixture rendered with `object-fit: cover`; an unsafe localhost fixture was rejected and rendered the local placeholder with `contain`. The pending fixture exposed only the owner delete action and no public detail link.
- **Fixture cleanup:** disposable users/listings/images and the temporary test helper endpoint were removed after verification.
- **Publish:** Xano endpoints are live. Frontend changes remain local because this stage forbids Cloudflare deployment.

## Privacy

- The moderation endpoint is now admin-only and its response omits seller email, phone, name, and VIN.
- Static public listing props omit seller contact fields; the rebuilt detail pages contain no seller mail or telephone actions.
- Analytics stores a site session ID; no IP is intentionally sent by the frontend payload.
- Saved searches are correctly user-bound at the endpoint.

## Mobile

Audit captures:

- [Home desktop](./integration-audit-assets/home-desktop.png)
- [Cars desktop](./integration-audit-assets/cars-desktop.png)
- [Home mobile](./integration-audit-assets/home-mobile.png)
- [Cars mobile](./integration-audit-assets/cars-mobile.png)
- [Detail mobile](./integration-audit-assets/detail-mobile.png)
- [Login mobile](./integration-audit-assets/login-mobile.png)
- [Register mobile](./integration-audit-assets/register-mobile.png)

No horizontal document overflow was detected at 1440 or 375 px on home, catalog, detail, login, or register. Guest-only dashboard/admin checks redirected correctly. The following issues remain.

### INT-009 - Medium - Fixed mobile navigation obscures active content

- **Page/file:** shared layout/global CSS; login, register, catalog, detail screenshots.
- **Expected:** content and action controls remain readable above the fixed bar at every scroll position.
- **Actual:** the bar overlays form fields and catalog/filter content; at 375 px `Продать авто` is visually truncated.
- **Reproduction:** open login/register/cars at 375 px and scroll through a long form.
- **Recommended fix:** increase safe bottom scroll padding per page, shorten mobile labels or use icons, and verify focused fields scroll above the bar.
- **Publish:** yes for preview, but fix before broad mobile release.

### INT-010 - Medium - Local/preview R2 CORS allowlist

- **Status (2026-07-14):** fixed and preview/production-verified.
- **Page/file:** `functions/api/upload-listing-images.ts`; `wrangler.toml`; `.env.example`; `docs/r2-upload-security.md`.
- **Expected:** approved local/preview origins receive their own origin in CORS.
- **Implemented:** `ALLOWED_UPLOAD_ORIGINS` is parsed as an exact comma-separated allowlist, wildcard/suffix matching is not used, and development defaults include localhost and 127.0.0.1 on ports 4321/4322 only when `ENVIRONMENT` is local/development. Allowed preflight returns the exact origin and forbidden preflight returns `403 ORIGIN_NOT_ALLOWED` without an allow-origin header.
- **Verification:** the explicit preview alias and `https://sitecraft-auto-market.pages.dev` each receive `204`, their own `Access-Control-Allow-Origin`, `Vary: Origin`, and `Authorization, Content-Type`. `https://malicious.example` receives `403` without an allow-origin header in both environments. The preview and production authenticated upload tests passed after these preflight checks.
- **Publish:** production Function deployed in `766d211f-4fd2-48f4-a94f-3fd41562985e`.

### INT-011 - Medium - Archive/restore action contract is incomplete

- **Page/file:** `src/lib/apiRoutes.ts`; `src/pages/admin/moderation.astro`.
- **Expected:** each visible action maps to an implemented protected endpoint.
- **Actual:** archive/restore are listed as pending; restore is silently translated to approve.
- **Reproduction:** compare route map and `runAction()` mapping.
- **Recommended fix:** either hide unavailable actions or implement explicit archive/restore contracts and statuses.
- **Publish:** preview only with those actions disabled.

## Accessibility

Automated DOM checks on public/auth screens found no images without `alt`, unnamed links/buttons, or form controls without a label/ARIA name. Remaining issues require correction or deeper manual testing.

### INT-012 - Medium - Async status regions are not consistently announced

- **Page/file:** catalog live message, admin access/message, several AI status containers.
- **Expected:** important loading, success, fallback, rate-limit, and error changes use `aria-live`/`role=status` or `role=alert`.
- **Actual:** some new-listing regions use `aria-live`, while catalog/admin messages are plain paragraphs/divs.
- **Reproduction:** run search/load/moderation with a screen reader.
- **Recommended fix:** standardize polite status and assertive error components; keep visual text unchanged.
- **Publish:** yes for preview; accessibility blocker before compliance sign-off.

### INT-013 - Medium - Lightbox is not an accessible modal

- **Page/file:** `src/pages/cars/[slug].astro`; `src/pages/cars/detail.astro`.
- **Expected:** `role=dialog`, `aria-modal`, labelled image/context, focus move/trap, and focus restoration.
- **Actual:** keyboard Escape works, but dialog semantics and focus management are absent.
- **Reproduction:** open gallery with keyboard and tab away.
- **Recommended fix:** add modal semantics, focus first control, trap while open, restore opener focus, and mark background inert.
- **Publish:** yes for preview.

### INT-014 - Medium - Network requests have no timeout/abort policy

- **Page/file:** catalog, seller AI, admin moderation, auth calls.
- **Expected:** every long async state reaches success/error/fallback within a bounded time.
- **Actual:** fetches rely on browser/network termination; a stalled request can leave loading text indefinitely.
- **Reproduction:** throttle a request so it never completes.
- **Recommended fix:** shared `AbortController` timeout per flow and a retry/fallback terminal state.
- **Publish:** yes for preview.

### INT-015 - Medium - Destructive moderation confirmations are inconsistent

- **Page/file:** `src/pages/admin/moderation.astro`.
- **Expected:** reject/block/delete/sold/archive require clear confirmation and, where relevant, a reason.
- **Actual:** delete confirms; the other destructive state changes can execute from one button click.
- **Reproduction:** inspect/click moderation action buttons as admin.
- **Recommended fix:** accessible confirmation dialog with action, listing title, and optional required reason.
- **Publish:** preview only after backend authorization is fixed.

### INT-016 - Medium - Auth token is JavaScript-readable

- **Page/file:** `src/lib/authClient.ts`.
- **Expected:** strongest practical session storage, ideally Secure HttpOnly cookie issued server-side.
- **Actual:** token is persisted in localStorage and a client-set cookie.
- **Reproduction:** inspect browser storage after login.
- **Recommended fix:** plan a server-issued HttpOnly session cookie; meanwhile maintain strict CSP, output escaping, short expiry, and token rotation.
- **Publish:** not an immediate blocker if CSP/XSS controls are verified, but security debt is material.

## Build

- `npm run check`: passed, 72 files, 0 errors, 0 warnings, 0 hints.
- `npm run build`: passed, 34 pages generated, including 9 public listing-detail routes.
- Build output contains no known pending/deleted listing slug, seller field name, allowlist email in public car pages, seller contact action, or pending listing object in the admin shell.
- Sitemap contains 9 public listing URLs and no tested private slug.

## Critical remediation verification

| Issue ID | Before | Fix | Test | Result |
| --- | --- | --- | --- | --- |
| INT-001 | Public moderation response exposed rows and seller PII | Endpoint 3966702: auth 861779, database user lookup, role/email allowlist, minimized response; empty client shell | Guest live request; post-publish metadata; `dist` scan | **Fixed.** 401 guest; XanoScript `ok`; no embedded moderation records/seller fields. Authenticated 403/200 still needs disposable tokens. |
| INT-002 | Approve/reject/assign-owner were public | Endpoint IDs 3966703, 3966704, 3968561 protected; delete 3975051 and sold 3975107 rechecked | Guest live requests to unused ID; post-publish metadata and `$auth.role` scan | **Fixed.** All return 401 guest; auth 861779 and XanoScript `ok`; no `$auth.role`. Authenticated role/success/404 branches still need disposable tokens. |
| INT-003 | Conflicting pending rows appeared in list, detail, sitemap, and static pages | Endpoint IDs 3966698/3966699 use strict public predicate; shared frontend/build helper | Live list/detail tests; clean build; HTML/XML scan | **Fixed.** 9 public rows, zero private rows; public 200, pending/deleted 404; zero tested private slugs in `dist`. |

No temporary production listing was created because destructive admin verification could not be completed safely without disposable authenticated user/admin tokens. This preserves production data while leaving the unexecuted authenticated branches explicitly documented.

### INT-017 - Low - Backend work registry is stale

- **Page/file:** `src/lib/apiRoutes.ts:58-78`.
- **Expected:** implemented and missing routes are accurately tracked.
- **Actual:** implemented AI/search/analytics routes remain listed as requiring Xano work.
- **Reproduction:** compare list with live 200/401 behavior and saved endpoint metadata.
- **Recommended fix:** replace the manual list with dated capability documentation or generated contract checks.
- **Publish:** yes.

### INT-018 - Low - AI feature flags are implicit in local env

- **Page/file:** local `.env`, `.env.example`, `dashboard/new.astro`.
- **Expected:** deployment intent is explicit.
- **Actual:** current defaults are safe, but local `.env` omits both flags.
- **Reproduction:** inspect local env and compiled branch behavior.
- **Recommended fix:** explicitly set new=true and legacy=false in each non-secret environment.
- **Publish:** yes.

### INT-019 - Low - Dormant legacy route remains in client bundle

- **Page/file:** `apiRoutes.ts` and compiled new-listing bundle.
- **Expected:** disabled legacy behavior is clearly absent or unmistakably gated.
- **Actual:** route string and branch are bundled, though the flag prevents calls.
- **Reproduction:** search `dist` for `/ai/generate-listing`.
- **Recommended fix:** keep the safety flag false; remove the branch in a later cleanup after migration sign-off.
- **Publish:** yes.

### INT-020 - Low - Observability metadata is incomplete

- **Page/file:** live `/ai/search/intent` response.
- **Expected:** response identifies AI model/fallback for support diagnostics.
- **Actual:** successful live responses returned `model: null`.
- **Reproduction:** run any of the three buyer prompts.
- **Recommended fix:** return the active model or `local-rules` consistently; do not expose secrets.
- **Publish:** yes.

### INT-021 - Low - R2 configuration naming is ambiguous

- **Page/file:** `.env.example`, `wrangler.toml`, `src/lib/server/r2.ts`.
- **Expected:** binding and environment names have one documented source of truth.
- **Status (2026-07-13):** fixed in configuration and upload security documentation.
- **Actual:** runtime consumes only the `R2_BUCKET` binding. `R2_BUCKET_NAME` is documented as optional deployment tooling metadata and is not read by application code.
- **Reproduction:** compare configuration files.
- **Recommended fix:** document that `R2_BUCKET` is the binding and `R2_BUCKET_NAME` is only deployment tooling metadata, or remove the unused variable.
- **Publish:** yes after Cloudflare settings are verified.

## Production blockers

1. INT-005: moderation queue classifies by the wrong status field.
2. INT-006: fixed and verified; retain the focused tests and exact-origin CORS policy.
3. INT-007: moderation image routes are missing/inconsistent.
Resolved production blockers: INT-001, INT-002, INT-003, INT-004, and INT-008.

## Preview checklist

- [x] Protect admin reads/mutations and verify the guest boundary; authenticated user/admin token tests remain before release sign-off.
- [x] Remove pending-review rows from public list, slug, sitemap, and build output.
- [x] Attach/create and live-test the two seller AI persistence endpoints in the configured API group.
- [x] Make R2 auth fail closed and configure preview/local CORS allowlist.
- [x] Verify R2 upload with a disposable authenticated test user and 1, 4, and 8 images.
- [ ] Verify normal seller create/edit/delete/submit ownership boundaries.
- [ ] Verify moderation AI backend-truth behavior with an admin token.
- [ ] Disable unavailable admin image/archive actions until their routes pass.
- [ ] Re-run all viewport screenshots and keyboard tests.
- [ ] Re-run check/build and secret scan.

## Production checklist

- [ ] All preview items pass against a staging API/data set.
- [ ] No draft/pending/rejected/blocked/deleted/archived row is returned publicly.
- [ ] Admin endpoints return 401 without auth and 403 for non-admin users.
- [ ] Seller endpoints enforce record ownership server-side.
- [ ] Cloudflare R2 variables/binding exist and upload rejects arbitrary tokens.
- [ ] OpenAI and Xano secrets are absent from client output.
- [ ] OAuth/login/logout/session-expiry flows pass in production origin.
- [ ] Analytics dedupe and saved-search duplicate update pass with real users.
- [ ] Accessibility modal/status/focus checks pass.
- [ ] Production deploy receives explicit approval after final smoke test.

## Tests not completed

- Authenticated seller AI analyze/description/quality was not re-run in this stage; create/submit were fully exercised with disposable users and cleaned up.
- Actual R2 object upload: avoided creating storage objects without a disposable authenticated account; preflight and unauthenticated behavior were tested.
- Authenticated saved-search create/update: no test user token.
- Admin moderation and destructive actions: guest 401 boundaries passed, but no normal/admin token was available for live 403/200/success/404 branches; no real listing was mutated.
- Google OAuth: no external login session was completed.
- Expired-session, no-credit, and 429 states: no controlled test token/rate-limit fixture.
- Full screen-reader, contrast, and keyboard focus-trap audit: only DOM heuristics, source review, and visual inspection were completed.
- Dashboard/new/listings/admin authenticated layouts at every viewport: guest redirects were verified, but protected content requires test credentials.

## Listing contract, TÜV/HU, and seller listings (2026-07-14)

- Manual and AI creation now share the canonical listing contract documented in `docs/listing-fields-audit.md`.
- Xano schema was extended non-destructively: `car_drafts` (`863714`) received missing canonical, seller-contact, VIN, and TÜV/HU columns; `car_listings` (`861468`) received `vehicle_condition`, `has_valid_tuv`, and `tuv_valid_until`.
- `POST /listings/create-draft` (`3982637`) and `POST /listings/submit-moderation` (`3982675`) preserve the canonical draft-to-listing mapping. Drafts may be incomplete; submit enforces explicit TÜV/HU and the required listing fields.
- `GET /cars/{slug}` (`3966699`) returns the safe complete detail contract, `vin_masked`, a minimized seller summary, and up to six privacy-minimized `seller_listings`.
- `GET /cars/{slug}/seller-listings` (`3985671`) independently exposes the same safe seller-card projection. Seller matching is backend-only by `user_id`; no public response includes that identifier.
- Astro embeds seller cards during static generation and removes them from similar results. Detail requests are intentionally paced to remain below Xano build-time rate limits.
- Dist scan passed: no full VIN, `user_id`, seller contacts, private status tokens, `undefined`, `null`, or `NaN` in generated detail HTML.
- Responsive detail checks passed at 1440, 1024, 768, 430, and 375 px with no horizontal overflow.
- Final generated-form scan found all 30 canonical/TÜV/photo fields, two explicit TÜV choices, the `YYYY-MM` month control, the 1–8 photo copy, and `data-use-ai-listing-endpoints="true"`.
- Final generated-site scan covered 11 detail pages and 11 sitemap car routes. The seller fixture contains six unique public cards, excludes the current listing, appears before similar cars, and has no overlap with the similar set.
- Final verification: `npm run test` passed 49/49, `npm run check` reported 0 errors/warnings/hints, and `npm run build` generated 36 pages successfully.
- Cloudflare preview and production deployment were not performed.

## Detail data and AI-score follow-up (2026-07-14)

- **Root cause of the stale production detail page:** production was serving the older static Pages build from commit `e6b6f0d`. The new sections existed only in the local working tree. Because this Astro project pre-renders car details, changing Xano data or the local source does not update already-deployed HTML; a new build and deployment is required.
- **Routing correction:** the Pages Function route previously captured `/cars/*` and the legacy redirect rewrote detail URLs to `/cars/detail/`. The generated static `/cars/{slug}/index.html` pages were therefore bypassed. `_routes.json` now reserves Functions for `/api/*`, `/dashboard/drafts/*`, and the sitemap; the obsolete public redirect was removed.
- **Build observability:** public, non-secret HTML metadata now records the build SHA, timestamp, and environment. The verified Preview detail page reports `sitecraft-build-sha=e6b6f0d-local` and `sitecraft-build-environment=preview`.
- **AI score contract:** `listing_quality_score`, `photo_quality_score`, and `trust_score` are nullable integers on `car_drafts` (`863714`) and `car_listings` (`861468`). `null`, missing, empty, and malformed values stay absent through draft creation, moderation submission, Xano detail responses, and cards. Only a stored score in the inclusive `0..100` range can render a badge; no UI converts an absent score to `AI 0%`.
- **Public detail contract:** `GET /cars/{slug}` (`3966699`) provides truthful structured fields, masked VIN, public images, AI values when actually saved, and privacy-minimized seller cards. Missing values are shown as `Не указано продавцом`, never guessed or represented as a zero/false fact.
- **Static privacy:** build-safe detail props remove seller contacts, full VIN, identity fields, and the seller name. The seller section uses the neutral label `Продавец автомобиля` in static HTML; contact actions remain runtime-only.
- **Preview verification:** deployed to `https://detail-data-scores-preview.sitecraft-auto-market.pages.dev/cars/mercedes-benz-a-class-2008-56`. Desktop and 430 px browser checks found all six expanded sections, no `AI 0%`, no seller-name leak in static HTML, and no horizontal overflow.
- **Release boundary:** Preview only. No Cloudflare production deployment, production data mutation, automatic publication, PayPal, pricing, or billing change was performed.

## Submit moderation stale-draft fix (2026-07-15)

- **Root cause:** the browser validated current AI-review controls but skipped `POST /listings/create-draft` when a draft ID already existed. Xano correctly validated the older database snapshot and returned HTTP 400.
- **Frontend contract:** every moderation submit now validates and saves the current canonical form first, then submits only the latest explicit server IDs. Ambiguous root `id` values are ignored.
- **Seller contact:** only the current visible form values are persisted. Cached auth email/name is no longer silently reinserted after the seller clears a field.
- **Errors:** Xano endpoint `3982675` returns `LISTING_NOT_READY` with structured field errors. The browser maps them to controls, keeps input, and focuses the first invalid field.
- **TÜV/HU:** the `YYYY-MM` regular expression was corrected in endpoints `3982637` and `3982675`; explicit `false` remains a valid saved choice and clears the date.
- **Live Xano test:** incomplete submit returned structured HTTP 400; updating the same draft and submitting returned `pending_review`; repeated submit returned the same listing with `already_submitted=true`.
- **Cleanup:** seven disposable test records were removed. No R2 object and no real listing were changed.
- **Verification:** focused tests and project checks are recorded in `docs/submit-moderation-debug.md`.
- **Release boundary:** Xano endpoint scripts were updated. No Cloudflare Preview or frontend production deployment was performed.
