# Moderation status audit

Date: 2026-07-13

## Status model

The project has two related but separate values:

- Lifecycle status: `ai_draft`, `draft`, `pending_review`, `approved`, `published`, `sold`, `archived`, `blocked`, `deleted`, `rejected`, `needs_fix`, or `unknown`.
- Moderation status: `pending_review`, `needs_fix`, `approved`, `rejected`, `blocked`, `null`, or `unknown`.

Admin moderation uses a non-empty known `moderation_status` first. If it is null, the safe lifecycle fallback is: `pending_review -> pending_review`, `approved/published -> approved`, `rejected -> rejected`, `needs_fix -> needs_fix`, and `blocked -> blocked`. Drafts do not enter the queue without an explicit moderation state. Sold and archived remain lifecycle groups. Deleted records and unknown/conflicting combinations require manual attention.

The public catalog remains governed by its existing strict public predicate and was not changed for INT-005.

## Context table

| Context | Before | After |
| --- | --- | --- |
| Public catalog | Shared strict public predicate over both fields | Unchanged |
| Seller dashboard | Seller lifecycle status | Unchanged |
| Admin moderation queue | Direct `car.status` comparisons | Effective moderation status plus lifecycle conflict guard |
| Admin status badge | Raw lifecycle-derived local label | Shared translated status label plus conflict badge |
| Admin actions | Local branching on `car.status`; restore mapped to approve | Shared `canRunModerationAction`; restore hidden and never mapped to approve |

## Conflict policy

`getStatusConflict()` does not mutate data. A conflict is shown as `Конфликт статусов`, placed in the `conflict` queue group, and receives no normal moderation buttons. Lifecycle `deleted`, conflicting `blocked`, archived records with an active moderation state, unknown values, and mismatched explicit moderation states require manual review.

## Published Xano contract

- `GET /admin/moderation`, endpoint ID `3966702`, auth ID `861779`, XanoScript status `ok`.
- Guest request returns HTTP 401.
- The endpoint removes seller name/email/phone and VIN, then returns safe rows.
- Table `car_listings` ID `861468` contains both `status` and `moderation_status`; no endpoint update was needed.
- Approve (`3966703`), reject (`3966704`), block (`3979595`), and submit moderation (`3982675`) write both status fields.
- Delete (`3975051`) and sold (`3975107`) currently write lifecycle status only. INT-005 handles these safely in the UI; backend action changes are outside this stage.

## Aggregate data audit

Read-only Metadata API aggregation covered all 20 current rows. No IDs, seller data, VIN, or contacts are included here.

| Lifecycle + moderation | Count | Effective/group |
| --- | ---: | --- |
| approved + null | 9 | approved |
| approved + approved | 1 | approved |
| approved + pending_review | 2 | conflict (effective pending_review) |
| deleted + null | 4 | conflict/manual attention |
| deleted + pending_review | 2 | conflict/manual attention |
| deleted + blocked | 2 | conflict/manual attention |

Old published UI counters: 20 total, 0 pending, 12 approved, 8 deleted.

New helper counters on the same rows: 20 total, 0 pending, 10 approved, 10 conflict. No database row was changed. The two `approved + pending_review` rows are no longer silently counted as approved or normal pending; explicit moderation remains the effective value while the mismatch forces the conflict group.

## Tests

The focused status suite covers the ten required fixtures plus one consistency test. It verifies effective status precedence, queue group, conflict detection, pending/approved predicates, labels, tones, counters, and action availability. All 11 tests pass.

Authenticated browser verification of the currently published (old) UI loaded 20 rows and reproduced its old 12-approved/8-deleted counters. Because this stage forbids deployment, the updated UI cannot be verified on the published domain yet. No destructive action was run.

The rebuilt admin shell contains no embedded moderation row object and no listing title from the protected dataset. A value-based PII scan found no seller name, phone, or VIN. Two email matches are the project's pre-existing admin allowlist constants in `authClient`, not values embedded from moderation records; changing the auth architecture is explicitly outside INT-005.

## Manual normalization guidance

Do not bulk-update these rows. Review conflicts individually and confirm the intended lifecycle before changing either field. For terminal lifecycle records, preserve the terminal state and only normalize moderation metadata when the business history is known. For `approved + pending_review`, confirm whether the listing was reopened or whether the moderation value is stale. Never infer that choice from the frontend alone.
