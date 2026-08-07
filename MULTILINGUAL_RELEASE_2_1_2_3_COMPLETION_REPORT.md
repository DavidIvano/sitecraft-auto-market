# Multilingual Release 2.1–2.3 Completion Report

## Overall status

**Release 2.1 published; blocked at controlled-listing creation.** Chrome successfully exposed the existing authenticated production dashboard, the account has the admin navigation, and the Console contains no critical authentication error. The three scoped Release 2.1 endpoints were published and fetched back successfully. The workflow then stopped at step 5 because the ChatGPT Chrome extension is not permitted to supply the generated safe photo to the page's native file chooser. No controlled listing was created, so backfill apply and locale-aware read remain forbidden.

## Production publication

Prepared endpoints:

| Endpoint ID | Route | Conversion / compile | Publication |
| --- | --- | --- | --- |
| 3982675 | POST `/listings/submit-moderation` | Fresh HTTP 200, `ok` | Published 2026-08-02 12:46:06 UTC; live fetch `ok` |
| 3969714 | PATCH `/dashboard/listings/{id}` | Fresh HTTP 200, `ok` | Published 2026-08-02 12:46:10 UTC; live fetch `ok` |
| 4003322 | GET `/admin/listings/{id}/translations` | Fresh HTTP 200, `ok` | Published 2026-08-02 12:46:13 UTC; live fetch `ok` |

Preflight confirmed the original verbs, route names, `automarket_users` auth, input counts, and response contracts. The prepared admin script checks `$auth.id` and server role before data reads and contains no email, phone, OAuth, password, token, or seller-contact projection.

Fresh backup:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/multilingual-stage-10-release-2-1-production-20260802-133230/`

Rollback files:

`endpoints/{3982675,3969714,4003322}.rollback.xs`

Compile results:

`compile/{3982675,3969714,4003322}.fromXS.json`

Fresh source hashes used for publication:

- `3982675`: `d43cd391dd2b2af9b016ffff6c6beb5892942988491a4c72b1c9de9bb9fed9be`;
- `3969714`: `7e08e81095ac4136d67bc8dba9180094ddb508d9c21a6c3d47671c5066edd7e9`;
- `4003322`: `ac587d5cc0ae591cd31614afe856511829234a3462ed8d94f6dede99bcc0a4f9`.

All three live fetches report XanoScript status `ok`. Endpoint `4003322` round-trips to the same compiled representation. For `3982675` and `3969714`, Xano normalized redundant one-condition boolean grouping on publication; a bounded compiled diff found only that canonical grouping change.

## Live schema gate

Confirmed in production metadata:

- `car_listings`: `source_locale`, `translation_source_hash`, `translation_version`, `translations_ready`, `translation_updated_at`.
- `car_drafts`: `source_locale`, `translation_source_hash`, `translation_version`.
- `automarket_users`: `preferred_locale`.
- `car_listing_translations`: UNIQUE `(car_listing_id, locale_code)`.
- `translation_jobs`: UNIQUE `idempotency_key`.

## Controlled E2E

| Field | Result |
| --- | --- |
| Controlled listing ID | Not created |
| Source locale | Not available |
| Initial hash | Not available |
| Hash after price edit | Not available |
| Hash after description edit | Not available |
| Version history | Not available |
| Original translation count | Not available |
| Jobs / duplicates | Not available |
| Moderation result | Not run |

The intended safe photo is a generated, unbranded synthetic hatchback with no people, plate, VIN, text, watermark, or personal data. It was not transmitted because the native chooser could not be controlled. No user listing was changed and no test listing was fabricated through metadata access.

## Endpoint 4003322

| Actor | Result |
| --- | --- |
| No token | HTTP 401, `ERROR_CODE_UNAUTHORIZED` |
| Ordinary user | Blocked: no controlled ordinary-user session |
| Admin | Blocked: session is confirmed admin, but no controlled listing exists and the current browser-control surface cannot issue the authenticated diagnostic GET without exposing or extracting the token |

The no-token response contained only `code` and `message`. Static preflight confirms the prepared response is limited to listing translation metadata, translation rows, and jobs, with no seller contact or authentication fields. Static inspection is not presented as the missing 403/200 production E2E.

## Pilot backfill

The required repeat dry-run used IDs `20,48,57,91,94,95,96,97` and matched the previous plan exactly:

- selected: 8;
- planned updated: 5;
- needs review: 3;
- failed: 0;
- ID 48: `ru`, unknown fuel/transmission preserved as warnings;
- ID 94: `de`, confidence 0.95;
- IDs 96/97: locale unresolved, confidence 0.5, no original row or jobs planned.

Dry-run artifact:

`pilot-backfill-dry-run.json` in the fresh backup folder.

First apply row counts, repeat-apply row counts, and duplicate counts are unavailable because apply is forbidden until the authenticated E2E passes. No Xano row was changed and no AI provider was called.

## Locale-aware read

Not enabled. Consequently there are no test listing IDs, German resolved DTOs, query-count measurements, response-time measurements, or cache-isolation results to claim.

Current flags remain safe:

- public locale routes disabled;
- German public locale disabled;
- English/Ukrainian/Chinese public locales disabled;
- AI translation disabled;
- admin/test locale-aware read not enabled.

## Tests

| Check | Result |
| --- | --- |
| `npm install` | Passed, 0 vulnerabilities |
| `npm run check` | Passed, 0 errors; one informational hint |
| `npm test` | Passed, 370/370 |
| `npm run build` | Passed; Cloudflare Advanced Mode worker compiled |
| `npm run verify:assets` | Passed; 32 references across 33 HTML files |
| Xano conversion / compile | 3/3 HTTP 200 |
| Production E2E | Blocked |
| Repeat backfill apply | Not run |

## Current rollout state

- Production remains on Release 2 deployment `04864d5f-667e-4331-81c0-2242082cc275`.
- Release 2.1 dual-write endpoint changes are enabled in production.
- Admin/test locale-aware read is disabled.
- Public locale routes are disabled.
- AI translation is disabled.
- `/`, `/cars/`, `/admin/moderation/`: HTTP 200.
- `/de/`, `/en/`, `/uk/`, `/zh-Hans/`: HTTP 404.
- No Cloudflare deployment was required or performed.

## Exact blocker

The authenticated Chrome session is now usable. The remaining immediate blocker is file upload: Chrome did not emit a controllable file chooser when the exact listing photo input was activated, so the required safe image cannot be attached and the required form cannot advance. Per the Chrome integration guidance, file upload requires enabling **Allow access to file URLs** for the ChatGPT browser extension under `chrome://extensions` → ChatGPT browser extension → Details. Until that browser permission is enabled, the controlled listing must not be created by a metadata bypass and the E2E/backfill gates cannot continue.

### Resume attempt: 2026-08-02 13:48 CEST

The connected Chrome session timed out while reading the current open-tab list and reset before any tab could be claimed or inspected. Therefore the production dashboard URL, signed-in state, admin role, and console state could not be confirmed. The attempt stopped at workflow step 1 before Xano publication. No endpoint, table row, feature flag, Cloudflare deployment, or user data was changed.

### Resume attempt: 2026-08-02 14:02 CEST

Chrome successfully reported one open tab titled `Личный кабинет | SiteCraft Auto Market` at `https://automarket.sitecraft.agency/dashboard/`. Two attempts to claim that exact tab timed out before page state could be read. The production URL is therefore confirmed, but the signed-in state, server role, and console state remain unverified. The workflow again stopped at step 1 with no production mutation.

### Resume attempt: 2026-08-02 14:46 CEST

Chrome claimed the production dashboard successfully. The page displayed the signed-in state, logout control, and admin-only moderation navigation; filtered Console logs contained no critical auth error. The backup, rollback scripts, table schemas, and indexes were rechecked. Fresh XanoScript conversion returned HTTP 200 for all three prepared files, and no endpoint had changed since the backup. Endpoints `3982675`, `3969714`, and `4003322` were then published and fetched live with XanoScript status `ok`. The no-token check for `4003322` returned HTTP 401 with only `code` and `message`.

The generated safe test image was prepared, but Chrome could not expose its file chooser to automation because the extension lacks file-URL access. The attempt stopped before submitting the new-listing form. No controlled listing, translation row, job, migration log, feature flag, or Cloudflare deployment was created or changed after endpoint publication.

## Next release recommendation

Resume Release 2.1 after file upload is enabled for the ChatGPT Chrome extension. Then, in order:

1. create exactly one controlled listing and run all unchanged/non-text/text/moderation scenarios;
2. verify endpoint `4003322` as admin and, if a controlled ordinary-user session exists, as ordinary user;
3. repeat the dry-run, apply the selected pilot once, and repeat it for idempotency;
4. enable and test admin/test-only German reads without fallback or N+1;
5. rerun the complete automated checks and smoke matrix;
6. close all gates before scheduling the separate Release 3 task.
