# Multilingual Release 2 Validation

## Status

Release 2.1 is prepared locally but has not been applied to production. The mandatory authenticated admin E2E gate is still open, so no controlled listing was created and endpoint `4003322` was not claimed as fully verified.

## Live verification

- Production Release 2 deployment observed: `04864d5f-667e-4331-81c0-2242082cc275`.
- Required fields exist in live `car_listings`, `car_drafts`, and `automarket_users`.
- Unique indexes exist for `car_listing_translations (car_listing_id, locale_code)` and `translation_jobs.idempotency_key`.
- Live translation rows, jobs, and migration logs were empty at the backup snapshot.
- Locales `de`, `en`, `ru`, `uk`, and `zh-Hans` exist and are active; all public locale flags were false.

## Finding and remediation

The Release 2 scripts hashed only a partial source document and used `sha256:false`. They also entered the multilingual workflow when the source hash had not changed, allowing metadata timestamps and job queries to run unnecessarily.

The prepared Release 2.1 scripts now:

- hash stable JSON containing title, description, SEO fields, image alt texts, search keywords, source locale, and `listing-i18n-v1`;
- normalize empty optional values to `null`;
- use hexadecimal `sha256:true`;
- skip translation mutations when the hash is unchanged;
- start a new record at translation version `1` and increment only after a changed hash;
- preserve idempotency keys in the form `car_listing:{id}:{locale}:{source_hash}`.

The common fixture hash is:

`f7ee58d56f5dffa657d1b951bbc39393888217f85efb669283a0ca0b23d8f788`

Both prepared XanoScript files passed the Xano metadata conversion/compile preflight. They were not published.

## Prepared artifacts

- `src/i18n/sourceHash.ts`
- `docs/xano/multilingual-stage-10/release-2-1/POST_listings_submit_moderation.after.xs`
- `docs/xano/multilingual-stage-10/release-2-1/PATCH_dashboard_listings_id.after.xs`
- `docs/xano/multilingual-stage-10/release-2-1/GET_admin_listing_translations.xs`
- `tests/multilingual-source-hash-stage-10.test.ts`
- `tests/multilingual-dual-write-stage-10.test.ts`

## E2E gate

| Check | Result |
| --- | --- |
| Controlled listing ID | Not created |
| Create/save/edit/moderation dual write | Not run with production auth |
| Hash and version before/after | Not available |
| Original rows and jobs | Not mutated |
| Network retry idempotency | Static contract covered; production E2E pending |
| `4003322` without token | Pending direct HTTP check |
| `4003322` ordinary user | Pending controlled ordinary-user session |
| `4003322` admin | Pending authenticated admin session |

Chrome control could not establish a usable authenticated production tab. Production deployment and mutation were therefore stopped as required by the release gates.

## Backups and rollback

- Local file backup: `.backups/multilingual-release-2-validation-release-3/`
- External live metadata backup: `/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/multilingual-stage-10-release-3-20260802-124400/`
- Rollback source: endpoint `*.live-before.xs` and `*.live-before.json` files in the external backup.

No production rollback is currently required because the prepared Release 2.1 scripts were not applied.

## Local verification

- `npm install`: passed, 0 vulnerabilities.
- `npm run check`: passed, 0 errors (one pre-existing informational hint).
- `npm test`: passed, 370/370.
- `npm run build`: passed; Cloudflare Advanced Mode worker compiled.
- `npm run verify:assets`: passed, 32 references across 33 HTML files.
- Production read-only smoke: `/`, `/cars/`, and `/admin/moderation/` returned 200.
- `/de/`, `/en/`, `/uk/`, and `/zh-Hans/` returned 404 as required before Release 3.
