# Pilot I18N Backfill Release 2.2

## Status

Dry-run completed. Apply and repeat-apply were not executed because Release 2.1 authenticated E2E is a mandatory predecessor gate.

## Safety controls

`scripts/i18n-backfill.mjs` supports `--dry-run`, `--apply`, `--limit`, `--batch-size`, `--resume-cursor`, and `--listing-ids`. It uses stable source hashes, idempotent translation job keys, migration-log reuse, bounded batches, and no AI provider calls.

Unknown enum values are preserved as warnings and short/ambiguous content is marked `needs_review`; it is not silently assigned to Russian. Changed source hashes retire stale target translations and pending/processing jobs as `outdated`.

## Candidate scan

- 27 listings inspected read-only.
- Detected locales: 24 `ru`, 1 `de`, 2 unresolved.
- 23 candidates were applicable, 4 needed review, 0 failed.
- No production row was changed.

## Selected dry-run

| ID | Locale / detection | Hash / version | Original | Planned jobs | Normalized enum summary | Warnings | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | `ru`, script+markers, 0.90 | `31babb25...bf6c03`, v1 | create | de,en,uk,zh-Hans | petrol, manual | none | updated |
| 48 | `ru`, script+markers, 0.90 | `bbad041e...cd3692`, v1 | create | de,en,uk,zh-Hans | passenger_car, sedan, silver | unknown fuel/transmission | needs_review |
| 57 | `ru`, script+markers, 0.90 | `01d5d54d...336811`, v1 | create | de,en,uk,zh-Hans | passenger_car, hatchback, petrol, automatic | none | updated |
| 91 | `ru`, script+markers, 0.90 | `bab05756...2852f`, v1 | create | de,en,uk,zh-Hans | wagon, diesel, automatic, private | none | updated |
| 94 | `de`, markers, 0.95 | `d9185c42...6545cc`, v1 | create | en,ru,uk,zh-Hans | sedan, petrol, automatic, private | none | updated |
| 95 | `ru`, script+markers, 0.90 | `ab5866b4...a9c81`, v1 | create | de,en,uk,zh-Hans | commercial_vehicle, van, diesel, manual | none | updated |
| 96 | unresolved, 0.50 | none, v0 | skipped | none | canonical values planned | low language confidence | needs_review |
| 97 | unresolved, 0.50 | none, v0 | skipped | none | canonical values planned | low language confidence | needs_review |

Summary: `selected=8`, `completed=5`, `needs_review=3`, `failed=0`.

Full safe dry-run artifact:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/multilingual-stage-10-release-3-20260802-124400/pilot-backfill-selected-dry-run.json`

## Gate still required

After authenticated Release 2.1 E2E, run the selected pilot with `--apply`, verify rows/jobs/logs, then repeat exactly the same command and require `already_migrated`/`no_changes` with no duplicate rows. Until then, this report is not evidence of a production backfill.

The backfill/hash/dual-write regression subset passed 15/15; the complete project suite passed 370/370. These are local/static and dry-run checks, not production mutation E2E.
