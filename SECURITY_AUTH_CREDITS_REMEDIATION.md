# Security Auth/Credits Remediation

Remediation date: 2026-07-25
Production Xano API group: `sitecraft-auto-market` (421515)
Scope: Security Stop-Risk for Xano endpoints 3968549 and 3974027 only.

## 1. Найденная причина уязвимости

Public POST `/auth/register` looked up an existing user by email and, when `password == null`, wrote a caller-supplied password and reset the role to `user`. An attacker who knew the email of a Google-only account could therefore claim it without proving ownership.

GET `/me/credits` mixed a wallet read with privileged mutations. It recognized two hardcoded emails, changed their role to `admin`, created or rewrote wallet rows, issued `1000000000` credits, reset usage counters, and wrote ledger rows.

## 2. Старое поведение

- Duplicate OAuth-only registration edited `automarket_users.password`, `name`, `role`, and `last_login_at`, then issued an auth token.
- Duplicate password registration returned an error, but the endpoint had no stable semantic conflict contract.
- Registration emitted a debug log containing normalized email and lookup state.
- Every `/me/credits` read could mutate user and wallet state.
- Missing wallets were initialized differently by registration (10), `/me/credits` (10 or 1B), and `/dashboard/summary` (0).

## 3. Новое поведение

- A new registration accepts only `name`, `email`, and `password`; server-owned values set `role: "user"` and the existing 10-credit welcome wallet.
- An existing password identity returns HTTP `409` with `EMAIL_ALREADY_REGISTERED`. No account, wallet, role, password, OAuth identity, or token is changed.
- An existing passwordless identity returns HTTP `409` with `ACCOUNT_LINK_REQUIRED`. Public registration does not link accounts or issue a token.
- Registration validates a non-empty name, Xano email type, and an 8-character minimum password.
- GET `/me/credits` requires authentication, resolves only `$auth.id`, reads only that wallet, and returns zero when no wallet exists.
- GET `/me/credits` returns HTTP `401` without a valid token and contains no database mutation.
- Legacy response fields remain available: `ai_credits`, `credits`, `ai_daily_generations`, and `ai_monthly_generations`; canonical additions are `balance`, `wallet_type`, and `updated_at`.

## 4. Изменённые Xano endpoints

| ID | Method/path | Production result |
| ---: | --- | --- |
| 3968549 | POST `/auth/register` | Published 2026-07-25; XanoScript status `ok`; duplicate branches stop with HTTP 409 before writes |
| 3974027 | GET `/me/credits` | Published 2026-07-25; XanoScript status `ok`; authenticated owner read only; unauthorized smoke test returned 401 |

Canonical reviewed scripts are stored in `docs/xano/security-stop-risk/`. Rollback copies of the pre-change production metadata and scripts are stored outside the repository at `/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/outputs/security-stop-risk-20260725/`.

## 5. Изменённые frontend-файлы

- `src/lib/registrationErrors.ts`: extracts the two semantic registration codes from direct or nested Xano payloads and maps them to safe Russian messages.
- `src/pages/register.astro`: displays the new messages and reveals a `Войти через Google` link only for `ACCOUNT_LINK_REQUIRED`. The link enters the existing `/login` Google OAuth workflow.

No role, balance, provider ID, or internal identity data is displayed.

## 6. Добавленные тесты

`tests/security-auth-credits.test.ts` checks:

- server-owned registration input and `user` role;
- existing password and OAuth-only 409 branches before writes;
- no duplicate-account password/role change or auth token;
- no privileged payload fields;
- authenticated, owner-scoped, mutation-free `/me/credits`;
- absence of hardcoded email and one-billion-credit markers;
- both frontend error contracts and Google sign-in recovery link.

The complete existing suite also covers session 401 behavior, Google role preservation, dashboard credit normalization, promotion integrity, and manual listing creation contracts.

## 7. Результаты проверок

- `npm run check`: passed, 169 files, 0 errors/warnings/hints.
- `npm test`: passed, 227/227 tests.
- `npm run build`: passed; Astro build and Cloudflare Pages Advanced Mode Worker compilation succeeded.
- Xano publish: both changed endpoints returned HTTP 200 with XanoScript status `ok`.
- Safe production smoke: unauthenticated GET `/me/credits` returned HTTP 401.
- Protected production scripts: endpoint 3995775 (promotion) and endpoint 3966700 (manual listing creation) remained byte-identical to their pre-change backups.

No production account was created or modified for destructive E2E testing. Duplicate/new-user state transitions are enforced by static contract regression tests and Xano compilation; an isolated staging workspace remains necessary for full transaction-level E2E evidence.

## 8. Оставшиеся риски

The active 57-endpoint production scan found additional backdoor-like conditions that were intentionally not changed in this task:

| Risk | Active endpoints/files | Finding |
| --- | --- | --- |
| HIGH | 3974045 `/ai/generate-listing`, 3979609 `/ai/listing/analyze-photos` | hardcoded emails trigger role/credit branches and `1000000000` credits |
| HIGH | 3966702, 3966703, 3966704, 3968561, 3975051, 3975107, 3979595, 3981578 | admin authorization accepts a hardcoded email as an alternative to an admin role |
| MEDIUM | `src/lib/authClient.ts` | client-side `isAdminUser` treats two hardcoded emails as administrators; frontend gating is not server authorization but can misrepresent access |
| MEDIUM | Authentication endpoints | no observed register/login rate limiting; OAuth `state`, PKCE, and redirect allowlist are not demonstrated |
| MEDIUM | Wallet contract | registration initializes 10 credits, `/me/credits` returns zero for a missing wallet, and `/dashboard/summary` creates a zero wallet |

The GET mutation in `/dashboard/summary` is a separate wallet-initialization concern. It was documented, not changed.

## 9. Не затронутые системы

No change was made to promotion endpoint 3995775, promotion prices, AI charge matrix, daily grants, free/paid/provider wallet structure, payments, Deal Finder, R2, moderation behavior, SEO, design, public catalog, or manual listing workflow 3966700.

## 10. Rollback-инструкция

1. Source `/Users/david/Documents/Codex/2026-07-01/xana-api-metadata/.env.xano` without printing its values.
2. Restore endpoint 3968549 from `outputs/security-stop-risk-20260725/3968549.before.xs` using Xano Metadata API PUT with `publish=true` and content type `text/x-xanoscript`.
3. Restore endpoint 3974027 from `outputs/security-stop-risk-20260725/3974027.before.xs` using the same method.
4. Re-read both endpoints with `include_xanoscript=true` and require `xanoscript.status == "ok"`.
5. Run an unauthenticated `/me/credits` probe and the repository test/check/build commands.

Rollback restores the vulnerable behavior and should be used only to recover from an operational emergency while a corrected replacement is prepared.
