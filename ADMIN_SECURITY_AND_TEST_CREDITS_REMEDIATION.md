# Admin Security And Test Credits Remediation

Date: 2026-07-25

## 1. Executive Summary

The two existing Google accounts remain intact and are authorized by the server-owned `role = "admin"`. Legacy email/one-billion-credit bypasses were removed from two AI and eight admin production endpoints. AI now uses the ordinary wallet check, one-credit deduction and ledger workflow for administrators as well as regular users.

## 2. Initial Account State

Exactly two expected records were found. Both had Google identity data, role `admin`, an existing wallet and no schema field for blocked/active status. Existing password, OAuth identity, email, name and contacts were not changed. Each wallet already held 1,000,000,000 legacy credits, so the required minimum of 10,000 was already met.

## 3. Internal User IDs

- User `1`: Google identity present, role `admin`.
- User `15`: Google identity present, role `admin`.

## 4. Backups

Private production backups are stored outside the repository at:

`/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/admin-security-remediation-20260725`

They include user, wallet and ledger rows; before/after endpoint metadata and XanoScript; the frontend auth helper; protected endpoint baselines; migration result and rollback inputs. Permissions are restricted to the local user. Sensitive rows are not committed.

## 5. Role Migration

The private migration asserts exactly two expected existing records, never creates users, and updates only a non-admin role. Both records were already `admin`, so no role write was needed. A second run confirmed idempotency and unchanged Google identity/password fields.

## 6. Credit Migration

The migration uses the legacy `user_credits.ai_credits` wallet, creates a wallet only if missing, and tops up only the positive difference to 10,000. Both balances were already 1,000,000,000, so no credit was added and both final balances remain 1,000,000,000.

## 7. Ledger And Idempotency

Because no monetary balance change was required, two zero-amount audit markers record the completed migration:

- User `1`: transaction `38`, key `admin-test-grant-v1-1`, amount `0`.
- User `15`: transaction `39`, key `admin-test-grant-v1-15`, amount `0`.

The second migration run found one row per key and created no duplicate.

## 8. Changed AI Endpoints

- `3974045` POST `/ai/generate-listing`
- `3979609` POST `/ai/listing/analyze-photos`

Removed hardcoded email detection, role mutation, unlimited branches, balance resets and special grants. Auth, `$auth.id`, provider workflow, response contract, ordinary insufficient-credit checks, one-credit deduction, counters and ledger remain.

## 9. Changed Admin Endpoints

- `3966702` GET `/admin/moderation`
- `3966703` PATCH `/admin/cars/{id}/approve`
- `3966704` PATCH `/admin/cars/{id}/reject`
- `3968561` PATCH `/admin/cars/{id}/assign-owner`
- `3975051` PATCH `/admin/cars/{id}/delete`
- `3975107` PATCH `/admin/cars/{id}/sold`
- `3979595` PATCH `/admin/cars/{id}/block`
- `3981578` POST `/ai/moderation/check-listing`

Every endpoint checks token, reads the current user with `$auth.id`, then requires `role == "admin"` before listing data or mutation. No token returns `401`; a temporary ordinary-user fixture returned `ERROR_CODE_ACCESS_DENIED` (`403`) for all eight and was deleted. Destructive admin mutations were not run against production listings.

## 10. Frontend Role Gating

`isAdminUser` now accepts only `user.role === "admin"`. Header, dashboard/admin guards and moderation UI continue to use the shared helper. This controls visibility only; Xano remains the security boundary.

## 11. Rate-Limit Audit

No application-level or endpoint metadata rate limit was found for login, register, Google OAuth init/continue, AI search intent, listing generation or photo analysis. No custom limiter was added.

Recommended built-in limits:

| Endpoint | Limit | Key / Window |
|---|---:|---|
| Login | 10 attempts | IP + normalized email / 10 min |
| Register | 5 attempts | IP / hour; normalized email / day |
| OAuth init | 20 attempts | IP / 10 min |
| OAuth continue | 10 attempts | IP + OAuth state / 10 min |
| AI search intent | 10 requests | IP until authenticated, then user ID / 10 min |
| Generate listing | 5 requests | user ID / min, plus daily provider budget |
| Analyze photos | 5 requests | user ID / min, plus daily provider budget |

All limits should return `429`, include `Retry-After`, and log endpoint/key hash/outcome without credentials. The Xano Metadata API itself returned `429` during the audit batch; this is unrelated to application endpoint protection.

## 12. OAuth Audit Summary

Google login preserves the existing server role, but `state`, PKCE, server-side redirect URI allowlisting and safe `next` validation are absent. Existing-account linking also lacks an explicit verified-email check. See `OAUTH_SECURITY_AUDIT.md`.

## 13. Production Scan

All 57 active Xano endpoint scripts and the production frontend source were scanned. They contain no known admin email, `1000000000`, `is_unlimited_admin`, `special_email`, `admin_email` or `superuser` backdoor. The sole broad `is_admin` substring match was the unrelated moderation variable `is_administrative_status` and was classified as a false positive. Historical reports, private backups, migration verification and regression tests retain values only as evidence or absence checks.

## 14. Tests And Build

Static parameterized tests cover the two migration records, idempotency markers, two AI contracts, eight admin role guards, frontend role-only gating and backdoor markers. These are contract tests, not a substitute for isolated staging E2E. `npm run check` passed with 0 diagnostics across 169 files, `npm test` passed 240/240, and `npm run build` completed the Cloudflare Advanced Mode bundle successfully.

## 15. Frontend Deploy

The pending registration conflict UI, registration error helper, role-only admin helper, tests and remediation documents are released as one commit through the existing GitHub Actions Cloudflare Pages workflow. Deployment result and smoke checks are recorded after publication.

## 16. Smoke Checks

Planned production checks: `/register`, duplicate password conflict, OAuth-only conflict, Google login button/init, admin navigation and browser console. No disposable production user will be left behind.

## 17. Rollback

- Roles/wallets: use internal IDs `1` and `15` with saved before values. No role or wallet mutation occurred in this migration.
- Ledger: remove only zero-amount transactions `38` and `39` if the migration record itself must be rolled back.
- Xano: restore each of the ten `.before.xs` scripts and metadata from the private backup folder, in reverse batch order.
- Frontend: revert the single remediation commit and allow the same workflow to deploy the previous build.
- Protected endpoints `3995775` and `3966700` match their pre-task script hashes and require no rollback.

## 18. Remaining Risks

OAuth High findings and missing application rate limits remain. Legacy wallet balances are much higher than the requested test minimum; they were intentionally not reduced because this task required no deduction when already above 10,000. Credit Architecture v2, billing and provider-wide metering remain outside scope.

## 19. Recommended Next Stage

Implement the server-owned OAuth transaction (`state`, PKCE, redirect allowlist, verified-email linking and safe `next`) and configure native edge/Xano rate limits before broad external acquisition.
