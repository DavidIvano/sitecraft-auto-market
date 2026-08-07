# Multilingual Content Migration — Stage 10

Date: 2026-08-02
Current rollout: **Release 2 — dual write, translation jobs and admin-only inspection**. Public multilingual reads remain intentionally disabled.

## Исходное состояние

The detailed inventory is in `I18N_DATA_AUDIT_STAGE_10.md`. Production currently stores Russian taxonomy labels and the frontend is Russian-first. Before Release 1 there were no locale registry, listing translation, translation job or content migration log tables.

## Новая модель

Implemented locally:

- runtime BCP 47 locale registry in `src/i18n/`;
- deterministic explicit fallback chains;
- UI dictionaries for `de`, `en`, `ru`, `uk`, `zh-Hans`;
- locale-aware number, currency, date, mileage, owner, door, seat and seller formatters;
- canonical vehicle taxonomy codes in `src/domain/vehicleTaxonomy.ts`;
- non-guessing legacy mapping in `src/migrations/legacyVehicleValueMap.ts`;
- `TranslationResolution` and `ListingTranslation` TypeScript contracts;
- public DTO normalization for atomic translation metadata;
- Xano client locale query support via `withLocale()`.

Created in live Xano as additive tables:

| Table | ID | Initial state |
| --- | ---: | --- |
| `locales` | `873236` | five inactive-for-public rollout records seeded |
| `taxonomy_translations` | `873239` | empty; frontend seed catalog prepared in code |
| `car_listing_translations` | `873240` | empty |
| `translation_jobs` | `873241` | empty |
| `content_migration_logs` | `873242` | empty |

Added nullable/default-safe fields:

- `automarket_users.preferred_locale` (default `de`);
- `car_listings.source_locale`;
- `car_listings.translation_source_hash`;
- `car_listings.translation_version` (default `1`);
- `car_listings.translations_ready` (default `false`);
- `car_listings.translation_updated_at`.

No existing listing field or row was deleted or rewritten.

## Миграция

Release 1 does not backfill production rows.

| Result | Count |
| --- | ---: |
| Existing listings rewritten | 0 |
| Original translation rows created | 0 |
| Translation jobs created | 0 |
| Warnings | 0 |
| `needs_review` | 0 |
| Failed | 0 |

Unknown legacy values are preserved by `mapLegacyVehicleValue()` with `migration_status=needs_review` and `legacy_value`.

## Переводы

No AI or machine translation was run in Release 1.

| Locale | Required | Completed | Reviewed | Missing | Outdated | Failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `de` | not calculated | 0 | 0 | not calculated | 0 | 0 |
| `en` | not calculated | 0 | 0 | not calculated | 0 | 0 |
| `uk` | not calculated | 0 | 0 | not calculated | 0 | 0 |
| `zh-Hans` | not calculated | 0 | 0 | not calculated | 0 | 0 |

## Isolation Tests

Automated foundation tests cover exact lookup and deterministic chains:

- `uk → uk → de`;
- `zh-Hans → zh-Hans → en → de`;
- `de → de`;
- `en → en → de`.

The public DTO accepts translation metadata only when requested, resolved and source locales plus status are all present. It never receives or chooses an array of translations.

## API

`getApprovedCars`, `getCarBySlug`, `getSellerListingsBySlug` and related-listing reads accept an optional locale and use one `withLocale()` helper. Existing callers omit locale, so the production contract is unchanged.

Locale-aware Xano endpoint patches are deferred to Release 3 after dual write, source hashes, backfill and admin-only dual-read checks. Current API examples therefore remain legacy and must not be presented as localized production responses.

## SEO

`BaseLayout` now receives a locale and emits dynamic `lang`, `dir` and `Content-Language`; its default remains the legacy Russian UI locale so Release 1 does not produce German metadata around Russian text.

Locale-prefixed routes, localized canonical/hreflang, JSON-LD and multilingual sitemap are not enabled in Release 1. Enabling them before translated content exists would create language-contaminated indexable pages.

Cloudflare's static fallback initially returned the Russian homepage with HTTP 200 for an unknown locale-prefixed URL. Release 1 now routes the reserved prefixes through the Worker and returns a real non-cacheable 404 while the global, public-route or locale flag is disabled. This prevents accidental indexing before a locale release.

## Feature Flags

Added with safe default `false`:

- `I18N_ENABLED`;
- `I18N_API_READ_ENABLED`;
- `I18N_DUAL_WRITE_ENABLED`;
- `I18N_PUBLIC_ROUTES_ENABLED`;
- `I18N_AI_TRANSLATION_ENABLED`;
- per-locale flags for `de`, `en`, `uk`, `zh-Hans`.

Rollback is immediate: keep or return every flag to `false`; legacy fields and routes remain intact.

## Backups

Local frontend backup:

`/Users/david/Documents/Codex/2026-06-27/first-install-this-skill-npx-skills/sitecraft-auto-market/.backups/multilingual-content-stage-10-release-1/`

External live Xano snapshot:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/multilingual-stage-10-release-1-20260730-203902/`

The external directory contains schema metadata only and is not committed or published.

## Tests

- `npm run check`: passed; 0 errors, 0 warnings, one non-blocking existing hint in `src/lib/publicCarCardsClient.ts`;
- `npm test`: passed; 353/353 tests;
- `npm run build`: passed; Cloudflare Advanced Mode worker compiled and 32 asset references across 33 HTML files were verified;
- migration foundation tests: passed, including BCP 47, locale priority, deterministic fallback, taxonomy mapping, disabled flags and inactive locale-route guard;
- Xano schema verification: passed for the five new table IDs and additive fields listed above;
- existing public `GET /cars`: HTTP 200 after deployment, with its legacy contract unchanged.

## Release 1 Deployment

- Cloudflare Pages project: `sitecraft-auto-market`;
- deployment ID: `8f5cb698-3476-4e73-b9b5-5a020cb93946`;
- deployment URL: `https://8f5cb698.sitecraft-auto-market.pages.dev`;
- production URL: `https://automarket.sitecraft.agency`.

Production HTTP smoke after propagation:

| Route | Result |
| --- | --- |
| `/` | 200 |
| `/cars/` | 200 |
| `/cars/bmw-520-2004-73/` | 200 |
| `/de/` | 404 while disabled |
| `/en/` | 404 while disabled |
| `/uk/` | 404 while disabled |
| `/zh-Hans/` | 404 while disabled |

The active unprefixed UI remains Russian and no language switch is exposed in Release 1.

## Rollout

Release 1 changed no public language behavior. Release 2 was deployed as described below.

## Release 2 — Dual Write And Jobs

Release 2 keeps the existing public listing fields authoritative while adding the multilingual write path:

- `car_drafts.source_locale` is nullable/default-safe and defaults to `de`;
- create draft resolves locale from the request, authenticated user preference or `de`;
- submit and owner edit calculate a SHA-256 source hash from title and description;
- the original `car_listing_translations` row is upserted by listing and locale;
- stale translation rows and superseded pending/processing jobs are marked `outdated`;
- one idempotent job is created per active target locale;
- existing public listing responses and legacy fields are unchanged;
- no AI translation was started and `I18N_AI_TRANSLATION_ENABLED` remains disabled.

Production Xano changes:

| Resource | ID | Result |
| --- | ---: | --- |
| `car_drafts` table | `863714` | `source_locale` added |
| POST `/listings/create-draft` | `3982637` | locale resolution and draft dual write |
| POST `/listings/submit-moderation` | `3982675` | source hash, original translation and jobs |
| PATCH `/dashboard/listings/{id}` | `3969714` | owner-edit dual write and job invalidation |
| GET `/admin/listings/{id}/translations` | `4003322` | new read-only admin inspection endpoint |

The admin endpoint requires authentication and checks `automarket_users.role == "admin"` before reading listing translations or jobs. An unauthenticated production request returned `401`.

Immediately after rollout, before any destructive or synthetic production listing edit:

| Production table | Rows |
| --- | ---: |
| `car_listing_translations` | 0 |
| `translation_jobs` | 0 |

This is expected: Release 2 creates rows when a listing is submitted or edited through the patched workflows. No live customer listing was mutated merely to populate the tables.

## Release 2 Frontend

The moderation page now contains a lazy, read-only translation panel. It requests a fresh auth token when opened, uses `Cache-Control: no-store`, and displays source locale, source version, translation states and job states. The panel does not expose translation controls or enable public localized reads.

Changed frontend/test artifacts:

- `src/lib/apiRoutes.ts`;
- `src/pages/admin/moderation.astro`;
- `src/styles/global.css`;
- `tests/multilingual-dual-write-stage-10.test.ts`;
- `docs/xano/multilingual-stage-10/release-2/*`.

## Release 2 Backups And Rollback

External live Xano snapshot:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/multilingual-stage-10-release-2-20260802-120944/`

It contains the pre-change table/endpoint metadata and XanoScript plus captured live-after scripts. It is outside the repository and contains no production row export in this report.

Rollback order:

1. restore the saved pre-change XanoScript for endpoint IDs `3982637`, `3982675` and `3969714`;
2. restore the saved pre-change `car_drafts` schema if no Release 2 draft depends on `source_locale`, otherwise leave the additive field in place;
3. disable or remove endpoint `4003322` after confirming no admin client depends on it;
4. redeploy the previous Pages deployment `8f5cb698-3476-4e73-b9b5-5a020cb93946`;
5. keep all public multilingual feature flags disabled throughout rollback.

Because legacy listing fields and public reads were not replaced, rollback does not require rewriting existing listings.

## Release 2 Verification And Deployment

- targeted multilingual dual-write tests: 14/14 passed;
- `npm run check`: passed, 0 errors and 0 warnings; one existing non-blocking hint remains in `src/lib/publicCarCardsClient.ts`;
- `npm test`: passed, 360/360 tests;
- `npm run build`: passed; Cloudflare Advanced Mode output compiled and asset verification succeeded.

Cloudflare Pages deployment:

- project: `sitecraft-auto-market`;
- deployment ID: `04864d5f-667e-4331-81c0-2242082cc275`;
- deployment URL: `https://04864d5f.sitecraft-auto-market.pages.dev`;
- production URL: `https://automarket.sitecraft.agency`.

Production HTTP smoke:

| Route | Result |
| --- | --- |
| `/` | 200 |
| `/cars/` | 200 |
| `/admin/moderation/` | 200 document response |
| `/de/` | 404 while disabled |
| `/uk/` | 404 while disabled |

The available controlled browser session was not authenticated for the production admin route. It redirected to login, so this report does not claim an authorized admin-panel E2E. Xano compilation, automated contracts, unauthenticated `401`, build, deployment and public HTTP smoke are confirmed; authenticated admin inspection remains the first manual verification for the next release window.

## Next Safe Release

Before Release 3 German public reads:

1. seed `taxonomy_translations` idempotently;
2. submit or edit a controlled test listing and verify the original row/job set in the authenticated admin panel;
3. run a small resumable backfill batch with migration logging;
4. process translations asynchronously and review German output;
5. verify isolation and fallback contracts against populated data;
6. only then enable German API reads and routes behind their existing feature flags.

Stage 10 is not marked complete. The complete Definition of Done still requires Releases 3–6, multilingual SEO/sitemaps, backfill, removal of runtime description parsing and production E2E for all four public locales.
