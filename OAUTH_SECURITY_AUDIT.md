# OAuth Security Audit

Date: 2026-07-25
Scope: Xano `3968076` (`/oauth/google/init`), `3968099` (`/oauth/google/continue`) and the production login/callback frontend.

## Confirmed

- Google authorization-code flow is connected and returns a SiteCraft auth token after identity lookup.
- Existing users retain their stored server role; new OAuth users are created with `role = "user"`.
- The callback uses the same `redirect_uri` value for code exchange.
- Existing identity lookup is email-based and then updates the stored Google identity/profile.

## Missing

- No generated, stored, expiring, single-use OAuth `state` is present.
- No PKCE `code_challenge`/`code_verifier` is present.
- Xano accepts caller-supplied `redirect_uri`; no server-side allowlist is present.
- Frontend `next` is stored and later assigned to `window.location.href` without same-origin/path validation.
- No application-level callback nonce or replay record is present.

## Not Confirmed

- Google Cloud Console redirect URI restrictions and OAuth client configuration.
- Whether Google rejects reused authorization codes; this is provider behavior, not an application replay control.
- Explicit verification of `verified_email` before linking an existing account.

## Critical / High

- **High:** missing `state` permits OAuth login CSRF/session swapping.
- **High:** missing redirect URI allowlist and unvalidated `next` create redirect abuse risk.
- **High:** linking an existing account by email is not accompanied by an explicit verified-email check in the script.
- **High:** PKCE is absent, weakening authorization-code interception protection.

## Next Implementation Task

Implement one server-owned OAuth transaction record containing a random state hash, PKCE verifier, allowlisted callback origin, normalized same-origin `next`, creation/expiry timestamps and consumed timestamp. Require an unexpired, unconsumed match before token exchange and verify the Google email is verified before linking.

## Minimum Test Plan

1. Valid state, verifier, callback URI and verified identity complete once.
2. Missing, wrong, expired or reused state fails without issuing a token.
3. Wrong PKCE verifier and non-allowlisted redirect URI fail.
4. External/protocol-relative `next` values resolve to `/dashboard`.
5. Unverified or mismatched identity cannot link an existing user.
6. Existing admin login preserves `role = "admin"`; a new OAuth user receives `role = "user"`.
