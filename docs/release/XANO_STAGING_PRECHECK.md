# Xano staging precheck

Date: 26 July 2026

## Access and topology

- Xano CLI: available and authenticated through the local default profile.
- Workspace: `sitecraft.agency`, workspace ID `115940`.
- Production branch: `v1` (`live`).
- Staging branch at precheck: absent; `v1` is the only remote branch.
- API group: `sitecraft-auto-market`.
- Direct workspace push setting: disabled (`Allow Push: false`).
- Records and environment variables were not pulled.

The staging plan is to clone `v1` into a non-live branch named `staging-favorites-ai`. The live branch must not be changed until staging compilation and authenticated E2E are complete.

## Staging creation result

`xano branch create staging-favorites-ai --source v1` was attempted after the backup. Xano rejected it with `Branch creation is restricted to paid accounts`. `xano sandbox get` was also rejected with `Not supported with Free plan`. No branch, table, endpoint, record or environment value was changed.

This is a hard release blocker. Creating an unrelated empty workspace is not a safe substitute for a clone of the production schema/data contracts. Upgrade the Xano plan or otherwise enable a non-live branch/sandbox, then rerun from step 2 of the migration plan.

## Read-only inventory

The pre-change pull contains 39 table definitions and 58 documents in the target API group. Relevant existing tables:

- `automarket_users`
- `car_listings`
- `car_listing_images`
- `car_drafts`
- `car_draft_images`
- `user_credits`
- `credit_transactions`
- `ai_generation_logs`
- `ai_search_logs`
- `ai_listing_checks`
- `ai_description_generations`
- `deal_finder_searches`
- `deal_finder_listings`
- `deal_finder_analyses`
- `deal_finder_sync_logs`

Confirmed missing from the live schema snapshot:

- `car_listing_favorites`
- `deal_finder_translations`
- `automarket_users.first_name`
- `automarket_users.last_name`
- `automarket_users.display_name`
- `automarket_users.contact_phone`
- `automarket_users.contact_email`
- `automarket_users.show_phone`
- `automarket_users.show_email`
- `automarket_users.preferred_contact_method`

The existing `automarket_users.email` is the private login identity and must not be copied into a public contact field.

## Existing target endpoints

| ID | Method and path | Present in pull |
| ---: | --- | --- |
| `3979609` | `POST /ai/listing/analyze-photos` | yes |
| `3981498` | `POST /ai/listing/generate-description` | yes |
| `3981478` | `POST /ai/listing/quality-score` | yes |
| `3981451` | `POST /ai/search/intent` | yes |
| `3981578` | `POST /ai/moderation/check-listing` | yes |
| `3988688` | `GET /deal-finder/stats` | yes |
| `3988689` | `GET /deal-finder/listings` | yes |
| `3988690` | `GET /deal-finder/listings/{id}` | yes |
| `3988691` | `GET /deal-finder/searches` | yes |
| `3988692`-`3988696` | Deal Finder view/save/unsave/hide/restore | yes |
| `3990128`-`3990132` | Deal Finder analysis queue | yes |

Favorites, contact-profile and translation endpoints do not exist in the pulled API group and therefore have no IDs yet.

## Migration plan

1. Clone live `v1` to non-live `staging-favorites-ai`.
2. Pull and compare the staging clone.
3. Add only the missing favorites/translation tables and contact fields.
4. Add favorites, contact-profile and translation endpoints.
5. Patch public seller DTOs and the five existing AI endpoints.
6. Patch Deal Finder enqueue/completion billing without exposing internal routes.
7. Run Xano dry-run/compile before any push/import.
8. Run authenticated owner/non-owner and credit idempotency E2E on staging.
9. Keep production blocked until every release-gate item is PASS.

Current status: blocked before step 2 because a non-live Xano environment cannot be created on the current plan.

## Deletion and orphan policy

- Prefer database relation cascade only after confirming Xano's generated relation behavior in staging.
- Otherwise delete owner/listing favorites in the existing server-side deletion workflows before the parent row is removed.
- Do not hard-delete existing users or listings as part of this migration.

## Backup and rollback

The full metadata snapshot is stored outside the repository at:

`/Users/david/.codex/audits/sitecraft-auto-market/xano-prechange-2026-07-26`

It excludes records and environment variables. Sanitized checksums and the rollback sequence are stored under `docs/release/xano-backup/` and `docs/release/XANO_ROLLBACK_PLAN.md`.
